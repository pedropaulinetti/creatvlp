import { describe, expect, it } from "vitest";
import { distribuirReferencias, segmentoDaMarca } from "../supabase/functions/_shared/referencias.ts";

const catalogo = [
  { key: "a", storage_path: "a.png", estrutura: "A" },
  { key: "b", storage_path: "b.png", estrutura: "B" },
  { key: "c", storage_path: "c.png", estrutura: "C" },
];

describe("distribuirReferencias", () => {
  it("não repete referência enquanto houver catálogo", () => {
    const escolhidas = distribuirReferencias(catalogo, 3);
    expect(new Set(escolhidas.map((item) => item.key)).size).toBe(3);
  });

  it("volta a circular quando a quantidade passa do catálogo", () => {
    const escolhidas = distribuirReferencias(catalogo, 5);
    expect(escolhidas).toHaveLength(5);
    expect(new Set(escolhidas.slice(0, 3).map((item) => item.key)).size).toBe(3);
  });

  it("sem catálogo, devolve lista vazia sem quebrar", () => {
    expect(distribuirReferencias([], 4)).toEqual([]);
  });

  it("não pede mais do que a quantidade", () => {
    expect(distribuirReferencias(catalogo, 1)).toHaveLength(1);
    expect(distribuirReferencias(catalogo, 0)).toEqual([]);
  });
});

describe("segmentoDaMarca", () => {
  it("reconhece software pelo segmento declarado", () => {
    expect(segmentoDaMarca("Software B2B")).toBe("saas");
    expect(segmentoDaMarca("Plataforma de atendimento")).toBe("saas");
    expect(segmentoDaMarca("SaaS")).toBe("saas");
    expect(segmentoDaMarca("Aplicativo de finanças")).toBe("saas");
  });

  it("o resto do mundo vende coisa, e coisa é ecommerce", () => {
    expect(segmentoDaMarca("Alimentos e bebidas")).toBe("ecommerce");
    expect(segmentoDaMarca("Moda")).toBe("ecommerce");
  });

  it("sem segmento declarado, assume ecommerce", () => {
    expect(segmentoDaMarca(null)).toBe("ecommerce");
    expect(segmentoDaMarca("")).toBe("ecommerce");
  });
});
