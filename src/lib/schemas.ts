import { z } from "zod";

/** Formatos suportados na composição determinística. */
export const FORMATS = ["4:5", "1:1", "9:16"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABEL: Record<Format, string> = {
  "4:5": "Feed 4:5",
  "1:1": "Quadrado 1:1",
  "9:16": "Story 9:16",
};

export const FORMAT_SIZE: Record<Format, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

export const CHANNELS = ["Meta Ads", "Instagram", "Google Ads", "TikTok", "E-mail", "WhatsApp"] as const;

// ------------------------------------------------------------------- auth
export const signInSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres")
    .regex(/[a-zA-Z]/, "Inclua ao menos uma letra")
    .regex(/[0-9]/, "Inclua ao menos um número"),
});

export const recoverSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
    confirm: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As duas senhas precisam ser iguais",
    path: ["confirm"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

// ------------------------------------------------------------------ marca
export const brandColorSchema = z.object({
  hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use um hex como #B4623A"),
  role: z.enum(["primaria", "secundaria", "apoio", "fundo", "texto"]).default("apoio"),
  label: z.string().trim().max(40).default(""),
});

export const competitorSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  note: z.string().trim().max(280).default(""),
});

export const proofSchema = z.object({
  statement: z.string().trim().min(1, "Descreva a prova"),
  source: z.string().trim().max(200).default(""),
});

export const offerSchema = z.object({
  name: z.string().trim().min(1, "Informe a oferta"),
  detail: z.string().trim().max(280).default(""),
});

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da marca"),
  description: z.string().trim().max(2000).default(""),
  website: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use uma URL com http:// ou https://")
    .default(""),
  segment: z.string().trim().max(120).default(""),
  voice_tone: z.string().trim().max(200).default(""),
  voice_notes: z.string().trim().max(2000).default(""),
  recommended_words: z.array(z.string().trim().min(1)).max(60).default([]),
  forbidden_words: z.array(z.string().trim().min(1)).max(60).default([]),
  forbidden_promises: z.array(z.string().trim().min(1)).max(60).default([]),
  differentiators: z.array(z.string().trim().min(1)).max(30).default([]),
  competitors: z.array(competitorSchema).max(20).default([]),
  proofs: z.array(proofSchema).max(20).default([]),
  recurring_offers: z.array(offerSchema).max(20).default([]),
  colors: z.array(brandColorSchema).max(12).default([]),
  typography: z
    .object({
      headline: z.string().trim().max(80).default(""),
      body: z.string().trim().max(80).default(""),
    })
    .default({ headline: "", body: "" }),
  channels: z.array(z.string().trim()).max(12).default([]),
  formats: z.array(z.string().trim()).max(12).default([]),
  cadence: z.string().trim().max(80).default(""),
});

export type BrandInput = z.infer<typeof brandSchema>;
export type BrandFormInput = z.input<typeof brandSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto"),
  description: z.string().trim().max(1200).default(""),
  price_cents: z.number().int().min(0).nullable().default(null),
  url: z.string().trim().max(300).default(""),
  highlights: z.array(z.string().trim().min(1)).max(12).default([]),
});

export const audienceSchema = z.object({
  name: z.string().trim().min(2, "Informe o público"),
  description: z.string().trim().max(1200).default(""),
  pains: z.array(z.string().trim().min(1)).max(12).default([]),
  desires: z.array(z.string().trim().min(1)).max(12).default([]),
  objections: z.array(z.string().trim().min(1)).max(12).default([]),
  is_primary: z.boolean().default(false),
});

// --------------------------------------------------------------- briefing
export const briefSchema = z.object({
  campaign_name: z.string().trim().min(2, "Dê um nome à campanha"),
  objective: z.string().trim().min(2, "Informe o objetivo"),
  product: z.string().trim().min(1, "Informe o produto"),
  audience: z.string().trim().min(1, "Informe o público"),
  offer: z.string().trim().default(""),
  channel: z.string().trim().min(1, "Informe o canal"),
  formats: z.array(z.enum(FORMATS)).min(1, "Escolha ao menos um formato"),
  quantity: z.number().int().min(1, "Mínimo de 1").max(30, "Máximo de 30 por campanha"),
  voice_tone: z.string().trim().default(""),
  restrictions: z.array(z.string().trim()).default([]),
  occasion: z.string().trim().default(""),
  occasion_date: z.string().trim().default(""),
  cta: z.string().trim().min(1, "Informe o CTA"),
  primary_metric: z.string().trim().min(1, "Informe a métrica principal"),
});

export type Brief = z.infer<typeof briefSchema>;
/** Entrada do formulário: campos com default são opcionais antes da validação. */
export type BriefInput = z.input<typeof briefSchema>;

/** Resposta estruturada da conversa: ou pede informação, ou entrega o briefing. */
export const chatTurnSchema = z.object({
  reply: z.string().trim().min(1),
  questions: z.array(z.string().trim().min(1)).max(3).default([]),
  brief: briefSchema.nullable().default(null),
  ready: z.boolean().default(false),
});

