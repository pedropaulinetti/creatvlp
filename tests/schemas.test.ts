import { describe, expect, it } from "vitest";
import {
  briefSchema, signUpSchema, routineSchema, performanceSchema, brandSchema, directionsResponseSchema,
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
