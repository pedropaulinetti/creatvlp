/**
 * Provider fake — usado apenas quando FAKE_AI=true (testes automatizados e CI).
 * Nunca substitui o provider real em produção: `config.ts` só liga com a variável explícita.
 */
import { z } from "npm:zod@3.23.8";
import type { Usage } from "./openrouter.ts";

const usage = (model: string): Usage => ({
  model,
  tokensIn: 120,
  tokensOut: 320,
  costUsd: 0,
  latencyMs: 5,
});

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function fixtureFor(schemaName: string, messages: unknown): unknown {
  const text = JSON.stringify(messages).slice(0, 4000);

  if (schemaName === "chatTurn") {
    return {
      reply: "Entendi o pedido. Montei o briefing com base na memória da marca.",
      questions: [],
      brief: {
        campaign_name: "Campanha de teste",
        objective: "Vendas",
        product: "Produto principal",
        audience: "Público principal",
        offer: "10% na primeira compra",
        channel: "Meta Ads",
        formats: ["4:5", "9:16"],
        quantity: 3,
        voice_tone: "Direto e caloroso",
        restrictions: [],
        occasion: "",
        occasion_date: "",
        cta: "Comprar agora",
        primary_metric: "ROAS",
      },
      ready: true,
    };
  }

  if (schemaName === "directions") {
    return {
      directions: [1, 2, 3].map((index) => ({
        name: `Caminho ${index}`,
        hypothesis: `Hipótese ${index}: o público responde melhor a este ângulo.`,
        problem: "O cliente não sabe qual escolher.",
        promise: "Você acerta na primeira compra.",
        hook: `Hook ${index} para o teste`,
        mechanism: "Curadoria feita por quem torra.",
        proof: "Mais de 2 mil clientes recorrentes.",
        objection: "Preço acima do café de mercado.",
        cta: "Comprar agora",
        visual_prompt: `Cena ${index}: mesa de madeira clara com luz natural difusa e xícara ao centro.`,
        rationale: "Testa apelo racional contra apelo sensorial.",
        copies: [
          { headline: `Headline ${index}A`, subheadline: "Subtítulo curto", body: "Corpo do anúncio.", cta: "Comprar agora" },
          { headline: `Headline ${index}B`, subheadline: "Outro ângulo", body: "Corpo alternativo.", cta: "Ver a seleção" },
          { headline: `Headline ${index}C`, subheadline: "Terceira variação", body: "Mais uma versão.", cta: "Quero provar" },
        ],
      })),
    };
  }

  if (schemaName === "brandAnalysis") {
    return {
      name: "Marca de teste",
      description: "Descrição detectada automaticamente na página analisada.",
      segment: "Alimentos e bebidas",
      voice_tone: "Próximo e informativo",
      colors: [{ hex: "#B4623A", role: "primaria", label: "Terracota" }],
      products: [{ name: "Produto principal", description: "Descrição do produto." }],
      audience: "Pessoas que valorizam qualidade",
      differentiators: ["Origem rastreável"],
      confidence: "media",
    };
  }

  if (schemaName === "nextTest") {
    return {
      best_angle: "Prova social",
      best_hook: "Quem provou, voltou",
      best_format: "9:16",
      best_offer: "Frete grátis acima de R$ 120",
      learnings: ["Sinal observado: stories converteram mais que feed."],
      next_test: "Hipótese para o próximo teste: repetir prova social em 4:5.",
      caveat: "Amostra pequena — trate como sinal, não como conclusão.",
    };
  }

  if (schemaName === "copies") {
    return {
      copies: [
        { headline: "Headline gerada", subheadline: "Subtítulo", body: "Corpo do anúncio.", cta: "Comprar agora" },
      ],
    };
  }

  return { ok: true, echo: text.slice(0, 200) };
}

export function fakeChat<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  schemaName: string,
  messages: unknown,
): Promise<{ data: T; usage: Usage }> {
  const parsed = schema.safeParse(fixtureFor(schemaName, messages));
  if (!parsed.success) {
    throw new Error(`Fixture do provider fake não bate com o schema "${schemaName}"`);
  }
  return Promise.resolve({ data: parsed.data, usage: usage("fake/estruturado") });
}

export function fakeImage(): Promise<{ image: { base64: string; mimeType: string }; usage: Usage }> {
  return Promise.resolve({
    image: { base64: PIXEL, mimeType: "image/png" },
    usage: usage("fake/imagem"),
  });
}
