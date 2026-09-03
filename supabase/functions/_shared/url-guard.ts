/**
 * Leitura de URL no servidor com proteção contra SSRF.
 * Aceita apenas http/https, bloqueia rede interna e metadados de cloud,
 * limita redirecionamentos, tamanho e tempo. Nunca executa scripts da página.
 */
import { LIMITS, TIMEOUTS } from "./config.ts";
import { AppError, errors } from "./http.ts";

const BLOCKED_HOSTNAMES = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]",
  "metadata.google.internal", "metadata.goog", "instance-data",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;                              // 10.0.0.0/8
  if (a === 127) return true;                             // loopback
  if (a === 0) return true;                               // 0.0.0.0/8
  if (a === 169 && b === 254) return true;                // link-local e metadados
  if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT
  if (a === 192 && b === 0) return true;                  // 192.0.0.0/24
  if (a >= 224) return true;                              // multicast e reservado
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean === "::" || clean === "::1") return true;
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true;  // ULA fc00::/7
  if (clean.startsWith("fe80")) return true;                          // link-local

  // IPv4 mapeado. A URL do navegador normaliza ::ffff:127.0.0.1 para ::ffff:7f00:1,
  // então é preciso aceitar tanto a forma pontuada quanto a hexadecimal.
  if (clean.startsWith("::ffff:")) {
    const mapped = clean.slice(7);
    if (mapped.includes(".")) return isPrivateIPv4(mapped);
    const groups = mapped.split(":");
    if (groups.length === 2) {
      const high = Number.parseInt(groups[0], 16);
      const low = Number.parseInt(groups[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const dotted = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
        return isPrivateIPv4(dotted);
      }
    }
  }
  return false;
}

/**
 * Ninguém digita "https://" ao falar do próprio site. Normalizamos antes de
 * validar: tira espaços e aspas, completa o esquema e baixa o host.
 */
export function normalizeUrl(raw: string): string {
  let valor = raw.trim().replace(/^["'<]+|["'>]+$/g, "").trim();
  if (!valor) return "";

  // "https:/site.com" e "https//site.com" são erros de digitação comuns.
  valor = valor.replace(/^(https?):\/{1,}/i, "$1://").replace(/^(https?)\/{2}/i, "$1://");

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(valor)) {
    // Um esquema não-web escrito à mão não vira https à força.
    if (/^[a-z][a-z0-9+.-]*:/i.test(valor)) return valor;
    valor = `https://${valor}`;
  }

  try {
    const url = new URL(valor);
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    return url.toString();
  } catch {
    return valor;
  }
}

export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(normalizeUrl(rawUrl));
  } catch {
    throw errors.invalid("Endereço inválido. Use algo como suamarca.com.br");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw errors.invalid("Só conseguimos ler endereços http:// ou https://");
  }
  if (url.username || url.password) {
    throw errors.invalid("Endereços com usuário e senha não são aceitos.");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw errors.invalid("Esse endereço aponta para a rede interna e não pode ser lido.");
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw errors.invalid("Esse endereço aponta para a rede interna e não pode ser lido.");
  }
  if (!host.includes(".")) {
    throw errors.invalid("Endereço incompleto. Escreva o domínio inteiro, como suamarca.com.br");
  }

  return url;
}

/** Confere também o IP resolvido, quando o runtime permitir. */
async function assertSafeResolution(url: URL) {
  if (typeof Deno.resolveDns !== "function") return;
  try {
    const addresses = await Promise.allSettled([
      Deno.resolveDns(url.hostname, "A"),
      Deno.resolveDns(url.hostname, "AAAA"),
    ]);
    for (const result of addresses) {
      if (result.status !== "fulfilled") continue;
      for (const address of result.value) {
        if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
          throw errors.invalid("Esse endereço resolve para a rede interna e não pode ser lido.");
        }
      }
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Sem permissão de DNS no runtime: seguimos com a validação por hostname.
  }
}

/**
 * Busca protegida: valida a URL, segue no máximo 3 redirecionamentos
 * revalidando cada salto, limita tempo e tamanho. Nada é executado.
 */
