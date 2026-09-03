/**
 * Extrai o design system de um site a partir do CSS dele.
 *
 * Por que do CSS: cor de marca quase nunca aparece no HTML. Ela vive em
 * folhas de estilo, em variáveis e em classes utilitárias. Quem só lê o HTML
 * (inclusive scrapers que devolvem markdown) não enxerga a paleta.
 *
 * Nada aqui executa script. O CSS é lido como texto e passa pelas mesmas
 * proteções de SSRF da leitura da página.
 */
import { fetchText, assertSafeUrl } from "./url-guard.ts";

export type ExtractedColor = {
  hex: string;
  count: number;
  role: "primaria" | "secundaria" | "apoio" | "fundo" | "texto";
  label: string;
};

export type DesignSystem = {
  colors: ExtractedColor[];
  fonts: { headline: string; body: string; candidates: string[] };
  logo: { url: string; kind: "svg" | "icon" | "og" | "img" } | null;
  images: string[];
  stylesheets: number;
};

// ------------------------------------------------------------------- cores
const HEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+)\s*)?\)/g;
const HSL = /hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+)\s*)?\)/g;

function toHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function expandHex(raw: string): string | null {
  if (raw.length === 3) {
    return `#${raw.split("").map((c) => c + c).join("")}`.toUpperCase();
  }
  if (raw.length === 6) return `#${raw}`.toUpperCase();
  // 8 dígitos: ignora o canal alfa; 4 dígitos: idem, na forma curta.
  if (raw.length === 8) return `#${raw.slice(0, 6)}`.toUpperCase();
  if (raw.length === 4) {
    return `#${raw.slice(0, 3).split("").map((c) => c + c).join("")}`.toUpperCase();
  }
  return null;
}

function rgbOf(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Luminância relativa, para separar fundo de texto. */
function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Saturação: separa cor de marca de cinza estrutural. */
function saturation(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Tons quase iguais viram um só: senão a paleta sai com 12 azuis. */
const SIMILAR = 34;

export function extractColors(css: string, limit = 6): ExtractedColor[] {
  const counts = new Map<string, number>();
  const bump = (hex: string | null) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };

  for (const match of css.matchAll(HEX)) bump(expandHex(match[1]));
  for (const match of css.matchAll(RGB)) {
    if (match[4] !== undefined && Number(match[4]) < 0.35) continue; // quase transparente
    bump(toHex(Number(match[1]), Number(match[2]), Number(match[3])));
  }
  for (const match of css.matchAll(HSL)) {
    if (match[4] !== undefined && Number(match[4]) < 0.35) continue;
    bump(hslToHex(Number(match[1]), Number(match[2]), Number(match[3])));
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // Agrupa tons próximos, somando as ocorrências no representante mais usado.
  const grouped: { hex: string; count: number }[] = [];
  for (const [hex, count] of ordered) {
    const near = grouped.find((item) => distance(item.hex, hex) < SIMILAR);
    if (near) near.count += count;
    else grouped.push({ hex, count });
  }

  const isNeutral = (hex: string) => saturation(hex) < 0.12;

  const fundo = grouped.find((item) => isNeutral(item.hex) && luminance(item.hex) > 0.82);
  const texto = grouped.find((item) => isNeutral(item.hex) && luminance(item.hex) < 0.22);

  // Cor de marca: saturada e com uso relevante. Uma ocorrência solta costuma
  // ser azul de link do navegador ou cor de estado, não identidade.
  const candidatas = grouped.filter(
    (item) => !isNeutral(item.hex) && luminance(item.hex) > 0.04 && luminance(item.hex) < 0.95,
  );
  const MIN_USOS = 3;
  const relevantes = candidatas.filter((item) => item.count >= MIN_USOS);
  const marca = (relevantes.length ? relevantes : candidatas).sort(
    (a, b) => b.count * (0.8 + 0.4 * saturation(b.hex)) - a.count * (0.8 + 0.4 * saturation(a.hex)),
  );

  const result: ExtractedColor[] = [];
  marca.slice(0, 3).forEach((item, index) => {
    result.push({
      hex: item.hex,
      count: item.count,
      role: index === 0 ? "primaria" : index === 1 ? "secundaria" : "apoio",
      label: "",
    });
  });
  if (fundo) result.push({ hex: fundo.hex, count: fundo.count, role: "fundo", label: "" });
  if (texto) result.push({ hex: texto.hex, count: texto.count, role: "texto", label: "" });

  return result.slice(0, limit);
}

// -------------------------------------------------------------- tipografia
const GENERIC = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui",
  "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "ui-serif", "ui-monospace",
  "inherit", "initial", "unset", "revert", "segoe ui", "roboto", "helvetica neue",
  "helvetica", "arial", "apple color emoji", "segoe ui emoji", "noto sans", "emoji",
]);

function cleanFamily(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * Frameworks geram nomes internos ao otimizar fontes — `__totvsPro_80ca37`,
 * `__Inter_a1b2c3`. Não são o nome da tipografia, e não servem para a marca.
 */
function nomeInterno(family: string): boolean {
  return /^__/.test(family) || /_[0-9a-f]{6}$/i.test(family) || /^var\(/.test(family);
}

/** Sites modernos declaram `font-family: var(--body)`. Sem resolver, não se lê nada. */
function cssVariables(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    vars.set(match[1], match[2].trim());
  }
  return vars;
}

function resolveVar(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 3) return value;
  const match = /var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/.exec(value);
  if (!match) return value;
  const resolved = vars.get(match[1]) ?? match[2]?.trim() ?? "";
  return resolveVar(value.replace(match[0], resolved), vars, depth + 1);
}

