import { describe, expect, it } from "vitest";
import {
  briefSchema,
  chatTurnSchema,
  copySchema, signUpSchema, routineSchema, performanceSchema, brandSchema, directionsResponseSchema,
} from "@/lib/schemas";

const validBrief = {
  campaign_name: "Dia dos Pais",
  objective: "Vendas",
  product: "Café especial",
  audience: "Amantes de café",
  channel: "Meta Ads",
  formats: ["4:5"],
  quantity: 6,
  cta: "Comprar agora",
  primary_metric: "ROAS",
};

describe("briefSchema", () => {
  it("aceita um briefing completo e aplica os padrões", () => {
    const result = briefSchema.parse(validBrief);
    expect(result.offer).toBe("");
    expect(result.restrictions).toEqual([]);
    expect(result.quantity).toBe(6);
  });

  it("recusa quantidade acima do teto de 30 peças", () => {
    const result = briefSchema.safeParse({ ...validBrief, quantity: 31 });
    expect(result.success).toBe(false);
  });

  it("recusa quantidade zero", () => {
    expect(briefSchema.safeParse({ ...validBrief, quantity: 0 }).success).toBe(false);
  });

  it("recusa formato fora dos três suportados", () => {
    expect(briefSchema.safeParse({ ...validBrief, formats: ["16:9"] }).success).toBe(false);
  });

  it("exige ao menos um formato", () => {
    expect(briefSchema.safeParse({ ...validBrief, formats: [] }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("exige senha com letra e número", () => {
    expect(signUpSchema.safeParse({ fullName: "Pedro", email: "a@b.com", password: "somenteletras" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Pedro", email: "a@b.com", password: "12345678" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Pedro", email: "a@b.com", password: "senha1234" }).success).toBe(true);
  });

  it("recusa e-mail inválido", () => {
    expect(signUpSchema.safeParse({ fullName: "Pedro", email: "sem-arroba", password: "senha1234" }).success).toBe(false);
  });
});

describe("routineSchema", () => {
  const base = {
    name: "Promoções da semana",
    brand_id: "11111111-1111-4111-8111-111111111111",
    frequency: "semanal" as const,
    weekday: 1,
    formats: ["4:5"],
    quantity: 6,
    run_at: "08:00",
  };

  it("aceita rotina semanal com dia da semana", () => {
    expect(routineSchema.safeParse(base).success).toBe(true);
  });

  it("exige dia da semana quando a frequência é semanal", () => {
    const result = routineSchema.safeParse({ ...base, weekday: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("weekday"))).toBe(true);
    }
  });

  it("exige dia do mês quando a frequência é mensal", () => {
    const result = routineSchema.safeParse({ ...base, frequency: "mensal", weekday: null, day_of_month: null });
    expect(result.success).toBe(false);
  });

  it("não deixa gerar imagem sem geração automática ligada", () => {
    const result = routineSchema.safeParse({ ...base, auto_generate: false, allow_image_generation: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("allow_image_generation"))).toBe(true);
    }
  });

  it("permite gerar imagem quando a geração automática está ligada", () => {
    expect(
      routineSchema.safeParse({ ...base, auto_generate: true, allow_image_generation: true }).success,
    ).toBe(true);
  });
});

describe("performanceSchema", () => {
  const base = {
    campaign_id: "11111111-1111-4111-8111-111111111111",
    period_start: "2026-08-01",
    period_end: "2026-08-07",
    spend_cents: 10000,
    impressions: 5000,
    clicks: 100,
  };

  it("aceita um período válido", () => {
    expect(performanceSchema.safeParse(base).success).toBe(true);
  });

  it("recusa período invertido", () => {
    const result = performanceSchema.safeParse({ ...base, period_end: "2026-07-01" });
    expect(result.success).toBe(false);
  });

  it("recusa mais cliques do que impressões", () => {
    const result = performanceSchema.safeParse({ ...base, clicks: 6000 });
    expect(result.success).toBe(false);
  });

  it("recusa valores negativos", () => {
    expect(performanceSchema.safeParse({ ...base, spend_cents: -1 }).success).toBe(false);
  });
});

describe("brandSchema", () => {
  it("recusa site sem protocolo", () => {
    const result = brandSchema.safeParse({ name: "Marca", website: "suamarca.com.br" });
    expect(result.success).toBe(false);
  });

  it("aceita site vazio", () => {
    expect(brandSchema.safeParse({ name: "Marca", website: "" }).success).toBe(true);
  });
});

describe("directionsResponseSchema", () => {
  const direction = {
    name: "Caminho",
    hypothesis: "Hipótese",
    problem: "Problema",
    promise: "Promessa",
    hook: "Hook",
    mechanism: "Mecanismo",
    cta: "Comprar",
    visual_prompt: "Cena com luz natural sobre mesa de madeira clara.",
    copies: [{ headline: "Headline", cta: "Comprar" }],
  };

  it("exige de 3 a 5 caminhos", () => {
    expect(directionsResponseSchema.safeParse({ directions: [direction, direction] }).success).toBe(false);
    expect(directionsResponseSchema.safeParse({ directions: Array(4).fill(direction) }).success).toBe(true);
    expect(directionsResponseSchema.safeParse({ directions: Array(6).fill(direction) }).success).toBe(false);
  });

  it("exige prompt visual com alguma substância", () => {
    const result = directionsResponseSchema.safeParse({
      directions: Array(3).fill({ ...direction, visual_prompt: "curto" }),
    });
    expect(result.success).toBe(false);
  });
});

describe("perguntas da entrevista de campanha", () => {
  it("aceita pergunta com opções tiradas da memória da marca", () => {
    const turno = chatTurnSchema.parse({
      reply: "Preciso saber duas coisas.",
      questions: [
        { question: "O que essa campanha vai vender?", options: ["Kit 3 Tech T-Shirt®", "Perfect Top"] },
      ],
      brief: null,
      ready: false,
    });
    expect(turno.questions[0].options).toEqual(["Kit 3 Tech T-Shirt®", "Perfect Top"]);
  });

  it("aceita a forma antiga, só texto, para conversa já gravada não quebrar", () => {
    const turno = chatTurnSchema.parse({
      reply: "ok",
      questions: ["Qual o objetivo?"],
      brief: null,
      ready: false,
    });
    expect(turno.questions[0]).toEqual({ question: "Qual o objetivo?", options: [] });
  });

  it("pergunta aberta pode vir sem opção nenhuma", () => {
    const turno = chatTurnSchema.parse({
      reply: "ok",
      questions: [{ question: "Qual a ocasião?" }],
      brief: null,
      ready: false,
    });
    expect(turno.questions[0].options).toEqual([]);
  });
});

describe("cada formato de copy cobra o seu próprio conteúdo", () => {
  const base = { cta: "Comprar agora" };

  it("copy de título exige headline", () => {
    expect(copySchema.safeParse({ ...base, formato: "titulo", headline: "" }).success).toBe(false);
    expect(copySchema.safeParse({ ...base, formato: "titulo", headline: "Sua camiseta evoluiu" }).success).toBe(true);
  });

  it("enquete vale sem headline, mas não sem pergunta", () => {
    // Exigir headline de todos era o que impedia a enquete de existir: o modelo
    // devolvia headline vazia, como pedido, e o schema derrubava a campanha.
    expect(copySchema.safeParse({ ...base, formato: "enquete", pergunta: "" }).success).toBe(false);

    const valida = copySchema.safeParse({
      ...base,
      formato: "enquete",
      pergunta: "O que mais te deixa inseguro ao presentear?",
      opcoes: [{ texto: "Se ele vai gostar", votos: 7 }],
    });
    expect(valida.success).toBe(true);
    expect(valida.success && valida.data.headline).toBe("");
  });

  it("conversa precisa de ao menos dois balões", () => {
    const um = { ...base, formato: "conversa", mensagens: [{ de: "pessoa", texto: "amassa?" }] };
    expect(copySchema.safeParse(um).success).toBe(false);

    const dois = {
      ...base,
      formato: "conversa",
      mensagens: [
        { de: "pessoa", texto: "amassa na mala?" },
        { de: "marca", texto: "não amassa — o tecido volta sozinho." },
      ],
    };
    expect(copySchema.safeParse(dois).success).toBe(true);
  });

  it("campo nulo vale como campo ausente", () => {
    /*
     * O modelo, mandado deixar vazio o que o formato não usa, devolve
     * "pergunta": null numa copy de título — e a geração inteira caía com
     * invalid_type por causa de um campo que ninguém ia ler.
     */
    const parsed = copySchema.safeParse({
      ...base,
      formato: "titulo",
      headline: "Sua camiseta evoluiu",
      pergunta: null,
      opcoes: null,
      mensagens: null,
      bullets: null,
      subheadline: null,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.pergunta).toBe("");
    expect(parsed.success && parsed.data.opcoes).toEqual([]);
  });

  it("balão comprido demais é aparado, não derruba a conversa", () => {
    // O teto é de desenho: cortar a ponta custa uma frase, rejeitar custa a campanha.
    const parsed = copySchema.safeParse({
      ...base,
      formato: "conversa",
      mensagens: [
        { de: "pessoa", texto: "amassa na mala?" },
        { de: "marca", texto: `não amassa. ${"palavra ".repeat(40)}fim` },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.mensagens[1].texto.length).toBeLessThanOrEqual(140);
  });

  it("sem formato declarado, vale título — que é o comportamento antigo", () => {
    const parsed = copySchema.parse({ ...base, headline: "Camiseta que não amassa" });
    expect(parsed.formato).toBe("titulo");
  });
});
