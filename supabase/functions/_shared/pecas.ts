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
  copies: { id: string }[];
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
  referencia: ReferenciaDeLayout | null;
};

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

    for (const formato of doFormato) {
      plano.push({
        ideia: indice,
        directionId: caminho.id,
        copyId: copy?.id ?? null,
        formato,
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
