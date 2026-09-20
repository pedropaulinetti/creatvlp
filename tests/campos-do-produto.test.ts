import { describe, expect, it } from "vitest";
import { centavosDeTexto, textoDeCentavos } from "../src/features/brand/CamposDoProduto";

describe("centavosDeTexto", () => {
  it("aceita vírgula e ponto como separador decimal", () => {
    expect(centavosDeTexto("89,90")).toBe(8990);
    expect(centavosDeTexto("89.90")).toBe(8990);
  });

  it("ignora o símbolo da moeda que a pessoa digita junto", () => {
    expect(centavosDeTexto("R$ 89,90")).toBe(8990);
  });

  it("aceita inteiro sem centavos", () => {
    expect(centavosDeTexto("120")).toBe(12000);
  });

  it("arredonda o terceiro decimal em vez de truncar", () => {
    expect(centavosDeTexto("10,005")).toBe(1001);
  });

  it("campo vazio é ausência de preço, não zero", () => {
    expect(centavosDeTexto("")).toBeNull();
    expect(centavosDeTexto("   ")).toBeNull();
  });

  it("recusa texto e preço negativo", () => {
    expect(centavosDeTexto("grátis")).toBeNull();
    expect(centavosDeTexto("-10")).toBeNull();
  });
});

describe("textoDeCentavos", () => {
  it("mostra com vírgula, como se escreve em português", () => {
    expect(textoDeCentavos(8990)).toBe("89,90");
    expect(textoDeCentavos(12000)).toBe("120,00");
  });

  it("sem preço, campo vazio", () => {
    expect(textoDeCentavos(null)).toBe("");
    expect(textoDeCentavos(undefined)).toBe("");
  });

  it("ida e volta não perde valor", () => {
    for (const centavos of [1, 99, 8990, 123456]) {
      expect(centavosDeTexto(textoDeCentavos(centavos))).toBe(centavos);
    }
  });
});
