import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Usage } from "./openrouter.ts";
import { errors } from "./http.ts";

export type JobKind =
  | "chat" | "briefing" | "direcoes" | "copies"
  | "imagem" | "regeneracao" | "recomendacao" | "analise_marca";

export type Job = { id: string; status: string; output: unknown; reused: boolean };

/**
 * Cria (ou recupera) um job pela chave de idempotência.
 * Repetir a mesma chave devolve o resultado anterior em vez de gastar de novo.
 */
export async function openJob(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    userId: string;
    kind: JobKind;
    idempotencyKey: string;
    campaignId?: string | null;
    assetId?: string | null;
    routineRunId?: string | null;
    model?: string;
    estimatedCostUsd?: number;
    creditsReserved?: number;
    input?: Record<string, unknown>;
  },
): Promise<Job> {
  const { data: existing } = await admin
    .from("ai_generation_jobs")
    .select("id, status, output")
    .eq("workspace_id", params.workspaceId)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (existing) {
    if (existing.status === "completed") {
      return { id: existing.id, status: existing.status, output: existing.output, reused: true };
    }
    if (existing.status === "processing") {
      throw errors.rateLimit();
    }
    await admin
      .from("ai_generation_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { id: existing.id, status: "processing", output: null, reused: false };
  }

  const { data, error } = await admin
    .from("ai_generation_jobs")
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      kind: params.kind,
      idempotency_key: params.idempotencyKey,
      campaign_id: params.campaignId ?? null,
      asset_id: params.assetId ?? null,
      routine_run_id: params.routineRunId ?? null,
      model: params.model ?? null,
      estimated_cost_usd: params.estimatedCostUsd ?? 0,
      credits_reserved: params.creditsReserved ?? 0,
      input: params.input ?? {},
      status: "processing",
      attempts: 1,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) throw errors.internal("Não foi possível abrir o job de geração.");
  return { id: data.id, status: "processing", output: null, reused: false };
}

export async function completeJob(
  admin: SupabaseClient,
  jobId: string,
  output: unknown,
  usage?: Usage,
) {
  await admin
    .from("ai_generation_jobs")
    .update({
      status: "completed",
      output: output as never,
      actual_cost_usd: usage?.costUsd ?? 0,
      model: usage?.model,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/** Mensagem de erro sempre sanitizada: sem stack, sem prompt, sem chave. */
export async function failJob(admin: SupabaseClient, jobId: string, message: string) {
  await admin
    .from("ai_generation_jobs")
    .update({ status: "failed", error: message.slice(0, 400), finished_at: new Date().toISOString() })
    .eq("id", jobId);
}

/** Registra consumo real. Só o servidor escreve nesta tabela. */
export async function recordUsage(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    userId?: string | null;
    jobId?: string | null;
    kind: string;
    usage: Usage;
    images?: number;
    status?: "ok" | "erro" | "rate_limit" | "timeout";
  },
) {
  const { error } = await admin.from("ai_usage_events").insert({
    workspace_id: params.workspaceId,
    user_id: params.userId ?? null,
    job_id: params.jobId ?? null,
    kind: params.kind,
    model: params.usage.model,
    tokens_in: params.usage.tokensIn,
    tokens_out: params.usage.tokensOut,
    images: params.images ?? 0,
    cost_usd: params.usage.costUsd,
    latency_ms: params.usage.latencyMs,
    status: params.status ?? "ok",
  });
  if (error) console.error("falha_registrar_consumo", error.message);
}

export async function auditLog(
  admin: SupabaseClient,
  params: {
    workspaceId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await admin.from("audit_logs").insert({
    workspace_id: params.workspaceId ?? null,
    actor_id: params.actorId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: (params.metadata ?? {}) as never,
  });
}
