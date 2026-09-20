/**
 * O catálogo da marca, venha ele de onde vier.
 *
 * A primeira versão só sabia ler loja Shopify, pelo `/products.json`. Funciona
 * muito bem — e não cobre quase nada: VTEX, Nuvemshop, Magento, WooCommerce,
 * Tray e loja feita à mão ficavam sem catálogo, e o produto acabava vindo do
 * modelo de texto: nome e descrição, sem preço e sem foto. Sem foto de produto
 * a peça inventa o objeto, que é justamente o que não pode acontecer.
 *
 * A saída não é escrever um leitor por plataforma. Todas elas publicam o mesmo
 * dado, pelo mesmo motivo: o Google exige `schema.org/Product` em JSON-LD para
 * o produto aparecer na busca com foto e preço. É um dado estruturado, público
 * e padronizado — a mesma natureza do `/products.json`, só que universal.
 *
 * A ordem é por qualidade do dado: Shopify primeiro, porque traz variante,
 * disponibilidade e descrição inteira; JSON-LD depois, porque traz o essencial
 * de qualquer loja. Nunca as duas, para não duplicar o mesmo produto.
 */
import { looksLikeShopify, importShopifyStore, dominioDaLoja, detectCurrency, stripHtml, toCents, usefulTags } from "./shopify.ts";
import type { ShopifyProduct } from "./shopify.ts";

/** O produto é o mesmo objeto, qualquer que tenha sido a origem. */
export type ProdutoDoCatalogo = ShopifyProduct;

export type Catalogo = {
  /** De onde veio — muda o que se pode prometer sobre preço e estoque. */
  fonte: "shopify" | "pagina" | "";
  vendor: string;
  currency: string;
  products: ProdutoDoCatalogo[];
  productTypes: string[];
};

const VAZIO: Catalogo = { fonte: "", vendor: "", currency: "BRL", products: [], productTypes: [] };

/** Os tipos do schema.org que descrevem uma coisa vendida. */
const TIPO_DE_PRODUTO = /^(Product|ProductGroup|ProductModel|IndividualProduct)$/i;

/** Teto de nós visitados: JSON-LD de vitrine grande é fundo, mas não infinito. */
const MAX_NOS = 20_000;

type No = Record<string, unknown>;

function comoTexto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * A imagem aparece de três jeitos no schema.org: endereço solto, lista de
 * endereços ou `ImageObject`. Vale a primeira que existir.
 */
/**
 * Todas as imagens declaradas, na ordem.
 *
 * O schema.org aceita as três formas: endereço solto, lista de endereços ou
 * `ImageObject`. Pegar só a primeira descartava as outras fotos do produto,
 * que são justamente o que dá ao modelo mais de um ângulo do mesmo objeto.
 */
function todasAsImagens(valor: unknown): string[] {
  if (typeof valor === "string") return valor.trim() ? [valor.trim()] : [];
  if (Array.isArray(valor)) return valor.flatMap(todasAsImagens);
  if (valor && typeof valor === "object") {
    const endereco = comoTexto((valor as No).url);
    return endereco ? [endereco] : [];
  }
  return [];
}

function primeiraImagem(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achada = primeiraImagem(item);
      if (achada) return achada;
    }
    return "";
  }
  if (valor && typeof valor === "object") return comoTexto((valor as No).url);
  return "";
}

/** Endereço relativo na página vira absoluto; o que não for endereço, cai fora. */
function absoluta(url: string, base: string): string | null {
  if (!url || /^data:/i.test(url)) return null;
  try {
    const resolvida = new URL(url, base);
    return resolvida.protocol === "http:" || resolvida.protocol === "https:" ? resolvida.toString() : null;
  } catch {
    return null;
  }
}

