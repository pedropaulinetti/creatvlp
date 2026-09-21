/**
 * O corte do título numa peça real.
 *
 * A vitrine escreve numa coluna de 39% da peça, e palavra não quebra. Com o
 * corpo escolhido só pelo comprimento total, "TRATAMENTO COMPLETO" saía pela
 * direita e o `overflow: hidden` comia as últimas letras: a peça foi ao ar
 * como "TRATAMEN" e "COMPLET".
 */
import { describe, expect, it } from "vitest";
import { corpoDoTitulo } from "@/features/creatives/arquetipos";

const COLUNA_DA_VITRINE = 39;
const LARGURA_DA_LETRA = 0.62;

/** Quanto a maior palavra ocupa, em % da peça, no corpo escolhido. */
function larguraDaMaiorPalavra(texto: string, corpo: number) {
  const maior = texto.trim().split(/\s+/).reduce((n, p) => Math.max(n, p.length), 0);
  return maior * LARGURA_DA_LETRA * corpo;
}

describe("corpoDoTitulo", () => {
  it("cabe a maior palavra na coluna, que é onde cortava", () => {
    const titulo = "Seu cabelo merece um tratamento completo";
    const corpo = corpoDoTitulo(titulo, 11, 6.2, COLUNA_DA_VITRINE);

    expect(larguraDaMaiorPalavra(titulo, corpo)).toBeLessThanOrEqual(COLUNA_DA_VITRINE);
  });

  it("sem a coluna informada, mede só pelo comprimento", () => {
    const titulo = "Seu cabelo merece um tratamento completo";
    expect(corpoDoTitulo(titulo, 11, 6.2)).toBeGreaterThan(corpoDoTitulo(titulo, 11, 6.2, COLUNA_DA_VITRINE));
  });

  it("título curto continua grande", () => {
    expect(corpoDoTitulo("Mais volume", 11, 6.2, COLUNA_DA_VITRINE)).toBeGreaterThan(9);
  });

  it("uma palavra enorme não reduz o título a nada", () => {
    expect(corpoDoTitulo("Anticonstitucionalissimamente", 11, 6.2, COLUNA_DA_VITRINE)).toBeGreaterThanOrEqual(3.6);
  });

  it("qualquer título real cabe na coluna da vitrine", () => {
    const reais = [
      "Seu cabelo merece um tratamento completo",
      "Mais volume de cabelo já no primeiro uso",
      "Transformação visível desde a primeira aplicação",
      "Café especial direto do produtor",
      "Resultados comprovados cientificamente",
    ];
    for (const titulo of reais) {
      const corpo = corpoDoTitulo(titulo, 11, 6.2, COLUNA_DA_VITRINE);
      expect(larguraDaMaiorPalavra(titulo, corpo), titulo).toBeLessThanOrEqual(COLUNA_DA_VITRINE);
    }
  });
});
