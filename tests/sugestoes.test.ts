import { describe, expect, it } from "vitest";
import { nomeCurtoDaMarca, proximaOcasiao, sugestoesDeCampanha } from "../src/features/campaigns/sugestoes";

const marca = {
  produtos: [{ name: "Condicionador Hidratação e Volume" }, { name: "Shampoo Limpeza e Volume" }],
  ofertas: [{ name: "Frete grátis", detail: "acima de R$ 120" }],
  diferenciais: ["Fórmula sem sulfato"],
  nomeDaMarca: "OTO",
};

describe("proximaOcasiao", () => {
  it("acha a ocasião comercial mais próxima dentro da janela útil", () => {
    // 3 de setembro: o Dia do Cliente é 15/9, doze dias depois.
    expect(proximaOcasiao(new Date(2026, 8, 3))).toEqual({ nome: "Dia do Cliente", dias: 12 });
  });

  it("calcula as datas móveis", () => {
    // Black Friday de 2026 cai em 27 de novembro.
    expect(proximaOcasiao(new Date(2026, 10, 1))?.nome).toBe("Black Friday");
    // Dia das Mães de 2027: segundo domingo de maio, dia 9.
    expect(proximaOcasiao(new Date(2027, 3, 20))?.nome).toBe("Dia das Mães");
  });

  it("ignora o que já passou e o que ainda está longe demais", () => {
    // 20 de agosto de 2026: Dia dos Pais já passou, Dia do Cliente ainda vem.
    expect(proximaOcasiao(new Date(2026, 7, 20))?.nome).toBe("Dia do Cliente");
  });

  it("véspera não é campanha: menos de três dias não conta", () => {
    expect(proximaOcasiao(new Date(2026, 8, 14))?.nome).not.toBe("Dia do Cliente");
  });

  it("atravessa a virada do ano", () => {
    // 20 de dezembro: o Natal está a 5 dias.
    expect(proximaOcasiao(new Date(2026, 11, 20))?.nome).toBe("Natal");
    // 5 de janeiro: a volta às aulas, no ano seguinte, está a 27 dias.
    expect(proximaOcasiao(new Date(2027, 0, 5))?.nome).toBe("Volta às aulas");
  });

  it("no vazio do calendário, não força uma data", () => {
    // 1º de abril: o Dia das Mães está a 39 dias, longe demais para ser assunto.
    expect(proximaOcasiao(new Date(2026, 3, 1))).toBeNull();
  });
});

describe("sugestoesDeCampanha", () => {
  it("usa o produto real do catálogo, não um exemplo inventado", () => {
    const [primeira] = sugestoesDeCampanha(marca, new Date(2026, 8, 3));
    expect(primeira).toContain("Condicionador Hidratação e Volume");
    expect(primeira).toContain("Dia do Cliente");
  });

  it("puxa de fontes diferentes em cada sugestão", () => {
    const sugestoes = sugestoesDeCampanha(marca, new Date(2026, 8, 3));
    expect(sugestoes).toHaveLength(3);
    expect(sugestoes[1]).toContain("Frete grátis");
    expect(sugestoes[2]).toContain("Shampoo Limpeza e Volume");
  });

  it("sem ocasião próxima, fala do produto sem data", () => {
    // 1º de abril: nada de comercial relevante na janela.
    const [primeira] = sugestoesDeCampanha(marca, new Date(2026, 3, 1));
    expect(primeira).toBe("Quero uma campanha para divulgar Condicionador Hidratação e Volume.");
  });

  it("marca sem catálogo ainda recebe três aberturas, sem inventar produto", () => {
    const sugestoes = sugestoesDeCampanha(
      { produtos: [], ofertas: [], diferenciais: [], nomeDaMarca: "RGSTRA" },
      new Date(2026, 8, 3),
    );
    expect(sugestoes).toHaveLength(3);
    expect(sugestoes[0]).toContain("RGSTRA");
    expect(sugestoes.join(" ")).not.toContain("café");
    expect(sugestoes.join(" ")).not.toContain("software");
  });

  it("aceita oferta gravada como texto solto", () => {
    const sugestoes = sugestoesDeCampanha(
      { produtos: [], ofertas: ["10% na primeira compra"], diferenciais: [], nomeDaMarca: "X" },
      new Date(2026, 8, 3),
    );
    expect(sugestoes.some((item) => item.includes("10% na primeira compra"))).toBe(true);
  });

  it("nunca repete a mesma frase", () => {
    const sugestoes = sugestoesDeCampanha(
      { produtos: [], ofertas: [], diferenciais: null, nomeDaMarca: null },
      new Date(2026, 8, 3),
    );
    expect(new Set(sugestoes).size).toBe(sugestoes.length);
  });
});

describe("nomeCurtoDaMarca", () => {
  it("corta o título de site que o onboarding grava como nome", () => {
    expect(nomeCurtoDaMarca("Leavo AI | Plataforma completa de vendas: IA no WhatsApp e CRM")).toBe(
      "Leavo AI",
    );
    expect(nomeCurtoDaMarca("Minas Estate — cafés especiais")).toBe("Minas Estate");
  });

  it("trunca nome longo sem separador", () => {
    expect(nomeCurtoDaMarca("A".repeat(60))).toHaveLength(41);
  });

  it("aceita ausência de nome", () => {
    expect(nomeCurtoDaMarca(null)).toBe("");
    expect(nomeCurtoDaMarca("  ")).toBe("");
  });
});

describe("sugestoesDeCampanha · catálogo curto", () => {
  const umProduto = {
    produtos: [{ name: "Registro da marca" }],
    ofertas: [],
    diferenciais: [],
    nomeDaMarca: "RGSTRA",
  };

  it("não repete a ocasião em duas sugestões", () => {
    const sugestoes = sugestoesDeCampanha(umProduto, new Date(2026, 8, 3));
    const comOcasiao = sugestoes.filter((item) => item.includes("Dia do Cliente"));
    expect(comOcasiao).toHaveLength(1);
  });

  it("com um produto só, muda o ângulo em vez de repetir a data", () => {
    const sugestoes = sugestoesDeCampanha(umProduto, new Date(2026, 8, 3));
    expect(sugestoes[1]).toBe("Crie anúncios de Registro da marca para quem ainda não conhece a marca.");
  });

  it("nome comprido não vaza para dentro da frase", () => {
    const sugestoes = sugestoesDeCampanha(
      { produtos: [], ofertas: [], diferenciais: [], nomeDaMarca: "Leavo AI | Plataforma completa de vendas: IA no WhatsApp e CRM" },
      new Date(2026, 8, 3),
    );
    expect(sugestoes[0]).toBe("Quero uma campanha de Dia do Cliente para Leavo AI.");
  });
});