export type ChatTurn = z.infer<typeof chatTurnSchema>;

// --------------------------------------------------------------- direções
export const directionSchema = z.object({
  name: z.string().trim().min(2),
  hypothesis: z.string().trim().min(2),
  problem: z.string().trim().min(2),
  promise: z.string().trim().min(2),
  hook: z.string().trim().min(2),
  mechanism: z.string().trim().min(2),
  proof: z.string().trim().default(""),
  objection: z.string().trim().default(""),
  cta: z.string().trim().min(1),
  visual_prompt: z.string().trim().min(10),
  rationale: z.string().trim().default(""),
  copies: z
    .array(
      z.object({
        headline: z.string().trim().min(2),
        subheadline: z.string().trim().default(""),
        body: z.string().trim().default(""),
        cta: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(5),
});

export const directionsResponseSchema = z.object({
  directions: z.array(directionSchema).min(3).max(5),
});

export type DirectionInput = z.infer<typeof directionSchema>;

// ---------------------------------------------------------------- rotinas
export const routineSchema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome à rotina"),
    brand_id: z.string().uuid("Escolha a marca"),
    product_id: z.string().uuid().nullable().default(null),
    objective: z.string().trim().max(400).default(""),
    frequency: z.enum(["semanal", "quinzenal", "mensal", "data_especifica"]),
    weekday: z.number().int().min(0).max(6).nullable().default(null),
    day_of_month: z.number().int().min(1).max(28).nullable().default(null),
    specific_date: z.string().trim().nullable().default(null),
    run_at: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").default("08:00"),
    timezone: z.string().trim().default("America/Sao_Paulo"),
    channel: z.string().trim().min(1).default("Meta Ads"),
    formats: z.array(z.enum(FORMATS)).min(1, "Escolha ao menos um formato"),
    quantity: z.number().int().min(1).max(30),
    recurring_offer: z.string().trim().max(280).default(""),
    instructions: z.string().trim().max(1200).default(""),
    requires_approval: z.boolean().default(true),
    auto_generate: z.boolean().default(false),
    allow_image_generation: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if ((value.frequency === "semanal" || value.frequency === "quinzenal") && value.weekday === null) {
      ctx.addIssue({ code: "custom", path: ["weekday"], message: "Escolha o dia da semana" });
    }
    if (value.frequency === "mensal" && value.day_of_month === null) {
      ctx.addIssue({ code: "custom", path: ["day_of_month"], message: "Escolha o dia do mês (1 a 28)" });
    }
    if (value.frequency === "data_especifica" && !value.specific_date) {
      ctx.addIssue({ code: "custom", path: ["specific_date"], message: "Escolha a data" });
    }
    if (value.allow_image_generation && !value.auto_generate) {
      ctx.addIssue({
        code: "custom",
        path: ["allow_image_generation"],
        message: "Gerar imagens sozinha exige a geração automática ligada",
      });
    }
  });

export type RoutineInput = z.infer<typeof routineSchema>;
export type RoutineFormInput = z.input<typeof routineSchema>;

// -------------------------------------------------------------- resultados
export const performanceSchema = z
  .object({
    campaign_id: z.string().uuid(),
    asset_id: z.string().uuid().nullable().default(null),
    winner_asset_id: z.string().uuid().nullable().default(null),
    period_start: z.string().min(1, "Informe o início do período"),
    period_end: z.string().min(1, "Informe o fim do período"),
    spend_cents: z.number().int().min(0).default(0),
    impressions: z.number().int().min(0).default(0),
    clicks: z.number().int().min(0).default(0),
    leads: z.number().int().min(0).default(0),
    purchases: z.number().int().min(0).default(0),
    revenue_cents: z.number().int().min(0).default(0),
    notes: z.string().trim().max(1200).default(""),
  })
  .superRefine((value, ctx) => {
    if (value.period_end < value.period_start) {
      ctx.addIssue({ code: "custom", path: ["period_end"], message: "O fim precisa ser depois do início" });
    }
    if (value.impressions > 0 && value.clicks > value.impressions) {
      ctx.addIssue({ code: "custom", path: ["clicks"], message: "Cliques não podem passar das impressões" });
    }
  });

export type PerformanceInput = z.infer<typeof performanceSchema>;
export type PerformanceFormInput = z.input<typeof performanceSchema>;

// ------------------------------------------------------------- onboarding
export const onboardingSchema = z.object({
  company: z.string().trim().min(2, "Informe o nome da empresa"),
  website: z.string().trim().default(""),
  segment: z.string().trim().default(""),
  description: z.string().trim().default(""),
  colors: z.array(brandColorSchema).default([]),
  products: z.array(z.object({ name: z.string().trim().min(1), description: z.string().trim().default("") })).default([]),
  audience: z.string().trim().default(""),
  audience_pains: z.array(z.string().trim()).default([]),
  voice_tone: z.string().trim().default(""),
  channels: z.array(z.string().trim()).default([]),
  formats: z.array(z.string().trim()).default([]),
  cadence: z.string().trim().default(""),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
