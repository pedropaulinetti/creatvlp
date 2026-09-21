/**
 * A estrutura da peça passa a ser decisão de quem escreveu o texto.
 *
 * Antes era rodízio no servidor: dava variedade, não dava intenção. Uma
 * enquete pede título discreto e um número forte pede dominante, e o rodízio
 * não sabe disso. O vocabulário é fechado de propósito: o canvas continua
 * desenhando a letra, então nenhuma escolha do modelo erra ortografia nem
 * quebra o desenho.
 */
import { describe, expect, it } from "vitest";
import {
  arquetipoDaPeca, planejarPecas, LIMITE_DE_MANCHETE_DE_CARTAZ,
} from "../supabase/functions/_shared/pecas.ts";
// O schema do servidor importa zod pelo especificador do Deno e não roda no
// vitest; o do cliente é o espelho dele, campo por campo.
import { layoutDaCopySchema } from "@/lib/schemas";
import { escalaDoTitulo, alinhamentoDoTexto, ancoraNoTopo } from "@/features/creatives/arquetipos";

describe("layoutDaCopySchema", () => {
  it("aceita as escolhas válidas", () => {
    const lido = layoutDaCopySchema.parse({
      arquetipo: "manchete", escala: "dominante", alinhamento: "centro", ancora: "topo",
    });
    expect(lido).toEqual({ arquetipo: "manchete", escala: "dominante", alinhamento: "centro", ancora: "topo" });
  });

  it("valor inventado cai no padrão em vez de derrubar a geração", () => {
    const lido = layoutDaCopySchema.parse({
      arquetipo: "revista-holografica", escala: "gigantesco", alinhamento: "justificado", ancora: "meio",
    });
    expect(lido).toEqual({ arquetipo: "", escala: "equilibrada", alinhamento: "esquerda", ancora: "rodape" });
  });

  it("objeto vazio vira o padrão inteiro", () => {
    expect(layoutDaCopySchema.parse({}).escala).toBe("equilibrada");
  });
});

describe("arquetipoDaPeca com escolha da copy", () => {
  it("a escolha ganha do rodízio", () => {
    expect(arquetipoDaPeca("titulo", 0, "manchete")).toBe("manchete");
    expect(arquetipoDaPeca("titulo", 0, "manchete")).not.toBe(arquetipoDaPeca("titulo", 0));
  });

  it("sem escolha, o rodízio continua valendo", () => {
    expect(arquetipoDaPeca("titulo", 1, "")).toBe(arquetipoDaPeca("titulo", 1));
    expect(arquetipoDaPeca("titulo", 1, null)).toBe(arquetipoDaPeca("titulo", 1));
  });

  it("nome inventado não vira arquétipo", () => {
    expect(arquetipoDaPeca("titulo", 2, "revista-holografica")).toBe(arquetipoDaPeca("titulo", 2));
  });

  it("a forma da copy ainda manda sobre a escolha", () => {
    expect(arquetipoDaPeca("enquete", 0, "vitrine")).toBe("enquete");
  });

  it("chega ao plano pela copy", () => {
    const plano = planejarPecas({
      quantidade: 1,
      caminhos: [{ id: "d1", copies: [{ id: "c1", formato: "titulo", layout: { arquetipo: "numeros" } }] }],
      formatos: ["4:5"],
      referencias: [],
    });
    expect(plano[0].arquetipo).toBe("numeros");
  });
});

describe("as três alavancas no desenho", () => {
  it("a escala muda o corpo do título", () => {
    expect(escalaDoTitulo({ escala: "dominante" })).toBeGreaterThan(1);
    expect(escalaDoTitulo({ escala: "discreta" })).toBeLessThan(1);
    expect(escalaDoTitulo({ escala: "equilibrada" })).toBe(1);
  });

  it("escala desconhecida não encolhe nem estoura a peça", () => {
    expect(escalaDoTitulo({ escala: "gigantesco" })).toBe(1);
    expect(escalaDoTitulo({})).toBe(1);
  });

  it("alinhamento e âncora respondem ao que a copy pediu", () => {
    expect(alinhamentoDoTexto({ alinhamento: "centro" })).toBe("center");
    expect(alinhamentoDoTexto({ alinhamento: "esquerda" })).toBe("left");
    expect(ancoraNoTopo({ ancora: "topo" })).toBe(true);
    expect(ancoraNoTopo({ ancora: "rodape" })).toBe(false);
  });
});

