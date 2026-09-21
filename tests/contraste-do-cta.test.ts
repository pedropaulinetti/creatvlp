/**
 * O botão precisa ser lido.
 *
 * A cor do texto estava cravada em branco em cinco dos oito arquétipos, e o
 * fundo é o acento da marca. Numa marca de verde-limão ou amarelo o CTA saía
 * branco sobre claro e sumia. Apareceu em duas contas diferentes.
 *
 * O limiar de 0.5 é o mesmo que a WCAG usa, e é o mesmo que o prompt do
 * servidor já aplicava para dizer ao modelo qual cor da marca é a clara. O
 * canvas é que não aplicava.
 */
import { describe, expect, it } from "vitest";
import { luminancia, sobre } from "@/features/creatives/composicao";

const CLARO = "#FFFDFA";
const ESCURO = "#171412";

describe("luminância", () => {
  it("reconhece claro e escuro nos extremos", () => {
    expect(luminancia("#FFFFFF")).toBeCloseTo(1, 2);
    expect(luminancia("#000000")).toBeCloseTo(0, 2);
  });

  it("hex malformado não quebra o desenho", () => {
    expect(luminancia("#GGG")).toBe(0);
    expect(luminancia("")).toBe(0);
  });
});

describe("cor do texto sobre o botão", () => {
  it("acento claro pede texto escuro, que era o bug", () => {
    for (const acento of ["#A8E63C", "#F5B700", "#FFE600", "#C9F24D"]) {
      expect(sobre(acento, CLARO, ESCURO), acento).toBe(ESCURO);
    }
  });

  it("acento escuro continua pedindo texto claro", () => {
    for (const acento of ["#B4623A", "#143540", "#171412", "#2B4C7E"]) {
      expect(sobre(acento, CLARO, ESCURO), acento).toBe(CLARO);
    }
  });

  it("as duas saídas vêm da paleta da marca, e não de preto e branco de fora", () => {
    expect([CLARO, ESCURO]).toContain(sobre("#A8E63C", CLARO, ESCURO));
    expect([CLARO, ESCURO]).toContain(sobre("#143540", CLARO, ESCURO));
  });
});
