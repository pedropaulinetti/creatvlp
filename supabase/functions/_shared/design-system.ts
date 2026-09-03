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
import { fetchText, assertSafeUrl, decodeDataUrlText } from "./url-guard.ts";

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

// ------------------------------------------------- variáveis do CSS
/**
 * Sites modernos declaram cor e tipografia em `var(--token)`. Sem resolver a
 * variável, não se lê nem a paleta nem a fonte.
 */
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

/**
 * Croma: a distância entre o canal mais forte e o mais fraco.
 *
 * Serve melhor que saturação HSL para separar cor de marca de cinza. Um
 * cinza-azulado como #CBD5E0 tem saturação HSL alta (0.25) só porque é claro,
 * mas croma baixo (0.08) — e é cinza de interface, não identidade.
 */
function chroma(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Tons quase iguais viram um só: senão a paleta sai com 12 azuis. */
const SIMILAR = 34;

/** Abaixo disso a cor é estrutura — fundo, texto, borda — não identidade. */
const NEUTRO = 0.09;

const ehNeutra = (hex: string) => chroma(hex) < NEUTRO;

/** Lê o valor de um token: um literal de cor isolado, não um CSS inteiro. */
function corLiteral(raw: string): string | null {
  const valor = raw.trim();

  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(valor);
  if (hex) return expandHex(hex[1]);

  const rgb = new RegExp(RGB.source).exec(valor);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 0.35) return null;
    return toHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  const hsl = new RegExp(HSL.source).exec(valor);
  if (hsl) {
    if (hsl[4] !== undefined && Number(hsl[4]) < 0.35) return null;
    return hslToHex(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
  }

  return null;
}

/*
 * Nem todo token diz algo sobre a marca. Tailwind, Bootstrap e companhia
 * despejam centenas de variáveis internas no CSS compilado; sombra, anel de
 * foco e scrollbar são decisão de componente, não de identidade.
 */
const TOKEN_RUIDO = /^--(tw|swiper|bs|mdb|ion|van|el|q|wp|elementor)-/i;
const TOKEN_ESTRUTURA =
  /(^|-)(ring|shadow|scrollbar|selection|highlight|overlay|backdrop|skeleton|placeholder|disabled|focus)(-|$)/i;

/** Nome que declara intenção de marca — vale mais que qualquer contagem. */
const TOKEN_MARCA = /(^|-)(brand|marca|primary|primaria|accent|acento|core|main|theme)(-|\d|$)/i;

/**
 * Cores declaradas como variável CSS, com a informação de o nome citar a marca.
 *
 * É o sinal mais confiável que existe: quem escreve `--colors-brand-core-P`
 * está dizendo qual é a cor da marca. Contar ocorrência no CSS compilado não
 * diz isso — diz só qual tom a interface repete mais.
 */
export function colorTokens(css: string): Map<string, boolean> {
  const vars = cssVariables(css);
  const tokens = new Map<string, boolean>();

  for (const [nome, bruto] of vars) {
    if (TOKEN_RUIDO.test(nome) || TOKEN_ESTRUTURA.test(nome)) continue;
    const hex = corLiteral(resolveVar(bruto, vars));
    if (!hex) continue;
    const marca = TOKEN_MARCA.test(nome);
    // Um mesmo hex pode ter vários nomes: basta um citar a marca.
    tokens.set(hex, (tokens.get(hex) ?? false) || marca);
  }

  return tokens;
}

export function extractColors(css: string, limit = 10): ExtractedColor[] {
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

  const tokens = colorTokens(css);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // Agrupa tons próximos, somando as ocorrências. O representante do grupo é a
  // cor declarada em token, quando existe: é a que a marca escolheu, não a
  // variação que o CSS por acaso repete mais.
  const grouped: { hex: string; count: number }[] = [];
  for (const [hex, count] of ordered) {
    const near = grouped.find((item) => distance(item.hex, hex) < SIMILAR);
    if (!near) {
      grouped.push({ hex, count });
      continue;
    }
    near.count += count;
    if (!tokens.has(near.hex) && tokens.has(hex)) near.hex = hex;
  }

  const fundo = grouped.find((item) => ehNeutra(item.hex) && luminance(item.hex) > 0.82);
  const texto = grouped.find((item) => ehNeutra(item.hex) && luminance(item.hex) < 0.22);

  /*
   * O piso de luminância existe só para descartar preto e branco. Um azul
   * marinho de marca tem luminância 0.03 e croma 0.32 — quem separa cor de
   * estrutura aqui é o croma, não o brilho.
   */
  const candidatas = grouped.filter(
    (item) => !ehNeutra(item.hex) && luminance(item.hex) > 0.012 && luminance(item.hex) < 0.96,
  );

  /*
   * Duas origens, com critérios diferentes.
   *
   * Declarada: existe um token do design system apontando para ela. O que vale
   * é a escolha, não a repetição — o CSS compilado repete tint de interface
   * muito mais que a cor núcleo. Ordena por nome de marca e depois por croma,
   * que é o que separa a cor cheia dos seus tons claros.
   *
   * Inferida: a cor só aparece no uso. Aí a repetição é o único sinal que há.
   */
  const declaradas = candidatas
    .filter((item) => tokens.has(item.hex))
    .sort(
      (a, b) =>
        Number(tokens.get(b.hex)) - Number(tokens.get(a.hex)) ||
        chroma(b.hex) - chroma(a.hex) ||
        b.count - a.count,
    );

  // Uma ocorrência solta costuma ser azul de link do navegador ou cor de
  // estado, não identidade. Só se aceita cor de uso único quando não há
  // nenhuma outra pista — nem token, nem repetição.
  const MIN_USOS = 3;
  const usadas = candidatas.filter((item) => !tokens.has(item.hex));
  const relevantes = usadas.filter((item) => item.count >= MIN_USOS);
  /*
   * Croma multiplica em vez de somar. Somando, um cinza estrutural muito usado
   * — o `slate-700` do Tailwind, croma 0.11, em catorze lugares — vencia a cor
   * da marca usada sete vezes. Multiplicando, repetição só conta quando há cor
   * de verdade para repetir.
   */
  const inferidas = (relevantes.length || declaradas.length ? relevantes : usadas).sort(
    (a, b) => b.count * chroma(b.hex) - a.count * chroma(a.hex),
  );

  return montarPaleta([...declaradas, ...inferidas], fundo, texto, limit);
}

/** Papéis e teto: fundo e texto sempre cabem, o resto é paleta de marca. */
function montarPaleta(
  marca: { hex: string; count: number }[],
  fundo: { hex: string; count: number } | undefined,
  texto: { hex: string; count: number } | undefined,
  limit: number,
): ExtractedColor[] {
  const teto = Math.max(1, limit - (fundo ? 1 : 0) - (texto ? 1 : 0));
  const result: ExtractedColor[] = marca.slice(0, teto).map((item, index) => ({
    hex: item.hex,
    count: item.count,
    role: index === 0 ? "primaria" : index === 1 ? "secundaria" : "apoio",
    label: "",
  }));

  if (fundo) result.push({ hex: fundo.hex, count: fundo.count, role: "fundo", label: "" });
  if (texto) result.push({ hex: texto.hex, count: texto.count, role: "texto", label: "" });

  return result.slice(0, limit);
}

/**
 * Cores de dentro do SVG do logo.
 *
 * É a paleta mais limpa que existe no site: o logo não tem tint de interface,
 * nem cinza de borda, nem cor de estado. Só o que a marca é.
 */
export function extractSvgColors(svg: string, limit = 6): string[] {
  const counts = new Map<string, number>();

  for (const match of svg.matchAll(
    /(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/gi,
  )) {
    const hex = corLiteral(match[1]);
    if (!hex || ehNeutra(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  const agrupadas: string[] = [];
  for (const [hex] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (agrupadas.some((outra) => distance(outra, hex) < SIMILAR)) continue;
    agrupadas.push(hex);
    if (agrupadas.length >= limit) break;
  }

  return agrupadas;
}

/**
 * Junta as cores do logo à paleta, com o logo na frente.
 *
 * O logo lidera porque é o único lugar do site onde só existe marca: nada de
 * cinza de borda, tint de botão ou cor de estado. Medido no vibiz.com.br, a
 * paleta do CSS elegia um amarelo de ícone como primária enquanto o verde do
 * logo ficava em terceiro.
 *
 * Logo monocromático não tem cor a oferecer — as neutras já foram descartadas
 * antes — e nesse caso nada aqui muda a paleta.
 */
export function mergeLogoColors(
  paleta: ExtractedColor[],
  doLogo: string[],
  limit = 10,
): ExtractedColor[] {
  if (!doLogo.length) return paleta;

  const estrutura = paleta.filter((cor) => cor.role === "fundo" || cor.role === "texto");
  const marca = paleta
    .filter((cor) => cor.role !== "fundo" && cor.role !== "texto")
    .map((cor) => ({ hex: cor.hex, count: cor.count }));

  // A cor do logo que o CSS já tinha mantém a contagem: ela diz o quanto a
  // marca se apoia naquele tom, e é o desempate entre as cores do próprio logo.
  const doLogoOrdenado = doLogo.map((hex) => ({
    hex,
    count: marca.find((cor) => distance(cor.hex, hex) < SIMILAR)?.count ?? 1,
  }));
  const resto = marca.filter((cor) => !doLogo.some((hex) => distance(cor.hex, hex) < SIMILAR));

  return montarPaleta(
    [...doLogoOrdenado, ...resto],
    estrutura.find((cor) => cor.role === "fundo"),
    estrutura.find((cor) => cor.role === "texto"),
    limit,
  );
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
/**
 * Procura `logo` num bloco schema.org, incluindo dentro de `@graph`.
 *
 * O valor pode vir como texto ou como um ImageObject com `url` — as duas formas
 * são comuns e as duas são válidas.
 */
function logoDoJsonLd(html: string): string | null {
  for (const bloco of html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let dados: unknown;
    try {
      dados = JSON.parse(bloco[1].trim());
    } catch {
      continue; // JSON-LD malformado é comum; não é motivo para parar
    }

    const achado = procurarLogo(dados, 0);
    if (achado) return achado;
  }
  return null;
}

function procurarLogo(valor: unknown, profundidade: number): string | null {
  if (profundidade > 5 || !valor || typeof valor !== "object") return null;

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = procurarLogo(item, profundidade + 1);
      if (achado) return achado;
    }
    return null;
  }

  const objeto = valor as Record<string, unknown>;
  const logo = objeto.logo;
  if (typeof logo === "string" && logo.trim()) return logo.trim();
  if (logo && typeof logo === "object") {
    const url = (logo as Record<string, unknown>).url;
    if (typeof url === "string" && url.trim()) return url.trim();
  }

  for (const item of Object.values(objeto)) {
    const achado = procurarLogo(item, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

/**
 * O logo, por ordem de confiança do sinal.
 *
 * A ordem existe porque as pistas têm qualidade muito diferente: um `<img>` que
 * se diz logo é quase sempre o logo; um favicon costuma ser o logo recortado; a
 * imagem social pode ser qualquer banner de campanha.
 */
export function extractLogo(html: string, baseUrl: string): DesignSystem["logo"] {
  const absolute = (href: string): string | null => {
    // `data:` já é o conteúdo: não há o que resolver contra a base.
    if (/^data:/i.test(href)) return href;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  const src = (tag: string) => /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);

  /*
   * 1. O logo declarado em JSON-LD.
   *
   * Nada supera o dono do site dizendo qual é o logo dele. Vale ainda mais em
   * página de aplicação, onde o cabeçalho é montado no navegador e o HTML
   * inicial não tem `<img>` nenhum — o schema.org é a única pista que sobra.
   */
  const declarado = logoDoJsonLd(html);
  if (declarado) {
    const url = absolute(declarado);
    if (url) return { url, kind: /\.svg(\?|$)/i.test(url) ? "svg" : "img" };
  }

  // 2. <img> que se identifica como logo — em src, alt, class ou id.
  for (const tag of imgs) {
    if (!/logo|brand|marca/i.test(tag)) continue;
    const url = src(tag) && absolute(src(tag)!);
    if (url) return { url, kind: /^data:/i.test(url) ? "svg" : "img" };
  }

  /*
   * 3. Primeiro SVG embutido em `data:`.
   *
   * Frameworks modernos publicam o logo assim, sem nenhuma palavra que o
   * identifique. Um SVG inline no topo da página é, na prática, sempre a marca:
   * ilustração de conteúdo vem em JPG ou WebP, não vetorizada no HTML.
   */
  for (const tag of imgs.slice(0, 4)) {
    const valor = src(tag);
    if (valor && /^data:image\/svg\+xml/i.test(valor)) return { url: valor, kind: "svg" };
  }

  // 4. Ícones declarados no head, preferindo SVG e depois o maior tamanho.
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

  // 5. Último recurso: a imagem social.
  const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  if (og) {
    const url = absolute(og);
    if (url) return { url, kind: "og" };
  }

  return null;
}

/** Imagem escondida ou de um pixel: rastreio de campanha, nunca conteúdo. */
function ehInvisivel(tag: string): boolean {
  if (/style\s*=\s*["'][^"']*display\s*:\s*none/i.test(tag)) return true;
  for (const atributo of ["width", "height"]) {
    const valor = new RegExp(`\\s${atributo}\\s*=\\s*["']?(\\d+)`, "i").exec(tag)?.[1];
    if (valor && Number(valor) < 8) return true;
  }
  return false;
}

/*
 * Onde uma imagem pode estar escondida numa tag.
 *
 * `src` é o caso simples. Carregamento preguiçoso guarda o endereço de verdade
 * num `data-*` e deixa no `src` um placeholder de um pixel — quem lê só `src`
 * leva o placeholder.
 */
const ATRIBUTOS_DE_IMAGEM = [
  "src", "data-src", "data-lazy-src", "data-original", "data-image", "data-bg", "data-background",
];

/** De um `srcset`, o maior candidato: referência de marca quer a maior resolução. */
function doSrcset(tag: string): string | null {
  const bruto = /(?:^|\s)(?:data-)?srcset\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  if (!bruto) return null;

  let melhor: { url: string; peso: number } | null = null;
  for (const parte of bruto.split(",")) {
    const [url, descritor] = parte.trim().split(/\s+/);
    if (!url) continue;
    const peso = Number(/^(\d+(?:\.\d+)?)(w|x)$/.exec(descritor ?? "")?.[1] ?? 1);
    if (!melhor || peso > melhor.peso) melhor = { url, peso };
  }
  return melhor?.url ?? null;
}

/**
 * As imagens da página, de todos os lugares onde elas se escondem.
 *
 * `incluirSocial` decide se, na falta de qualquer imagem, vale cair para a
 * imagem social. Quem quer saber se a página *tem* imagem — para decidir se
 * precisa renderizá-la — precisa perguntar sem esse recurso, senão a resposta
 * é sempre "tem".
 */
export function extractImages(
  html: string,
  baseUrl: string,
  limit = 24,
  incluirSocial = true,
): string[] {
  const found: string[] = [];
  // A mesma foto costuma aparecer em vários tamanhos, mudando só a query.
  // Guardar as duas seria pagar duas vezes pela mesma referência.
  const vistas = new Set<string>();

  const add = (bruto: string | null | undefined) => {
    if (!bruto || found.length >= limit) return;
    const valor = bruto.trim();
    if (!valor || /^data:/i.test(valor) || /\.svg(\?|$)/i.test(valor)) return;
    if (/logo|sprite|pixel|avatar|badge|placeholder|blank\./i.test(valor)) return;

    let url: URL;
    try {
      url = new URL(valor, baseUrl);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const identidade = url.origin + url.pathname;
    if (vistas.has(identidade)) return;
    vistas.add(identidade);
    found.push(url.toString());
  };

  for (const match of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = match[0];
    // Ícones, sprites e pixels de rastreio não servem como referência visual.
    if (/logo|icon|sprite|pixel|avatar|badge/i.test(tag)) continue;
    if (ehInvisivel(tag)) continue;

    add(doSrcset(tag));
    for (const atributo of ATRIBUTOS_DE_IMAGEM) {
      const valor = new RegExp(`(?:^|\\s)${atributo}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
      if (valor) add(valor);
    }
  }

  // Imagem de fundo declarada no próprio HTML — costuma ser o banner principal.
  for (const match of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)/gi)) {
    add(match[1]);
  }

  // Imagem que a página manda o navegador buscar antes de tudo: é a de destaque.
  for (const match of html.matchAll(/<link\b[^>]*rel=["']preload["'][^>]*>/gi)) {
    if (!/as\s*=\s*["']image["']/i.test(match[0])) continue;
    add(/href\s*=\s*["']([^"']+)["']/i.exec(match[0])?.[1]);
  }

  /*
   * Página de aplicação não traz imagem no HTML inicial — o conteúdo é montado
   * no navegador. A imagem social é feita à mão pela marca e é a única
   * referência visual que sobra nesses casos.
   */
  if (!found.length && incluirSocial) {
    add(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1],
    );
  }

  return found;
}

// ------------------------------------------------------------------ coleta

/*
 * Sites grandes espalham o design system por muitas folhas, e a principal
 * costuma passar de meio megabyte. Os limites antigos — 6 folhas, 400 KB cada —
 * descartavam justamente a folha onde a paleta está declarada.
 */
const MAX_STYLESHEETS = 12;
const MAX_BYTES_POR_FOLHA = 900_000;
const MAX_BYTES_TOTAL = 3_000_000;

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
      const absoluta = new URL(href, baseUrl).toString();
      if (!hrefs.includes(absoluta)) hrefs.push(absoluta);
    } catch {
      /* href inválido */
    }
    if (hrefs.length >= MAX_STYLESHEETS) break;
  }

  const sheets = await Promise.all(
    hrefs.map(async (href) => {
      try {
        assertSafeUrl(href);
        return await fetchText(href, "text/css", MAX_BYTES_POR_FOLHA);
      } catch {
        return "";
      }
    }),
  );

  // Teto total: uma folha gigante não pode estourar a memória da função.
  const loaded: string[] = [];
  let bytes = 0;
  for (const sheet of sheets) {
    if (!sheet) continue;
    if (bytes + sheet.length > MAX_BYTES_TOTAL) break;
    bytes += sheet.length;
    loaded.push(sheet);
  }

  return { css: [inline, inlineAttrs, ...loaded].join("\n"), count: loaded.length };
}

/**
 * Cada etapa da leitura é anunciada assim que termina.
 *
 * Existe para que a tela de onboarding mostre a paleta caindo, a tipografia
 * trocando e o logo chegando no ritmo em que são descobertos, em vez de ficar
 * parada até o fim. Quem não quer acompanhar simplesmente não passa a função.
 */
export type PassoDesign =
  | { etapa: "estilos"; folhas: number }
  | { etapa: "paleta"; cores: ExtractedColor[] }
  | { etapa: "tipografia"; fonts: DesignSystem["fonts"] }
  | { etapa: "logo"; logo: DesignSystem["logo"] };

export async function extractDesignSystem(
  html: string,
  baseUrl: string,
  aoAvancar: (passo: PassoDesign) => void = () => {},
): Promise<DesignSystem> {
  const { css, count } = await collectCss(html, baseUrl);
  aoAvancar({ etapa: "estilos", folhas: count });

  const doCss = extractColors(css);
  aoAvancar({ etapa: "paleta", cores: doCss });

  const fonts = extractFonts(css, html);
  aoAvancar({ etapa: "tipografia", fonts });

  const logo = extractLogo(html, baseUrl);
  aoAvancar({ etapa: "logo", logo });

  // O logo reordena e completa a paleta: ela é anunciada de novo.
  const colors = await comCoresDoLogo(doCss, logo);
  if (colors !== doCss) aoAvancar({ etapa: "paleta", cores: colors });

  return { colors, fonts, logo, images: extractImages(html, baseUrl), stylesheets: count };
}

/**
 * Quando o logo é SVG, ele é lido como texto e as cores dele lideram a paleta.
 *
 * Falha na leitura não é erro: a paleta do CSS já está pronta.
 */
async function comCoresDoLogo(
  paleta: ExtractedColor[],
  logo: DesignSystem["logo"],
): Promise<ExtractedColor[]> {
  if (logo?.kind !== "svg") return paleta;

  try {
    const svg = /^data:/i.test(logo.url)
      ? decodeDataUrlText(logo.url)
      : (assertSafeUrl(logo.url), await fetchText(logo.url, "image/svg+xml", 200_000));

    return svg ? mergeLogoColors(paleta, extractSvgColors(svg)) : paleta;
  } catch {
    return paleta;
  }
}