export function extractFonts(css: string, html: string) {
  const counts = new Map<string, number>();
  const vars = cssVariables(css);

  for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const declarado = resolveVar(match[1], vars);
    const family = cleanFamily(declarado.split(",")[0]);
    if (!family || nomeInterno(family) || GENERIC.has(family.toLowerCase())) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  // Google Fonts é a pista mais confiável do que a marca escolheu. Pode vir num
  // <link> do HTML ou num @import dentro do próprio CSS.
  const googleFonts: string[] = [];
  for (const match of (html + "\n" + css).matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>)]+)/gi)) {
    for (const family of match[1].matchAll(/family=([^&:]+)/gi)) {
      const name = decodeURIComponent(family[1]).replace(/\+/g, " ").trim();
      if (name) googleFonts.push(name);
    }
  }

  for (const family of googleFonts) {
    counts.set(family, (counts.get(family) ?? 0) + 5);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family);

  // Família usada em títulos, quando declarada explicitamente.
  const headingRule = /(?:^|[},])\s*[^{}]*h[1-3][^{}]*\{[^}]*font-family\s*:\s*([^;}]+)/gi;
  let headline = "";
  for (const match of css.matchAll(headingRule)) {
    const family = cleanFamily(resolveVar(match[1], vars).split(",")[0]);
    if (family && !GENERIC.has(family.toLowerCase()) && !nomeInterno(family)) {
      headline = family;
      break;
    }
  }

  // Texto corrido raramente é monoespaçada ou display: essas costumam ser
  // usadas em rótulos e títulos, mesmo aparecendo muito no CSS.
  const ehTextoCorrido = (family: string) => !/(mono|serif|display|condensed)/i.test(family);
  const body =
    ranked.find((family) => family !== headline && ehTextoCorrido(family)) ||
    ranked.find((family) => family !== headline) ||
    ranked[0] ||
    "";

  return { headline: headline || ranked[0] || "", body, candidates: ranked.slice(0, 6) };
}

// --------------------------------------------------------------------- logo
export function extractLogo(html: string, baseUrl: string): DesignSystem["logo"] {
  const absolute = (href: string): string | null => {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  // 1. <img> que se identifica como logo — a pista mais direta.
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/logo|brand|marca/i.test(tag)) continue;
    const src = /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (src) {
      const url = absolute(src);
      if (url) return { url, kind: "img" };
    }
  }

  // 2. Ícones declarados no head, preferindo SVG e depois o maior tamanho.
  const icons: { href: string; size: number; svg: boolean }[] = [];
  for (const match of html.matchAll(/<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const tag = match[0];
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    const sizes = /sizes\s*=\s*["'](\d+)/i.exec(tag)?.[1];
    icons.push({ href, size: sizes ? Number(sizes) : 0, svg: /\.svg(\?|$)/i.test(href) });
  }
  icons.sort((a, b) => Number(b.svg) - Number(a.svg) || b.size - a.size);
  if (icons.length) {
    const url = absolute(icons[0].href);
    if (url) return { url, kind: icons[0].svg ? "svg" : "icon" };
  }

  // 3. Último recurso: a imagem social.
  const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  if (og) {
    const url = absolute(og);
    if (url) return { url, kind: "og" };
  }

  return null;
}

export function extractImages(html: string, baseUrl: string, limit = 6): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<img\b[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const tag = match[0];
    // Ícones, sprites e pixels de rastreio não servem como referência visual.
    if (/logo|icon|sprite|pixel|avatar|badge/i.test(tag)) continue;
    if (/\.svg(\?|$)/i.test(match[1])) continue;
    try {
      const url = new URL(match[1], baseUrl).toString();
      if (!found.includes(url)) found.push(url);
    } catch {
      /* src relativo inválido */
    }
    if (found.length >= limit) break;
  }
  return found;
}

// ------------------------------------------------------------------ coleta
const MAX_STYLESHEETS = 6;

/** Junta o CSS embutido com o das folhas externas, dentro de limites rígidos. */
export async function collectCss(html: string, baseUrl: string): Promise<{ css: string; count: number }> {
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const inlineAttrs = [...html.matchAll(/\sstyle\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).join(";\n");

  const hrefs: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel\s*=\s*["'][^"']*stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      hrefs.push(new URL(href, baseUrl).toString());
    } catch {
      /* href inválido */
    }
    if (hrefs.length >= MAX_STYLESHEETS) break;
  }

  const sheets = await Promise.all(
    hrefs.map(async (href) => {
      try {
        assertSafeUrl(href);
        return await fetchText(href, "text/css");
      } catch {
        return "";
      }
    }),
  );

  const loaded = sheets.filter(Boolean);
  return { css: [inline, inlineAttrs, ...loaded].join("\n"), count: loaded.length };
}

export async function extractDesignSystem(html: string, baseUrl: string): Promise<DesignSystem> {
  const { css, count } = await collectCss(html, baseUrl);
  return {
    colors: extractColors(css),
    fonts: extractFonts(css, html),
    logo: extractLogo(html, baseUrl),
    images: extractImages(html, baseUrl),
    stylesheets: count,
  };
}