/** `offers` é objeto, lista de objetos ou `AggregateOffer` com faixa de preço. */
function daOferta(valor: unknown): { price_cents: number | null; currency: string; available: boolean | null } {
  const oferta = (Array.isArray(valor) ? valor[0] : valor) as No | undefined;
  if (!oferta || typeof oferta !== "object") return { price_cents: null, currency: "", available: null };

  const bruto = oferta.price ?? oferta.lowPrice ?? (oferta.priceSpecification as No | undefined)?.price;
  const disponibilidade = comoTexto(oferta.availability);

  return {
    price_cents: bruto == null ? null : toCents(bruto),
    currency: comoTexto(oferta.priceCurrency).toUpperCase(),
    // Sem o campo não dá para afirmar que faltou: o produto está anunciado.
    available: disponibilidade ? /InStock|LimitedAvailability|PreOrder/i.test(disponibilidade) : null,
  };
}

/** O que uma página rendeu de JSON-LD: produtos, categorias e moedas. */
type Colheita = { products: ProdutoDoCatalogo[]; categories: string[]; currencies: string[] };

/**
 * Varre o JSON-LD da página atrás de produto.
 *
 * A busca é por todo o documento, em qualquer profundidade, porque cada
 * plataforma aninha de um jeito: a VTEX põe o produto dentro de um `ItemList`,
 * a página de detalhe põe dentro de um `ProductDetailsPage`, e há quem use
 * `@graph`. Procurar pelo tipo, e não pelo caminho, cobre as três sem precisar
 * saber qual plataforma está do outro lado.
 */
function colherJsonLd(html: string, baseUrl: string, limite: number): Colheita {
  const products: ProdutoDoCatalogo[] = [];
  const categories = new Set<string>();
  const currencies: string[] = [];
  const vistos = new Set<string>();

  for (const bloco of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let raiz: unknown;
    try {
      raiz = JSON.parse(bloco[1].trim());
    } catch {
      // Bloco quebrado numa página não pode derrubar o catálogo inteiro.
      continue;
    }

    /*
     * Variante não é produto novo: "Cinto Roxo" e "Cinto Roxo U" são a mesma
     * coisa em dois tamanhos, com a mesma foto. Quem vale é o `ProductGroup`;
     * das variantes se aproveita só o preço, que o grupo costuma não trazer.
     */
    const variantes = new Set<unknown>();
    const fila: unknown[] = [raiz];
    let visitados = 0;

    while (fila.length && visitados < MAX_NOS && products.length < limite) {
      const atual = fila.shift();
      visitados += 1;

      if (Array.isArray(atual)) {
        fila.push(...atual);
        continue;
      }
      if (!atual || typeof atual !== "object") continue;

      const no = atual as No;
      for (const valor of Object.values(no)) {
        if (valor && typeof valor === "object") fila.push(valor);
      }
      if (variantes.has(no)) continue;

      const tipos = Array.isArray(no["@type"]) ? no["@type"].map(String) : [String(no["@type"] ?? "")];
      if (!tipos.some((tipo) => TIPO_DE_PRODUTO.test(tipo.trim()))) continue;

      const name = comoTexto(no.name);
      if (!name) continue;
      const chave = name.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      const filhas = Array.isArray(no.hasVariant) ? no.hasVariant : [];
      for (const filha of filhas) if (filha && typeof filha === "object") variantes.add(filha);

      let oferta = daOferta(no.offers);
      if (oferta.price_cents === null) {
        for (const filha of filhas) {
          const daFilha = daOferta((filha as No)?.offers);
          if (daFilha.price_cents !== null) {
            oferta = { ...daFilha, available: oferta.available ?? daFilha.available };
            break;
          }
        }
      }
      if (oferta.currency) currencies.push(oferta.currency);

      // Categoria em trilha ("Beleza > Cabelos") vale pela ponta mais específica.
      const categoria = comoTexto(no.category).split(/\s*[>/|]\s*/).pop()?.trim();
      if (categoria) categories.add(categoria);

      products.push({
        name,
        description: stripHtml(comoTexto(no.description)).slice(0, 600),
        price_cents: oferta.price_cents,
        url: absoluta(comoTexto(no.url), baseUrl) ?? baseUrl,
        image: absoluta(primeiraImagem(no.image), baseUrl),
        images: todasAsImagens(no.image)
          .map((endereco) => absoluta(endereco, baseUrl))
          .filter((endereco): endereco is string => Boolean(endereco))
          .slice(0, 5),
        highlights: usefulTags(no.keywords),
        available: oferta.available ?? true,
      });
    }
  }

  return { products, categories: [...categories], currencies };
}