/**
 * O desenho precisa caber no texto, e não o contrário.
 *
 * Numa peça real o modelo pediu vitrine para uma headline de 81 caracteres.
 * O ajuste automático encolheu o corpo até a frase caber, e o resultado foi um
 * bloco de texto em caixa alta onde devia haver uma manchete. Salvou o
 * recorte e matou a peça.
 */
describe("manchete longa demais para cartaz", () => {
  const LONGA = "Vá além do cuidado: deixe sua marca com um cabelo forte e um *aroma inesquecível*.";
  const CURTA = "Mais volume já no primeiro uso";

  it("cai na coluna quando a manchete não cabe no cartaz", () => {
    for (const cartaz of ["vitrine", "bloco", "destaque", "manchete"]) {
      expect(arquetipoDaPeca("titulo", 0, cartaz, LONGA), cartaz).toBe("coluna");
    }
  });

  it("mantém o cartaz quando a manchete é curta", () => {
    expect(arquetipoDaPeca("titulo", 0, "vitrine", CURTA)).toBe("vitrine");
    expect(arquetipoDaPeca("titulo", 0, "bloco", CURTA)).toBe("bloco");
  });

  it("os asteriscos do destaque não contam, porque somem no desenho", () => {
    /*
     * Construída no limite: sem asteriscos ela cabe no bloco, com asteriscos
     * passaria. Se os dois contassem, a peça mudaria de desenho por causa de
     * dois caracteres que nem chegam a ser desenhados.
     */
    const limpa = "a".repeat(LIMITE_DE_MANCHETE_DE_CARTAZ - 3) + " bc";
    const marcada = "a".repeat(LIMITE_DE_MANCHETE_DE_CARTAZ - 3) + " *bc*";

    expect(limpa.length).toBeLessThanOrEqual(LIMITE_DE_MANCHETE_DE_CARTAZ);
    expect(marcada.length).toBeGreaterThan(LIMITE_DE_MANCHETE_DE_CARTAZ);
    expect(arquetipoDaPeca("titulo", 0, "bloco", marcada)).toBe("bloco");
  });

  it("desenho de corpo de leitura aguenta manchete longa", () => {
    expect(arquetipoDaPeca("titulo", 0, "listicle", LONGA)).toBe("listicle");
    expect(arquetipoDaPeca("titulo", 0, "numeros", LONGA)).toBe("numeros");
  });

  it("enquete e conversa continuam mandando", () => {
    expect(arquetipoDaPeca("enquete", 0, "vitrine", LONGA)).toBe("enquete");
  });
});

/**
 * O teto da manchete não é o mesmo em todo desenho.
 *
 * Numa peça real, "Tenha um cabelo com volume e força que te destaca" tem 48
 * caracteres, passou pelo limite único de 52, e na coluna de 39% da vitrine
 * virou sete linhas empilhadas de duas palavras. Cabia, e estava errado.
 */
describe("teto de manchete por desenho", () => {
  const QUARENTA_E_OITO = "Tenha um cabelo com volume e força que te destaca";
  const CURTA = "Mais volume no primeiro uso";

  it("a vitrine recusa a manchete que o bloco aceita", () => {
    expect(QUARENTA_E_OITO.length).toBeLessThan(LIMITE_DE_MANCHETE_DE_CARTAZ);
    expect(arquetipoDaPeca("titulo", 0, "vitrine", QUARENTA_E_OITO)).toBe("coluna");
    expect(arquetipoDaPeca("titulo", 0, "bloco", QUARENTA_E_OITO)).toBe("bloco");
  });

  it("manchete curta continua cabendo na vitrine", () => {
    expect(arquetipoDaPeca("titulo", 0, "vitrine", CURTA)).toBe("vitrine");
  });

  it("desenho de corpo de leitura não tem teto", () => {
    expect(arquetipoDaPeca("titulo", 0, "listicle", QUARENTA_E_OITO)).toBe("listicle");
  });
});
