/**
 * Importa a loja direto do Shopify.
 *
 * Toda loja Shopify publica `/products.json` sem autenticação — produtos com
 * título, descrição, tipo, tags, preço, disponibilidade e imagens. É um dado
 * estruturado de verdade, muito melhor do que adivinhar produto lendo a página.
 *
 * Não exige app, chave nem OAuth: o lojista só cola o endereço da loja.
 */
import { fetchText } from "./url-guard.ts";

export type ShopifyProduct = {
  name: string;
  description: string;
  price_cents: number | null;
  url: string;
  image: string | null;
  highlights: string[];
  available: boolean;
};

export type ShopifyStore = {
  isShopify: boolean;
  vendor: string;
  currency: string;
  products: ShopifyProduct[];
  productTypes: string[];
  total: number;
};

const EMPTY: ShopifyStore = { isShopify: false, vendor: "", currency: "BRL", products: [], productTypes: [], total: 0 };

/** Sinais no HTML. Confirmação real vem da resposta do /products.json. */
export function looksLikeShopify(html: string): boolean {
  return (
    /cdn\.shopify\.com/i.test(html) ||
    /Shopify\.theme/i.test(html) ||
    /shopify-section/i.test(html) ||
    /myshopify\.com/i.test(html) ||
    /window\.Shopify/i.test(html)
  );
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function toCents(price: unknown): number | null {
  const value = Number(String(price ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * As tags do Shopify muitas vezes carregam metadado interno
 * ("allbirds::cfId => ..."). Só entram as que parecem legíveis por humano.
 */
export function usefulTags(tags: unknown, limit = 4): string[] {
  const list = Array.isArray(tags)
    ? tags.map(String)
    : typeof tags === "string"
      ? tags.split(",")
      : [];
  return list
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (tag.length < 2 || tag.length > 40) return false;
      if (tag.includes("::") || tag.includes("=>")) return false;      // metadado de app
      if (/\d{4,}/.test(tag)) return false;                            // código interno
      if (/^[A-Za-z]+_/.test(tag)) return false;                        // prefixo de namespace interno
      // Etiquetas operacionais são escritas em caixa alta e sigla.
      const letras = tag.replace(/[^a-zA-ZÀ-ÿ]/g, "");
      if (letras.length > 1 && letras === letras.toUpperCase()) return false;
      return true;
    })
    .slice(0, limit);
}

/** O Shopify publica a moeda ativa no próprio HTML da loja. */
export function detectCurrency(html: string): string {
  const match =
    /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(html) ||
    /["']currency["']\s*:\s*["']([A-Z]{3})["']/.exec(html);
  return match?.[1] ?? "BRL";
}

export async function importShopifyStore(baseUrl: string, limit = 12, currency = "BRL"): Promise<ShopifyStore> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return EMPTY;
  }

  const raw = await fetchText(`${origin}/products.json?limit=${Math.min(limit, 50)}`, "application/json", 800_000);
  if (!raw) return EMPTY;

  let payload: { products?: unknown[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return EMPTY;
  }

  const rows = Array.isArray(payload.products) ? payload.products : null;
  if (!rows) return EMPTY;

  const products: ShopifyProduct[] = [];
  const types = new Set<string>();
  let vendor = "";

  for (const item of rows.slice(0, limit)) {
    const product = item as Record<string, any>;
    const name = String(product.title ?? "").trim();
    if (!name) continue;

    if (!vendor && product.vendor) vendor = String(product.vendor).trim();
    if (product.product_type) types.add(String(product.product_type).trim());

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const first = variants[0] ?? {};
    const images = Array.isArray(product.images) ? product.images : [];

    products.push({
      name,
      description: stripHtml(String(product.body_html ?? "")).slice(0, 600),
      price_cents: toCents(first.price),
      url: product.handle ? `${origin}/products/${product.handle}` : origin,
      image: images[0]?.src ? String(images[0].src) : null,
      highlights: usefulTags(product.tags),
      available: variants.some((variant: Record<string, unknown>) => variant.available === true),
    });
  }

  return {
    isShopify: products.length > 0,
    vendor,
    currency,
    products,
    productTypes: [...types].filter(Boolean).slice(0, 8),
    total: rows.length,
  };
}
