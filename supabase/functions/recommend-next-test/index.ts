/**
 * Lê os resultados registrados e sugere o próximo teste.
 * Com amostra pequena, fala em "sinal observado" — nunca em causalidade.
 */
import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertBrandInWorkspace, enforceRateLimit } from "../_shared/auth.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { nextTestSchema } from "../_shared/schemas.ts";
import { nextTestPrompt } from "../_shared/prompts.ts";
import { loadBrandMemory } from "../_shared/memory.ts";
import { recordUsage } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable().default(null),
  persist: z.boolean().default(true),
});

/** Abaixo disso, qualquer diferença é ruído. */
const MIN_SAMPLE = 3;

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Informe o workspace e a marca.");
    const { workspace_id: workspaceId, brand_id: brandId, campaign_id: campaignId, persist } = parsed.data;

    await requireMembership(admin, caller.userId, workspaceId);
    await assertBrandInWorkspace(admin, brandId, workspaceId);
    await enforceRateLimit(admin, workspaceId, caller.userId);

    let reportQuery = admin
      .from("performance_reports")
      .select("*, campaign:campaigns(name, objective)")
      .eq("workspace_id", workspaceId)
      .order("period_start", { ascending: false })
      .limit(40);
    if (campaignId) reportQuery = reportQuery.eq("campaign_id", campaignId);

    const { data: reports, error } = await reportQuery;
    if (error) throw errors.internal();

    if (!reports?.length) {
      return json({
        recommendation: null,
        reason: "Ainda não há resultados registrados. Registre o desempenho de uma campanha para receber a recomendação.",
      });
    }

    const { data: directions } = await admin
      .from("creative_directions")
      .select("name, hook, promise, hypothesis, campaign_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(40);

    const { context } = await loadBrandMemory(admin, brandId, workspaceId);

    const { data, usage } = await chatStructured({
      schema: nextTestSchema,
      schemaName: "nextTest",
      model: MODELS.strategy,
      fallbackModel: MODELS.strategyFallback,
      temperature: 0.5,
      maxTokens: 2000,
      messages: [{ role: "user", content: nextTestPrompt(context, reports, directions ?? []) }],
    });

    const sampleSize = reports.length;
    const confidence = sampleSize >= 8 ? "consistente" : sampleSize >= MIN_SAMPLE ? "tendencia" : "sinal";

    if (persist) {
      const rows = [
        ...(data.best_angle ? [{ kind: "angulo", statement: data.best_angle }] : []),
        ...(data.best_hook ? [{ kind: "hook", statement: data.best_hook }] : []),
        ...(data.best_format ? [{ kind: "formato", statement: data.best_format }] : []),
        ...(data.best_offer ? [{ kind: "oferta", statement: data.best_offer }] : []),
        ...data.learnings.map((statement) => ({ kind: "aprendizado", statement })),
        { kind: "proximo_teste", statement: data.next_test },
      ];

      await admin.from("brand_learnings").insert(
        rows.map((row) => ({
          workspace_id: workspaceId,
          brand_id: brandId,
          campaign_id: campaignId,
          kind: row.kind,
          statement: row.statement,
          confidence,
          sample_size: sampleSize,
          evidence: { relatorios: sampleSize } as never,
          created_by: caller.userId,
        })),
      );
    }

    await recordUsage(admin, { workspaceId, userId: caller.userId, kind: "recomendacao", usage });

    return json({
      recommendation: data,
      sample_size: sampleSize,
      confidence,
      reason:
        sampleSize < MIN_SAMPLE
          ? "Amostra pequena: trate como sinal observado, não como conclusão."
          : null,
    });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
