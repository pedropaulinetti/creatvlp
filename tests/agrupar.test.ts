import { describe, expect, it } from "vitest";
import { agruparPorIdeia } from "../src/features/creatives/agrupar";

type Linha = { id: string; grupo_id: string | null; format: string };

const peca = (id: string, grupo: string | null, format: string) =>
  ({ id, grupo_id: grupo, format }) as unknown as Parameters<typeof agruparPorIdeia>[0][number];

const idDe = (item: unknown) => (item as Linha).id;

describe("agruparPorIdeia", () => {
  it("junta os formatos da mesma ideia num card só", () => {
    const pecas = agruparPorIdeia([
      peca("a", "g1", "4:5"),
      peca("b", "g1", "9:16"),
      peca("c", "g2", "4:5"),
    ]);
    expect(pecas).toHaveLength(2);
    expect(pecas[0].irmas).toHaveLength(1);
    expect(pecas[1].irmas).toHaveLength(0);
  });

  it("criativo antigo, sem grupo, segue sozinho", () => {
    const pecas = agruparPorIdeia([peca("a", null, "4:5"), peca("b", null, "4:5")]);
    expect(pecas).toHaveLength(2);
    expect(pecas.every((item) => item.irmas.length === 0)).toBe(true);
  });

  it("mistura agrupado e solto sem perder nenhum", () => {
    const pecas = agruparPorIdeia([
      peca("a", "g1", "4:5"),
      peca("b", null, "1:1"),
      peca("c", "g1", "9:16"),
    ]);
    expect(pecas).toHaveLength(2);
    const ids = pecas.flatMap((item) => [idDe(item.principal), ...item.irmas.map(idDe)]);
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("lista vazia não quebra", () => {
    expect(agruparPorIdeia([])).toEqual([]);
  });
});
