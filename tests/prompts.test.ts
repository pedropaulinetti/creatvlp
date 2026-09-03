import { describe, expect, it } from "vitest";
import {
  brandContext, chatSystemPrompt, directionsPrompt, imagePrompt, nextTestPrompt,
} from "../supabase/functions/_shared/prompts.ts";

const brand = {
  name: "Minas Estate Coffee",
  description: "Torrefação de cafés especiais",
  website: "https://minasestate.com.br",
  segment: "Alimentos e bebidas",
  voice_tone: "Próximo e informativo",
  voice_notes: "Fala em primeira pessoa do plural",
  recommended_words: ["origem", "torra"],
  forbidden_words: ["barato", "imperdível"],
  forbidden_promises: ["emagrece"],
  differentiators: ["Origem rastreável"],
  competitors: [{ name: "Concorrente A", note: "forte em varejo" }],
  proofs: [{ statement: "2 mil clientes recorrentes", source: "CRM" }],
  recurring_offers: [{ name: "Frete grátis", detail: "acima de R$ 120" }],
  colors: [{ hex: "#B4623A", role: "primaria" }],
  channels: ["Meta Ads"],
  formats: ["4:5"],
};

const brief = {
  campaign_name: "Dia dos Pais",
  objective: "Vendas",
  product: "Café especial",
  audience: "Amantes de café",
  offer: "10% off",
  channel: "Meta Ads",
  formats: ["4:5" as const],
  quantity: 6,
  voice_tone: "",
  restrictions: [],
  occasion: "Dia dos Pais",
  occasion_date: "",
  cta: "Comprar agora",
  primary_metric: "ROAS",
};

describe("brandContext", () => {
  it("inclui as restrições que a IA precisa respeitar", () => {
    const context = brandContext(brand);
    expect(context).toContain("Palavras PROIBIDAS");
    expect(context).toContain("barato");
    expect(context).toContain("Promessas PROIBIDAS");
    expect(context).toContain("emagrece");
  });

  it("achata listas de objetos de forma legível", () => {
    const context = brandContext(brand);
    expect(context).toContain("2 mil clientes recorrentes — CRM");
    expect(context).toContain("Frete grátis — acima de R$ 120");
  });

  it("marca campos ausentes em vez de deixar vazio", () => {
    const context = brandContext({ ...brand, differentiators: [], proofs: [] });
    expect(context).toContain("Diferenciais: não informado");
    expect(context).toContain("Provas e credenciais: não informado");
  });

  it("diz explicitamente quando não há palavra proibida", () => {
    const context = brandContext({ ...brand, forbidden_words: [] });
    expect(context).toContain("Palavras PROIBIDAS (nunca use): nenhuma");
  });

  it("inclui produtos, públicos e aprendizados quando existem", () => {
    const context = brandContext(
      brand,
      [{ name: "Bourbon Amarelo", description: "Torra média", price_cents: 8990, highlights: ["doce"] }],
      [{ name: "Baristas caseiros", description: "Fazem café em casa", pains: ["não sabe escolher"], desires: null, objections: null }],
      [{ kind: "angulo", statement: "Prova social funcionou", confidence: "sinal" }],
    );
    expect(context).toContain("Bourbon Amarelo");
    expect(context).toContain("R$ 89.90");
    expect(context).toContain("Baristas caseiros");
    expect(context).toContain("[angulo/sinal]");
  });
});

describe("chatSystemPrompt", () => {
  it("limita as perguntas complementares a três", () => {
    const prompt = chatSystemPrompt(brandContext(brand));
    expect(prompt).toContain("no máximo 3 perguntas");
  });

  it("impede que a IA peça o que já está na memória", () => {
    expect(chatSystemPrompt("contexto")).toContain("Não peça o que já está nela");
  });

  it("exige JSON puro, sem markdown", () => {
    expect(chatSystemPrompt("contexto")).toContain("sem markdown");
  });
});

describe("directionsPrompt", () => {
  it("proíbe texto dentro da imagem", () => {
    const prompt = directionsPrompt(brandContext(brand), brief, 4);
    expect(prompt).toContain("É proibido pedir texto, headline, logotipo, preço, selo, botão ou CTA dentro da imagem");
  });

  it("impede inventar prova que não está na marca", () => {
    const prompt = directionsPrompt("contexto", brief, 4);
    expect(prompt).toContain('só pode citar provas que estejam na memória da marca');
  });

  it("pede a quantidade solicitada de caminhos", () => {
    expect(directionsPrompt("contexto", brief, 5)).toContain("propor 5 caminhos");
  });

  it("carrega o briefing inteiro para o modelo", () => {
    const prompt = directionsPrompt("contexto", brief, 3);
    expect(prompt).toContain("Dia dos Pais");
    expect(prompt).toContain("ROAS");
  });
});

describe("imagePrompt", () => {
  it("reforça que nenhum texto pode aparecer na imagem", () => {
    const prompt = imagePrompt("Mesa de madeira com xícara ao centro", brand, "4:5");
    expect(prompt).toContain("não pode conter nenhum texto");
    expect(prompt).toContain("logotipo");
    expect(prompt).toContain("etiqueta de preço");
  });

  it("traduz o formato para orientação de enquadramento", () => {
    expect(imagePrompt("cena", brand, "9:16")).toContain("vertical 9:16");
    expect(imagePrompt("cena", brand, "1:1")).toContain("quadrado 1:1");
    expect(imagePrompt("cena", brand, "4:5")).toContain("vertical 4:5");
  });

  it("pede espaço negativo dentro da cena, não um bloco chapado", () => {
    const prompt = imagePrompt("cena", brand, "4:5");
    expect(prompt).toContain("espaço negativo natural");
    // O bloco chapado era o defeito: a foto precisa preencher o quadro.
    expect(prompt).toContain("preenche o quadro inteiro");
    expect(prompt).toContain("sem faixas");
  });

  it("mantém a descrição de cena vinda do caminho criativo", () => {
    expect(imagePrompt("Mesa de madeira com xícara ao centro", brand, "4:5")).toContain(
      "Mesa de madeira com xícara ao centro",
    );
  });
});

describe("nextTestPrompt", () => {
  it("proíbe afirmar causalidade com pouca amostra", () => {
    const prompt = nextTestPrompt("contexto", [], []);
    expect(prompt).toContain("NUNCA afirme causalidade");
    expect(prompt).toContain("sinal observado");
  });

  it("proíbe inventar métrica ausente", () => {
    expect(nextTestPrompt("contexto", [], [])).toContain("Não invente métrica");
  });
});
