/** Retentar ou cancelar jobs travados. Restrito à administração da plataforma. */
import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requirePlatformAdmin } from "../_shared/auth.ts";
import { auditLog } from "../_shared/jobs.ts";
import { refundCredits } from "../_shared/credits.ts";

const bodySchema = z.object({
  job_id: z.string().uuid(),
  action: z.enum(["retry", "cancel"]),
});

/** Jobs em "processing" há mais que isso são considerados travados. */
const STUCK_MINUTES = 10;

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();
    await requirePlatformAdmin(admin, caller.userId);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Informe o job e a ação.");
    const { job_id: jobId, action } = parsed.data;

    const { data: job, error } = await admin
      .from("ai_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw errors.internal();
    if (!job) throw errors.invalid("Job não encontrado.");

    const stuckSince = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
    const isStuck = job.status === "processing" && (job.started_at ?? job.created_at) < stuckSince;

    if (action === "cancel") {
      await admin
        .from("ai_generation_jobs")
        .update({ status: "cancelled", finished_at: new Date().toISOString(), error: "Cancelado pela administração." })
        .eq("id", jobId);

      if (job.credits_reserved > 0 && job.status !== "completed") {
        await refundCredits(
          admin,
          job.workspace_id,
          job.kind === "campanha" ? "campanha" : "imagem",
          job.credits_reserved,
          jobId,
          "Cancelado pela administração",
        );
      }
    } else {
      if (job.status === "completed") throw errors.invalid("Este job já foi concluído.");
      if (job.status === "processing" && !isStuck) {
        throw errors.invalid(`Este job ainda está rodando. Aguarde ${STUCK_MINUTES} minutos antes de retentar.`);
      }
      if (job.attempts >= job.max_attempts) {
        throw errors.invalid("Este job já atingiu o número máximo de tentativas.");
      }

      // Reabre para nova tentativa: o app dispara a geração de novo com a mesma chave.
      await admin
        .from("ai_generation_jobs")
        .update({
          status: "queued",
          attempts: job.attempts + 1,
          error: null,
          started_at: null,
          finished_at: null,
        })
        .eq("id", jobId);
    }

    await auditLog(admin, {
      workspaceId: job.workspace_id,
      actorId: caller.userId,
      action: action === "retry" ? "admin.job_retentado" : "admin.job_cancelado",
      entityType: "ai_generation_job",
      entityId: jobId,
      metadata: { kind: job.kind, previous_status: job.status },
    });

    return json({ ok: true, job_id: jobId, action });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
