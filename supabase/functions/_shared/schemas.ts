import { z } from "npm:zod@3.23.8";

export const FORMATS = ["4:5", "1:1", "9:16"] as const;

export const briefSchema = z.object({
  campaign_name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  product: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  offer: z.string().trim().default(""),
  channel: z.string().trim().min(1),
  formats: z.array(z.enum(FORMATS)).min(1),
  quantity: z.number().int().min(1).max(30),
  voice_tone: z.string().trim().default(""),
  restrictions: z.array(z.string().trim()).default([]),
  occasion: z.string().trim().default(""),
  occasion_date: z.string().trim().default(""),
  cta: z.string().trim().min(1),
  primary_metric: z.string().trim().min(1),
});

export const chatTurnSchema = z.object({
  reply: z.string().trim().min(1),
  questions: z.array(z.string().trim().min(1)).max(3).default([]),
  brief: briefSchema.nullable().default(null),
  ready: z.boolean().default(false),
});

export const copySchema = z.object({
  headline: z.string().trim().min(2).max(120),
  subheadline: z.string().trim().max(160).default(""),
  body: z.string().trim().max(600).default(""),
  cta: z.string().trim().min(1).max(40),
});

/**
 * Dentro de um caminho, a copy pode não trazer CTA próprio — nesse caso ela
 * herda o CTA do caminho. Exigir o campo aqui só quebra a geração sem motivo.
 */
const directionCopySchema = copySchema.extend({
  cta: z.string().trim().min(1).max(40).optional(),
});

export const directionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hypothesis: z.string().trim().min(2),
  problem: z.string().trim().min(2),
  promise: z.string().trim().min(2),
  hook: z.string().trim().min(2).max(160),
  mechanism: z.string().trim().min(2),
  proof: z.string().trim().default(""),
  objection: z.string().trim().default(""),
  cta: z.string().trim().min(1).max(40),
  visual_prompt: z.string().trim().min(10),
  rationale: z.string().trim().default(""),
  copies: z.array(directionCopySchema).min(1).max(5),
});

export const directionsResponseSchema = z.object({
  directions: z.array(directionSchema).min(3).max(5),
});

export const copiesResponseSchema = z.object({
  copies: z.array(copySchema).min(1).max(5),
});

export const brandAnalysisSchema = z.object({
  name: z.string().trim().default(""),
  description: z.string().trim().max(1200).default(""),
  segment: z.string().trim().max(120).default(""),
  voice_tone: z.string().trim().max(200).default(""),
  colors: z
    .array(
      z.object({
        hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        role: z.enum(["primaria", "secundaria", "apoio", "fundo", "texto"]).default("apoio"),
        label: z.string().trim().max(40).default(""),
      }),
    )
    .max(8)
    .default([]),
  products: z
    .array(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(400).default("") }))
    .max(10)
    .default([]),
  audience: z.string().trim().max(400).default(""),
  differentiators: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  confidence: z.enum(["alta", "media", "baixa"]).default("media"),
});

export const nextTestSchema = z.object({
  best_angle: z.string().trim().default(""),
  best_hook: z.string().trim().default(""),
  best_format: z.string().trim().default(""),
  best_offer: z.string().trim().default(""),
  learnings: z.array(z.string().trim().min(1)).max(6).default([]),
  next_test: z.string().trim().min(2),
  caveat: z.string().trim().default(""),
});

export type Brief = z.infer<typeof briefSchema>;
export type DirectionPayload = z.infer<typeof directionSchema>;
export type BrandAnalysis = z.infer<typeof brandAnalysisSchema>;
