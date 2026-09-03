/**
 * O acervo de referências de layout.
 *
 * Cinco formas descritas em palavras no prompt entregavam cinco peças
 * parecidas: o modelo lê "bloco de cor com selo" e desenha sempre o mesmo
 * bloco. Mostrar um anúncio real e pedir a estrutura dele resolve o que a
 * descrição não resolve — e o acervo tem centenas, não cinco.
 *
 * O que se toma emprestado é a arquitetura: proporção do texto, tipo de
 * recorte, lugar do botão. Marca, produto, paleta e texto continuam sendo os
 * da peça. A proibição está no prompt, em `pecaCompletaPrompt`.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Segmento = "ecommerce" | "saas";

export type ReferenciaDeLayout = {
  key: string;
  storage_path: string;
  /** Descrição opcional da estrutura. Vazia significa "olhe a imagem". */
  estrutura: string;
};

/** Quanto tempo a URL assinada precisa viver: o suficiente para o provedor buscar. */
const MINUTOS_DE_ACESSO = 15 * 60;

/*
 * O que separa os dois acervos é o que o anúncio precisa mostrar: e-commerce
 * mostra um objeto, SaaS mostra uma tela ou uma ideia. A marca declara o
 * segmento em texto livre no onboarding, então a leitura é por palavra.
 */
const PALAVRAS_DE_SOFTWARE = [
  "saas", "software", "aplicativo", "app", "plataforma", "sistema",
  "tecnologia", "b2b", "crm", "erp", "automação", "automacao", "digital",
];

export function segmentoDaMarca(segmento: string | null | undefined): Segmento {
  const texto = (segmento ?? "").toLowerCase();
  if (!texto) return "ecommerce";
  return PALAVRAS_DE_SOFTWARE.some((palavra) => texto.includes(palavra)) ? "saas" : "ecommerce";
}

/**
 * Quantas referências a geração pedir, sem repetir enquanto houver acervo.
 *
 * Embaralha uma vez e percorre em ciclo: com catálogo maior que a quantidade,
 * nenhuma peça repete layout; com catálogo menor, só repete depois de esgotar.
 */
export function distribuirReferencias(
  catalogo: ReferenciaDeLayout[],
  quantidade: number,
): ReferenciaDeLayout[] {
  if (!catalogo.length || quantidade <= 0) return [];

  const embaralhado = [...catalogo];
  for (let i = embaralhado.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }

  return Array.from({ length: quantidade }, (_, indice) => embaralhado[indice % embaralhado.length]);
}

/**
 * O acervo do segmento da marca.
 *
 * Segmento sem acervo cai no outro: melhor uma estrutura de anúncio real de
 * outro ramo do que voltar às cinco formas escritas à mão. Sem tabela nenhuma
 * — antes do seed — devolve vazio, e a geração usa o fallback do prompt.
 */
export async function carregarReferencias(
  admin: SupabaseClient,
  segmento: Segmento,
  /** Escolhidas à mão no app. Vazio significa "varie por conta própria". */
  escolhidas: string[] = [],
): Promise<ReferenciaDeLayout[]> {
  if (escolhidas.length) {
    const { data } = await admin
      .from("layout_references")
      .select("key, storage_path, estrutura")
      .in("key", escolhidas.slice(0, 30));
    // Escolha explícita não cai para o acervo do outro segmento: se as chaves
    // sumiram, o prompt usa o fallback e a peça ainda sai.
    if (data?.length) return data as ReferenciaDeLayout[];
  }

  const buscar = async (alvo: Segmento) => {
    const { data } = await admin
      .from("layout_references")
      .select("key, storage_path, estrutura")
      .eq("segmento", alvo)
      .eq("ativo", true)
      .limit(300);
    return (data ?? []) as ReferenciaDeLayout[];
  };

  const doSegmento = await buscar(segmento);
  if (doSegmento.length) return doSegmento;

  return await buscar(segmento === "saas" ? "ecommerce" : "saas");
}

/** A referência precisa chegar ao modelo como URL buscável. */
export async function assinarReferencia(
  admin: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data } = await admin.storage
    .from("layout-references")
    .createSignedUrl(storagePath, MINUTOS_DE_ACESSO);
  return data?.signedUrl ?? null;
}
