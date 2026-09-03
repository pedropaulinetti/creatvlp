/** Tipos partilhados pelo onboarding: a leitura do site e o rascunho da marca. */

export type Cor = { hex: string; role: string; label: string };

export type ProdutoLido = {
  name: string;
  description: string;
  price_cents: number | null;
  image: string | null;
  /** Caminho no nosso Storage, depois de a foto ser baixada do site. */
  image_path?: string | null;
  url?: string | null;
  highlights: string[];
};

/**
 * Produto no rascunho.
 *
 * Guarda tudo o que a leitura trouxe, não só o nome: preço, moeda, endereço e
 * foto são o que fazem a primeira peça nascer parecida com o que a marca vende.
 */
export type ProdutoDoRascunho = {
  name: string;
  description: string;
  priceCents?: number | null;
  currency?: string;
  url?: string | null;
  highlights?: string[];
  imagePath?: string | null;
  /** Endereço no site de origem — serve de prévia antes de gravar. */
  imageUrl?: string | null;
};

/** O catálogo da marca, com a origem de onde foi lido. */
export type Catalogo = {
  vendor: string;
  currency: string;
  products: ProdutoLido[];
  product_types: string[];
  /** "shopify" quando veio do `/products.json`; "pagina" quando veio do JSON-LD. */
  source?: string;
};

/** As etapas da leitura, na ordem em que acontecem. */
export const ETAPAS = [
  { chave: "pagina", rotulo: "Abrindo o site" },
  { chave: "navegacao", rotulo: "Outras páginas" },
  { chave: "estilos", rotulo: "Folhas de estilo" },
  { chave: "paleta", rotulo: "Paleta" },
  { chave: "tipografia", rotulo: "Tipografia" },
  { chave: "logo", rotulo: "Logo" },
  { chave: "referencias", rotulo: "Imagens do site" },
  { chave: "catalogo", rotulo: "Catálogo" },
  { chave: "texto", rotulo: "Lendo o que a marca diz" },
] as const;

export type EtapaChave = (typeof ETAPAS)[number]["chave"];
export type EstadoEtapa = "esperando" | "lendo" | "feito";

/** O que a leitura já encontrou. Cresce enquanto o site é lido. */
export type Leitura = {
  estados: Record<EtapaChave, EstadoEtapa>;
  url: string;
  titulo: string;
  folhas: number;
  cores: Cor[];
  fontes: { headline: string; body: string };
  logoPath: string | null;
  /** Endereço do logo no site de origem — dá para mostrar antes de guardar. */
  logoUrl: string;
  /** As páginas lidas além da home. */
  paginas: string[];
  /** Endereços das imagens no site de origem — servem de prévia imediata. */
  imagens: string[];
  /** Quantas delas já estão guardadas no nosso Storage. */
  referencias: number;
  produtos: ProdutoLido[];
  moeda: string;
  loja: boolean;
  /** Falso quando o modelo de texto não respondeu: a pessoa precisa revisar. */
  textoOk: boolean;
  confianca: string;
  /** As etapas chegaram uma a uma, ou tudo de uma vez no fim. */
  aoVivo: boolean;
  /** Falso quando a Edge Function publicada é anterior a esta versão do app. */
  funcaoAtual: boolean;
};

export const leituraVazia = (): Leitura => ({
  estados: {
    pagina: "esperando", navegacao: "esperando", estilos: "esperando", paleta: "esperando",
    tipografia: "esperando", logo: "esperando", referencias: "esperando",
    catalogo: "esperando", texto: "esperando",
  },
  url: "", titulo: "", folhas: 0, cores: [],
  fontes: { headline: "", body: "" },
  logoPath: null, logoUrl: "", paginas: [], imagens: [], referencias: 0, produtos: [], moeda: "BRL", loja: false,
  textoOk: true, confianca: "media", aoVivo: false, funcaoAtual: true,
});

/** A memória da marca em construção. Nada disso é gravado antes de concluir. */
export type Draft = {
  brandId: string;
  company: string;
  website: string;
  segment: string;
  description: string;
  colors: Cor[];
  logoPath: string | null;
  referencePaths: string[];
  products: ProdutoDoRascunho[];
  audience: string;
  audiencePains: string[];
  voiceTone: string;
  recommendedWords: string[];
  forbiddenWords: string[];
  channels: string[];
  formats: string[];
  cadence: string;
  typography: { headline: string; body: string };
};

/** Resposta completa de `analyze-brand` — a mesma nos dois modos, stream ou não. */
export type RespostaAnalise = {
  analysis: {
    name: string; description: string; segment: string; voice_tone: string;
    colors: Cor[];
    products: { name: string; description: string }[];
    audience: string; differentiators: string[]; confidence: string;
  };
  design_system: {
    colors: Cor[];
    fonts: { headline: string; body: string; candidates: string[] };
    stylesheets: number;
    logo: { url: string; kind: string } | null;
    logo_path: string | null;
    /*
     * Ausentes na versão anterior da função. É por isso que a resposta permite
     * saber, sem perguntar a ninguém, se o que está publicado é o código atual.
     */
    images?: string[];
    reference_paths?: string[];
  } | null;
  /**
   * O catálogo lido do site: do `/products.json` do Shopify ou do JSON-LD que
   * as demais plataformas publicam. É de onde vêm preço e foto de produto.
   */
  catalog?: Catalogo | null;
  /** Nome antigo do mesmo campo, de quando só loja Shopify tinha catálogo. */
  shopify: Catalogo | null;
  text_analysis?: { ok: boolean; reason: string };
  pages?: string[];
};
