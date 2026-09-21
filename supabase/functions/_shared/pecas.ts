/**
 * Da quantidade pedida à lista de peças a gerar.
 *
 * Antes, o número de peças era um produto de constantes: três copies fixas por
 * caminho, uma peça por copy. Pedir seis peças ou trinta dava sempre o mesmo
 * resultado, porque a quantidade do briefing não chegava a lugar nenhum.
 *
 * Aqui ela chega. A quantidade é a saída, e caminho, copy, formato e
 * referência de layout giram por baixo para que N peças sejam N peças
 * diferentes — não N cópias da mesma ideia.
 */
import { distribuirReferencias, type ReferenciaDeLayout } from "./referencias.ts";

export type CaminhoComCopies = {
  id: string;
  /**
   * A copy traz a forma e, desde 21/09, a estrutura que ela pede.
   * `layout.arquetipo` vazio significa "não escolhi": aí vale o rodízio.
   */
  copies: {
    id: string;
    formato?: string | null;
    headline?: string | null;
    layout?: { arquetipo?: string } | null;
  }[];
};

export type PecaPlanejada = {
  /*
   * Qual ideia esta peça é. Os formatos de uma mesma ideia compartilham o
   * número — é o que vira `grupo_id` e faz o card mostrar 4:5 e 9:16 como duas
   * faces da mesma peça, em vez de dois criativos soltos.
   */
  ideia: number;
  directionId: string;
  /** Nulo quando o caminho não tem copy salva: a peça usa o hook do caminho. */
  copyId: string | null;
  formato: string;
  /**
   * O desenho desta peça.
   *
   * Os dois renderizadores leem daqui: a composição em HTML escolhe o
   * componente em `ARQUETIPOS`, e a peça desenhada pelo modelo recebe a forma
   * descrita em palavras. Mesma decisão, dois jeitos de executá-la.
   */
  arquetipo: string;
  referencia: ReferenciaDeLayout | null;
};

/**
 * Os desenhos que giram, na ordem do rodízio.
 *
 * `coluna` abre porque é o mais seguro, e é o único que existia: até aqui toda
 * peça saía nele, porque a composição devolvia `layout` vazio e o canvas caía
 * no padrão. Trinta peças, trinta colunas com outra foto atrás.
 *
 * `enquete` e `conversa` ficam de fora do rodízio: eles não são uma escolha de
 * gosto, são a forma que a copy já tem. Entram por `formato`, não por sorteio.
 */
export const ARQUETIPOS_EM_RODIZIO = ["vitrine", "coluna", "destaque", "bloco", "manchete", "listicle", "numeros"] as const;

/** Todos os desenhos que os dois renderizadores conhecem. */
export const ARQUETIPOS_CONHECIDOS = [...ARQUETIPOS_EM_RODIZIO, "enquete", "conversa"] as const;

/**
 * Os desenhos de cartaz, onde o título é a peça inteira.
 *
 * Neles o título entra em caixa alta ocupando quase metade da altura. Só
 * funciona com manchete curta: medido numa peça real, "Vá além do cuidado:
 * deixe sua marca com um cabelo forte e um aroma inesquecível" tem 81
 * caracteres, e o ajuste automático encolheu o corpo até caber. Título
 * encolhido não é título, é corpo de texto em caixa alta.
 */
const DE_CARTAZ = new Set(["vitrine", "bloco", "destaque", "manchete"]);

/**
 * Quanto de manchete um cartaz aguenta.
 *
 * 52 é o comprimento em que a frase ainda cabe em três linhas curtas no corpo
 * grande. "Mais volume de cabelo já no primeiro uso" tem 40 e sobra espaço.
 */
export const LIMITE_DE_MANCHETE_DE_CARTAZ = 52;

export function arquetipoDaPeca(
  formatoDaCopy: string | null | undefined,
  ideia: number,
  /**
   * O que quem escreveu o texto pediu.
   *
   * Ganha do rodízio, e é a diferença entre variedade e intenção: uma enquete
   * pede título discreto, um número forte pede título dominante, e o rodízio
   * não sabe disso. Vazio quando o modelo não escolheu ou escolheu um nome que
   * não existe, e aí o rodízio segue valendo.
   */
  escolhido?: string | null,
  /**
   * A manchete desta peça.
   *
   * O desenho precisa caber no texto, e não o contrário. Encolher o corpo até
   * a frase caber salva o recorte e mata a peça: vira um bloco de texto em
   * caixa alta onde devia haver uma manchete.
   */
  headline?: string | null,
): string {
  if (formatoDaCopy === "enquete") return "enquete";
  if (formatoDaCopy === "conversa") return "conversa";

  const pedido = escolhido?.trim();
  const valido =
    pedido && ARQUETIPOS_CONHECIDOS.includes(pedido as (typeof ARQUETIPOS_CONHECIDOS)[number])
      ? pedido
      : ARQUETIPOS_EM_RODIZIO[ideia % ARQUETIPOS_EM_RODIZIO.length];

  /*
   * Manchete longa demais para cartaz cai na coluna, que escreve no rodapé em
   * corpo de leitura e aguenta três linhas sem encolher nada. Os asteriscos do
   * destaque não contam: eles somem no desenho.
   */
  const letras = (headline ?? "").replace(/\*/g, "").trim().length;
  if (DE_CARTAZ.has(valido) && letras > LIMITE_DE_MANCHETE_DE_CARTAZ) return "coluna";

  return valido;
}