async function fetchGuarded(
  rawUrl: string,
  accept: string,
  aceitaTipo: (contentType: string) => boolean,
  maxBytes: number = LIMITS.maxUrlBytes,
): Promise<{ url: string; body: string }> {
  let current = assertSafeUrl(rawUrl);
  await assertSafeResolution(current);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUTS.fetchUrlMs);

  try {
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "CreatvOS/1.0 (+https://www.creatv.com.br)",
          Accept: accept,
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw errors.invalid("A página respondeu com um redirecionamento inválido.");
        await response.body?.cancel();
        current = assertSafeUrl(new URL(location, current).toString());
        await assertSafeResolution(current);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw errors.invalid(`A página respondeu ${response.status}. Você pode preencher os dados manualmente.`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!aceitaTipo(contentType)) {
        await response.body?.cancel();
        throw errors.invalid("Esse endereço não devolveu o conteúdo esperado.");
      }

      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > maxBytes) {
        await response.body?.cancel();
        throw errors.invalid("O conteúdo é grande demais para ser lido.");
      }

      return { url: current.toString(), body: await readLimited(response, maxBytes) };
    }

    throw errors.invalid("A página redirecionou vezes demais.");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicPage(rawUrl: string): Promise<{ url: string; html: string }> {
  try {
    const { url, body } = await fetchGuarded(
      rawUrl,
      "text/html,application/xhtml+xml",
      (type) => type.includes("html") || type.includes("text"),
    );
    return { url, html: body };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw errors.invalid("A página demorou demais para responder. Preencha os dados manualmente.");
    }
    throw errors.invalid("Não conseguimos ler essa página. Preencha os dados manualmente.");
  }
}

/** Baixa uma imagem pública (logo do site) com os mesmos limites. */
export async function fetchImage(
  rawUrl: string,
  maxBytes = 3_000_000,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const url = assertSafeUrl(rawUrl);
    await assertSafeResolution(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.fetchUrlMs);
    try {
      const response = await fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "CreatvOS/1.0 (+https://www.creatv.com.br)", Accept: "image/*" },
      });
      if (!response.ok) return null;

      const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!/^image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(mimeType)) return null;

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes || buffer.byteLength === 0) return null;

      return { bytes: new Uint8Array(buffer), mimeType };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** Usada para CSS e para os JSON públicos do Shopify. Devolve "" em falha. */
export async function fetchText(rawUrl: string, expectedType: string, maxBytes = 400_000): Promise<string> {
  try {
    const { body } = await fetchGuarded(
      rawUrl,
      expectedType,
      (type) => type.includes(expectedType.split("/")[1]) || type.includes("text") || type.includes("json"),
      maxBytes,
    );
    return body;
  } catch {
    return "";
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  await reader.cancel().catch(() => undefined);

  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.length) break;
    merged.set(chunk.subarray(0, merged.length - offset), offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Extração puramente textual — o HTML nunca é executado nem renderizado. */
export function extractPageFacts(html: string) {
  const meta = (pattern: RegExp): string => {
    const match = pattern.exec(html);
    return match?.[1]?.trim() ?? "";
  };

  // Páginas em português vêm cheias de entidades acentuadas; sem decodificar,
  // o modelo recebe "gr&aacute;tis" em vez de "grátis".
  const NAMED: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", agrave: "à", atilde: "ã", acirc: "â",
    eacute: "é", ecirc: "ê", iacute: "í",
    oacute: "ó", otilde: "õ", ocirc: "ô",
    uacute: "ú", uuml: "ü", ccedil: "ç",
    Aacute: "Á", Atilde: "Ã", Acirc: "Â", Eacute: "É", Ecirc: "Ê",
    Iacute: "Í", Oacute: "Ó", Otilde: "Õ", Ocirc: "Ô", Uacute: "Ú", Ccedil: "Ç",
    hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", reg: "®", copy: "©", trade: "™",
  };

  const decode = (value: string) =>
    value
      .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED[name] ?? match)
      .trim();

  const title = decode(meta(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i));
  const description = decode(
    meta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,600})["']/i) ||
      meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,600})["']/i),
  );
  const ogTitle = decode(meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{0,300})["']/i));
  const ogImage = decode(meta(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{0,600})["']/i));
  const siteName = decode(meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{0,200})["']/i));

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const headings = Array.from(withoutScripts.matchAll(/<h[1-3][^>]*>([\s\S]{0,200}?)<\/h[1-3]>/gi))
    .map((match) => decode(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")))
    .filter((text) => text.length > 2)
    .slice(0, 25);

  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  return { title, description, ogTitle, ogImage, siteName, headings, text: decode(text) };
}
