import { describe, expect, it } from "vitest";
import { IMAGE_QUALITIES, IMAGE_QUALITY, DEFAULT_IMAGE_QUALITY, estimatedCost } from "@/lib/image-quality";

describe("níveis de qualidade da imagem", () => {
  it("oferece três níveis, do mais barato ao mais caro", () => {
    expect(IMAGE_QUALITIES).toEqual(["rascunho", "padrao", "alta"]);
    const custos = IMAGE_QUALITIES.map((level) => IMAGE_QUALITY[level].costUsd);
    expect(custos).toEqual([...custos].sort((a, b) => a - b));
  });

  it("usa o nível intermediário como padrão", () => {
    expect(DEFAULT_IMAGE_QUALITY).toBe("padrao");
  });

  it("estima o custo pela quantidade escolhida", () => {
    expect(estimatedCost("rascunho", 10)).toBeCloseTo(0.39);
    expect(estimatedCost("alta", 4)).toBeCloseTo(0.62);
  });

  it("não devolve custo negativo", () => {
    expect(estimatedCost("alta", -3)).toBe(0);
    expect(estimatedCost("alta", 0)).toBe(0);
  });

  it("descreve para que serve cada nível", () => {
    for (const level of IMAGE_QUALITIES) {
      expect(IMAGE_QUALITY[level].description.length).toBeGreaterThan(20);
      expect(IMAGE_QUALITY[level].label).toBeTruthy();
    }
  });
});