/** Os produtos declarados em JSON-LD na página, do jeito que o catálogo os quer. */
export function extrairProdutosJsonLd(html: string, baseUrl: string, limite = 24): ProdutoDoCatalogo[] {
  return colherJsonLd(html, baseUrl, limite).products;
}

/** A moeda mais anunciada nos produtos vale mais que o palpite por país. */
function moedaMaisComum(moedas: string[]): string {
  const contagem = new Map<string, number>();
  for (const moeda of moedas) contagem.set(moeda, (contagem.get(moeda) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/**
 * Monta o catálogo com o melhor que o site tiver a oferecer.
 *
 * As páginas internas entram porque é lá que a vitrine costuma estar: a home
 * vende a marca, a categoria lista o que ela vende. Elas já foram lidas para
 * outros fins — aproveitar o HTML que está na mão não custa requisição nenhuma.
 */
export async function montarCatalogo(
  { html, url, internas = [], limite = 12 }: {
    html: string;
    url: string;
    internas?: { url: string; html: string }[];
    limite?: number;
  },
): Promise<Catalogo> {
  const ehShopify = looksLikeShopify(html);

  if (ehShopify) {
    /*
     * O domínio público primeiro, o da loja depois.
     *
     * Vitrine headless — SPA em `marca.com.br` lendo `marca.myshopify.com` —
     * devolve 404 no `/products.json` público e não tem JSON-LD, porque o
     * HTML chega vazio e o conteúdo é montado no navegador. Sem esta segunda
     * tentativa a marca entra sem catálogo, e os produtos acabam vindo do
     * modelo de texto: nome e descrição, sem preço e sem foto.
     */
    const moeda = detectCurrency(html);
    const candidatos = [url, dominioDaLoja(html)].filter(Boolean) as string[];

    for (const candidato of candidatos) {
      const loja = await importShopifyStore(candidato, limite, moeda).catch(() => null);
      if (loja?.products.length) {
        return {
          fonte: "shopify",
          vendor: loja.vendor,
          currency: loja.currency,
          products: loja.products,
          productTypes: loja.productTypes,
        };
      }
    }
  }

  const paginas = [{ url, html }, ...internas];
  const produtos: ProdutoDoCatalogo[] = [];
  const categorias = new Set<string>();
  const moedas: string[] = [];
  const vistos = new Set<string>();

  for (const pagina of paginas) {
    const colhido = colherJsonLd(pagina.html, pagina.url, limite);
    moedas.push(...colhido.currencies);
    for (const categoria of colhido.categories) categorias.add(categoria);

    for (const produto of colhido.products) {
      const chave = produto.name.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      produtos.push(produto);
      if (produtos.length >= limite) break;
    }
    if (produtos.length >= limite) break;
  }

  if (produtos.length) {
    return {
      fonte: "pagina",
      vendor: "",
      currency: moedaMaisComum(moedas) || detectCurrency(html),
      // Com foto na frente: é a que faz a peça nascer parecida com o produto.
      products: [...produtos].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image))),
      productTypes: [...categorias].slice(0, 8),
    };
  }

  /*
   * Última tentativa: loja Shopify servida por front próprio não deixa rastro
   * no HTML, então `looksLikeShopify` diz que não é — mas o `/products.json`
   * continua respondendo. Uma requisição, só quando tudo o mais falhou.
   */
  if (!ehShopify) {
    const loja = await importShopifyStore(url, limite, detectCurrency(html)).catch(() => null);
    if (loja?.products.length) {
      return {
        fonte: "shopify",
        vendor: loja.vendor,
        currency: loja.currency,
        products: loja.products,
        productTypes: loja.productTypes,
      };
    }
  }

  return VAZIO;
}
