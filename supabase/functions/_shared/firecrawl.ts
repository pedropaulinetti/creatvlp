/**
 * Leitor de reserva para sites feitos em JavaScript.
 *
 * A leitura direta resolve a grande maioria dos casos (medida em 8 de 8 sites
 * brasileiros reais). Ela falha quando a página só monta o conteúdo no
 * navegador — aí o HTML vem praticamente vazio. Nesse caso, e só nesse caso,
 * pedimos ao Firecrawl o HTML já renderizado.
 *
 * Vale notar o limite: o Firecrawl devolve HTML e markdown, não CSS. A paleta
 * e a tipografia continuam saindo das folhas de estilo, que buscamos depois.
 *
 * Sem FIRECRAWL_API_KEY configurada, nada disso roda e o fluxo segue igual.
 */
const KEY = Deno.env.get("FIRECRAWL_API_KEY")?.trim() ?? "";
const BASE = Deno.env.get("FIRECRAWL_BASE_URL")?.trim() || "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = Number(Deno.env.get("FIRECRAWL_TIMEOUT_MS") ?? "45000");

export const firecrawlEnabled = () => KEY.length > 0;

/**
 * Uma página server-side rendered traz corpo e títulos no HTML inicial.
 * Muito pouco disso é o sinal de que o conteúdo depende de JavaScript.
 */
export function pareceVazia(html: string): boolean {
  const semScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const titulos = (html.match(/<h[1-3][^>]*>/gi) ?? []).length;
  return semScripts.length < 600 || titulos === 0;
}

export async function fetchRendered(url: string): Promise<string> {
  if (!KEY) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}/scrape`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["rawHtml"],
        onlyMainContent: false,
        timeout: TIMEOUT_MS,
      }),
    });

    if (!response.ok) {
      console.error("firecrawl_falhou", response.status);
      return "";
    }

    const payload = await response.json();
    return String(payload?.data?.rawHtml ?? payload?.data?.html ?? "");
  } catch (error) {
    console.error("firecrawl_erro", error instanceof Error ? error.message.slice(0, 120) : "desconhecido");
    return "";
  } finally {
    clearTimeout(timer);
  }
}
