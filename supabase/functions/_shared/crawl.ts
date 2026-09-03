/**
 * Escolhe outras páginas do mesmo site para ler.
 *
 * A home diz o que a marca é; quem diz o que ela vende costuma ser a página de
 * produtos, de planos ou de serviços. E em site feito como aplicação a home mal
 * tem imagem — as fotos de verdade estão nas páginas internas.
 *
 * Ler o site inteiro seria caro e lento sem ganho: três páginas bem escolhidas
 * cobrem o que interessa. A escolha é por palavra no caminho, não por posição no
 * menu, porque menu é marcação e caminho é intenção.
 */

/** Caminhos que costumam dizer o que a marca vende. Peso maior, lido antes. */
const VALIOSOS: [RegExp, number][] = [
  [/(^|\/)(produtos?|products?|catalogo|catalog|shop|loja|collections?)(\/|$)/i, 10],
  [/(^|\/)(planos?|pricing|precos|preco|assine|assinatura)(\/|$)/i, 9],
  [/(^|\/)(servicos?|services?|solucoes?|solutions?)(\/|$)/i, 8],
  [/(^|\/)(sobre|about|quem-somos|empresa|institucional)(\/|$)/i, 6],
  [/(^|\/)(funcionalidades|features|recursos|plataforma|platform)(\/|$)/i, 5],
];

/** Caminhos que nunca ajudam a descrever a marca. */
const INUTEIS =
  /(^|\/)(blog|noticias?|news|politica|privacidade|privacy|termos?|terms|cookies|login|entrar|cadastro|signup|conta|account|carrinho|cart|checkout|ajuda|help|suporte|support|vagas|careers|trabalhe|imprensa|press|sitemap|feed|rss)(\/|$)/i;

const EXTENSAO_DE_ARQUIVO = /\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|mp3|xml|json|css|js)(\?|$)/i;

export function escolherPaginas(html: string, baseUrl: string, limite = 3): string[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const pontuadas = new Map<string, number>();

  for (const match of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const bruto = match[1].trim();
    if (!bruto || /^(#|mailto:|tel:|javascript:|data:)/i.test(bruto)) continue;

    let url: URL;
    try {
      url = new URL(bruto, base);
    } catch {
      continue;
    }

    // Só o mesmo site: subdomínio de terceiro não é a marca.
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    url.hash = "";
    const caminho = url.pathname;
    if (caminho === base.pathname || caminho === "/" || caminho === "") continue;
    if (INUTEIS.test(caminho) || EXTENSAO_DE_ARQUIVO.test(caminho)) continue;

    // Caminho fundo demais costuma ser um item, não uma seção.
    const profundidade = caminho.split("/").filter(Boolean).length;
    if (profundidade > 3) continue;

    let peso = 1;
    for (const [padrao, valor] of VALIOSOS) {
      if (padrao.test(caminho)) {
        peso = Math.max(peso, valor);
        break;
      }
    }

    const endereco = url.toString();
    pontuadas.set(endereco, Math.max(pontuadas.get(endereco) ?? 0, peso));
  }

  return [...pontuadas.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limite)
    .map(([endereco]) => endereco);
}