/** Sem formato escolhido, o vertical de feed é o que mais roda. */
const FORMATO_PADRAO = "4:5";

/**
 * Quantas gerações uma quantidade de peças custa.
 *
 * Uma peça é uma ideia; cada formato dela é um desenho próprio. Pedir a mesma
 * peça em feed e em stories é pedir dois anúncios: o modelo redesenha o layout
 * inteiro para a nova proporção, não recorta o anterior.
 */
export function geracoesNecessarias(quantidade: number, formatos: string[]): number {
  return Math.max(0, quantidade) * Math.max(1, formatos.length);
}

export function planejarPecas({
  quantidade,
  caminhos,
  formatos,
  referencias,
}: {
  quantidade: number;
  caminhos: CaminhoComCopies[];
  formatos: string[];
  referencias: ReferenciaDeLayout[];
}): PecaPlanejada[] {
  if (quantidade <= 0 || !caminhos.length) return [];

  const doFormato = formatos.length ? formatos : [FORMATO_PADRAO];
  // Uma referência por ideia, não por geração: a versão de stories tem de ser
  // a mesma peça em outra proporção, com o mesmo layout e o mesmo texto.
  const doLayout = distribuirReferencias(referencias, quantidade);

  /*
   * Cada caminho anda pelas suas próprias copies. Um contador global faria a
   * segunda peça do caminho 1 e a segunda do caminho 2 caírem sempre na mesma
   * forma de copy — que é exatamente o vício que se está corrigindo.
   */
  const consumidas = new Map<string, number>();
  const plano: PecaPlanejada[] = [];

  for (let indice = 0; indice < quantidade; indice += 1) {
    const caminho = caminhos[indice % caminhos.length];
    const jaUsadas = consumidas.get(caminho.id) ?? 0;
    consumidas.set(caminho.id, jaUsadas + 1);

    const copy = caminho.copies.length ? caminho.copies[jaUsadas % caminho.copies.length] : null;

    /*
     * O desenho é da ideia, não da geração: feed e stories da mesma peça
     * precisam do mesmo layout, senão viram dois anúncios em vez de duas
     * proporções do mesmo.
     */
    const arquetipo = arquetipoDaPeca(copy?.formato, indice, copy?.layout?.arquetipo, copy?.headline);

    for (const formato of doFormato) {
      plano.push({
        ideia: indice,
        directionId: caminho.id,
        copyId: copy?.id ?? null,
        formato,
        arquetipo,
        referencia: doLayout[indice] ?? null,
      });
    }
  }

  return plano;
}

/**
 * O texto que a peça vai desenhar, respeitando a forma da copy.
 *
 * Enquete e conversa nascem sem headline — a pergunta e os balões são o
 * anúncio. Mandar `headline: ""` ao modelo entrega peça sem título nenhum, e a
 * variedade de forma da copy se perde na hora de desenhar. Cada forma vira,
 * então, o texto que faz sentido para ela.
 */
export function textoDaPeca(
  copy: {
    formato?: string | null;
    headline?: string | null;
    subheadline?: string | null;
    cta?: string | null;
    bullets?: string[] | null;
    pergunta?: string | null;
    opcoes?: { texto: string; votos: number }[] | null;
    mensagens?: { de: string; texto: string }[] | null;
  } | null,
  direction: { hook?: string | null; promise?: string | null; cta?: string | null },
  destaquesDoProduto: string[] = [],
): { headline: string; subheadline: string; cta: string; bullets: string[] } {
  const cta = copy?.cta || direction.cta || "Saiba mais";

  if (copy?.formato === "enquete" && copy.pergunta) {
    return {
      headline: copy.pergunta,
      subheadline: "",
      cta,
      bullets: (copy.opcoes ?? []).map((opcao) => opcao.texto).filter(Boolean).slice(0, 3),
    };
  }

  if (copy?.formato === "conversa" && copy.mensagens?.length) {
    return {
      headline: direction.hook || copy.headline || "",
      subheadline: "",
      cta,
      // Os balões viram as linhas da peça, na ordem em que foram escritos.
      bullets: copy.mensagens.map((mensagem) => mensagem.texto).filter(Boolean).slice(0, 4),
    };
  }

  return {
    headline: copy?.headline || direction.hook || "",
    subheadline: copy?.subheadline || direction.promise || "",
    cta,
    // Sem itens escritos pela copy, os destaques do produto servem: são fatos
    // da marca, não invenção do renderizador.
    bullets: copy?.bullets?.length ? copy.bullets.slice(0, 3) : destaquesDoProduto.slice(0, 3),
  };
}
