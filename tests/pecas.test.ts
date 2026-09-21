import { describe, expect, it } from "vitest";
import {
  planejarPecas, geracoesNecessarias, arquetipoDaPeca, ARQUETIPOS_EM_RODIZIO,
} from "../supabase/functions/_shared/pecas.ts";

const caminhos = [
  { id: "d1", copies: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
  { id: "d2", copies: [{ id: "c4" }, { id: "c5" }, { id: "c6" }] },
];

const referencias = [
  { key: "r1", storage_path: "r1.png", estrutura: "R1" },
  { key: "r2", storage_path: "r2.png", estrutura: "R2" },
];

describe("planejarPecas", () => {
  it("entrega exatamente a quantidade pedida", () => {
    expect(planejarPecas({ quantidade: 7, caminhos, formatos: ["4:5"], referencias })).toHaveLength(7);
  });

  it("cada peça sai em todos os formatos escolhidos", () => {
    const pecas = planejarPecas({ quantidade: 3, caminhos, formatos: ["4:5", "9:16"], referencias });
    expect(pecas).toHaveLength(6);
    expect(pecas.filter((peca) => peca.formato === "4:5")).toHaveLength(3);
    expect(pecas.filter((peca) => peca.formato === "9:16")).toHaveLength(3);
  });

  it("as duas versões da mesma peça compartilham texto, layout e ideia", () => {
    const pecas = planejarPecas({ quantidade: 1, caminhos, formatos: ["4:5", "9:16"], referencias });
    expect(pecas[0].copyId).toBe(pecas[1].copyId);
    expect(pecas[0].referencia?.key).toBe(pecas[1].referencia?.key);
    expect(pecas[0].formato).not.toBe(pecas[1].formato);
    // Mesma ideia: é o que vira grupo_id e junta os formatos num card só.
    expect(pecas[0].ideia).toBe(pecas[1].ideia);
  });

  it("ideias diferentes não compartilham grupo", () => {
    const pecas = planejarPecas({ quantidade: 3, caminhos, formatos: ["4:5", "9:16"], referencias });
    expect(new Set(pecas.map((peca) => peca.ideia)).size).toBe(3);
    expect(pecas.filter((peca) => peca.ideia === 0)).toHaveLength(2);
  });

  it("distribui os caminhos por igual antes de repetir", () => {
    const pecas = planejarPecas({ quantidade: 4, caminhos, formatos: ["4:5"], referencias });
    expect(pecas.filter((peca) => peca.directionId === "d1")).toHaveLength(2);
    expect(pecas.filter((peca) => peca.directionId === "d2")).toHaveLength(2);
  });

  it("gira as copies dentro do caminho, sem repetir enquanto houver", () => {
    const pecas = planejarPecas({ quantidade: 6, caminhos, formatos: ["4:5"], referencias });
    const doD1 = pecas.filter((peca) => peca.directionId === "d1").map((peca) => peca.copyId);
    expect(doD1).toHaveLength(3);
    expect(new Set(doD1).size).toBe(3);
  });

  it("conta as gerações que a escolha custa", () => {
    expect(geracoesNecessarias(6, ["4:5"])).toBe(6);
    expect(geracoesNecessarias(6, ["4:5", "9:16"])).toBe(12);
    expect(geracoesNecessarias(0, ["4:5"])).toBe(0);
    // Sem formato marcado, o padrão ainda custa uma geração por peça.
    expect(geracoesNecessarias(4, [])).toBe(4);
  });

  it("não repete referência enquanto o acervo aguentar", () => {
    const acervo = [
      { key: "r1", storage_path: "r1.png", estrutura: "" },
      { key: "r2", storage_path: "r2.png", estrutura: "" },
      { key: "r3", storage_path: "r3.png", estrutura: "" },
      { key: "r4", storage_path: "r4.png", estrutura: "" },
    ];
    const pecas = planejarPecas({ quantidade: 4, caminhos, formatos: ["4:5"], referencias: acervo });
    expect(new Set(pecas.map((peca) => peca.referencia?.key)).size).toBe(4);
  });

  it("caminho sem copy nenhuma ainda rende peça, usando o hook", () => {
    const pecas = planejarPecas({
      quantidade: 2,
      caminhos: [{ id: "d3", copies: [] }],
      formatos: ["4:5"],
      referencias,
    });
    expect(pecas).toHaveLength(2);
    expect(pecas[0].copyId).toBeNull();
  });

  it("sem acervo, a peça sai mesmo assim e o prompt usa o fallback", () => {
    const pecas = planejarPecas({ quantidade: 2, caminhos, formatos: ["4:5"], referencias: [] });
    expect(pecas).toHaveLength(2);
    expect(pecas[0].referencia).toBeNull();
  });

  it("sem caminho nenhum, devolve lista vazia", () => {
    expect(planejarPecas({ quantidade: 5, caminhos: [], formatos: ["4:5"], referencias })).toEqual([]);
  });

  it("quantidade zero ou negativa não gera peça", () => {
    expect(planejarPecas({ quantidade: 0, caminhos, formatos: ["4:5"], referencias })).toEqual([]);
    expect(planejarPecas({ quantidade: -3, caminhos, formatos: ["4:5"], referencias })).toEqual([]);
  });

  it("sem formato pedido, cai no 4:5", () => {
    const pecas = planejarPecas({ quantidade: 2, caminhos, formatos: [], referencias });
    expect(pecas.every((peca) => peca.formato === "4:5")).toBe(true);
  });
});

/**
 * O desenho da peça.
 *
 * Oito arquétipos existiam em `arquetipos.tsx` e nenhum era escolhido: a
 * composição devolvia `layout` vazio, o canvas caía no padrão, e trinta peças
 * saíam em coluna com outra foto atrás. O rodízio é o que dá variedade sem
 * modelo novo e sem crédito a mais.
 */
describe("arquetipoDaPeca", () => {
  it("gira entre os desenhos conforme a ideia avança", () => {
    const total = ARQUETIPOS_EM_RODIZIO.length;
    const uma_volta = Array.from({ length: total }, (_, ideia) => arquetipoDaPeca(null, ideia));

    expect(new Set(uma_volta).size, "uma volta usa cada desenho uma vez").toBe(total);
    expect(uma_volta[0]).toBe(ARQUETIPOS_EM_RODIZIO[0]);
  });

  it("volta ao início depois de esgotar o rodízio", () => {
    const total = ARQUETIPOS_EM_RODIZIO.length;
    expect(arquetipoDaPeca(null, total)).toBe(arquetipoDaPeca(null, 0));
  });

  it("a forma da copy manda sobre o rodízio", () => {
    expect(arquetipoDaPeca("enquete", 3)).toBe("enquete");
    expect(arquetipoDaPeca("conversa", 4)).toBe("conversa");
    // "titulo" não é uma forma própria: entra no rodízio como qualquer outra.
    expect(arquetipoDaPeca("titulo", 1)).toBe(arquetipoDaPeca(null, 1));
  });

  it("os formatos de uma mesma ideia compartilham o desenho", () => {
    const plano = planejarPecas({
      quantidade: 3,
      caminhos: [{ id: "c1", copies: [{ id: "k1" }, { id: "k2" }, { id: "k3" }] }],
      formatos: ["4:5", "9:16"],
      referencias: [],
    });

    for (let ideia = 0; ideia < 3; ideia += 1) {
      const daIdeia = plano.filter((peca) => peca.ideia === ideia);
      expect(daIdeia).toHaveLength(2);
      expect(daIdeia[0].arquetipo, "feed e stories são a mesma peça").toBe(daIdeia[1].arquetipo);
    }

    // E ideias diferentes não caem no mesmo desenho.
    const porIdeia = [0, 1, 2].map((ideia) => plano.find((peca) => peca.ideia === ideia)!.arquetipo);
    expect(new Set(porIdeia).size).toBe(3);
  });
});
