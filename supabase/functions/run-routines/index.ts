/**
 * Executado pelo Supabase Cron (e manualmente pelo app).
 * Idempotente: a chave única de routine_runs impede execução duplicada,
 * mesmo se o cron disparar duas vezes na mesma janela.
 */
import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership } from "../_shared/auth.ts";
import { runDirections, runImages, briefFromRoutine } from "../_shared/pipeline.ts";
import { notify } from "../_shared/notify.ts";
import { auditLog } from "../_shared/jobs.ts";
import { availableCredits } from "../_shared/credits.ts";
import { SUPABASE } from "../_shared/config.ts";

const bodySchema = z.object({
  /** Execução manual de uma rotina específica, disparada pelo app. */
  routine_id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

function isCronCall(request: Request): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();
  if (cronSecret && request.headers.get("x-cron-secret")?.trim() === cronSecret) return true;
  return Boolean(SUPABASE.serviceRoleKey && token === SUPABASE.serviceRoleKey);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const handler = serveJson(async (request) => {
    const admin = adminClient();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw errors.invalid("Parâmetros inválidos.");
    const { routine_id, workspace_id, limit } = parsed.data;

    const cron = isCronCall(request);
    let actorId: string | null = null;

    if (!cron) {
      // Execução manual: precisa de usuário autenticado e membro do workspace.
      const caller = await requireUser(request);
      actorId = caller.userId;
      if (!routine_id || !workspace_id) {
        throw errors.invalid("Execução manual exige a rotina e o workspace.");
      }
      await requireMembership(admin, caller.userId, workspace_id);
    }

    let query = admin
      .from("routines")
      .select("*")
      .is("deleted_at", null)
      .eq("status", "ativa")
      .limit(limit);

    if (routine_id) {
      query = query.eq("id", routine_id);
      if (workspace_id) query = query.eq("workspace_id", workspace_id);
    } else {
      query = query.lte("next_run_at", new Date().toISOString());
    }

    const { data: routines, error } = await query;
    if (error) throw errors.internal("Não foi possível listar as rotinas.");
    if (!routines?.length) return json({ processed: 0, runs: [] });

    const runs: Array<Record<string, unknown>> = [];

    for (const routine of routines) {
      const scheduledFor = routine.next_run_at ?? new Date().toISOString();
      const idempotencyKey = cron
        ? `cron:${scheduledFor}`
        : `manual:${new Date().toISOString().slice(0, 16)}`;

      // A restrição única (routine_id, idempotency_key) é a trava contra duplicidade.
      const { data: run, error: runError } = await admin
        .from("routine_runs")
        .insert({
          workspace_id: routine.workspace_id,
          routine_id: routine.id,
          scheduled_for: scheduledFor,
          status: "executando",
          trigger: cron ? "cron" : "manual",
          idempotency_key: idempotencyKey,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (runError || !run) {
        runs.push({ routine_id: routine.id, status: "pulada", reason: "já executada nesta janela" });
        continue;
      }

      try {
        const occasion =
          routine.frequency === "semanal" || routine.frequency === "quinzenal"
            ? `${WEEKDAYS[routine.weekday ?? 1]}, ${routine.run_at.slice(0, 5)}`
            : new Date(scheduledFor).toLocaleDateString("pt-BR");

        const { data: brand } = await admin
          .from("brands")
          .select("name")
          .eq("id", routine.brand_id)
          .maybeSingle();

        const { campaignId } = await briefFromRoutine(admin, routine, brand?.name ?? "", occasion);

        let generatedDirections = 0;
        let generatedAssets = 0;

        if (routine.auto_generate) {
          const directions = await runDirections(admin, {
            workspaceId: routine.workspace_id,
            campaignId,
            brandId: routine.brand_id,
            userId: routine.created_by,
            count: 4,
            routineRunId: run.id,
          });
          generatedDirections = (directions.directions as unknown[]).length;

          // Imagem só sai com autorização explícita na rotina E saldo suficiente.
          if (routine.allow_image_generation) {
            const ids = (directions.directions as Array<{ id: string }>)
              .slice(0, Math.min(routine.quantity, 5))
              .map((direction) => direction.id);
            const available = await availableCredits(admin, routine.workspace_id, "imagem");

            if (available >= ids.length && ids.length > 0) {
              const images = await runImages(admin, {
                workspaceId: routine.workspace_id,
                campaignId,
                brandId: routine.brand_id,
                userId: routine.created_by,
                directionIds: ids,
                formats: routine.formats ?? ["4:5"],
                templateKey: "produto-destaque",
                copyVariant: 0,
                idempotencyKey: `rotina:${run.id}:imagens`,
                routineRunId: run.id,
              });
              generatedAssets = images.assets.length;
            } else {
              await notify(admin, {
                workspaceId: routine.workspace_id,
                userId: routine.created_by,
                kind: "limite_atingido",
                title: `A rotina "${routine.name}" parou antes das imagens`,
                body: `Restam ${available} imagens no ciclo e a rotina precisava de ${ids.length}. Os caminhos criativos estão prontos.`,
                link: `/app/campanhas/${campaignId}`,
              });
            }
          }
        } else {
          // Sem geração automática: só o briefing em rascunho, com aviso.
          await notify(admin, {
            workspaceId: routine.workspace_id,
            userId: routine.created_by,
            kind: "rotina_executada",
            title: `A rotina "${routine.name}" preparou um briefing`,
            body: "Está em rascunho, esperando sua revisão para gerar.",
            link: `/app/campanhas/${campaignId}`,
          });
        }

        await admin
          .from("routine_runs")
          .update({
            status: "concluida",
            finished_at: new Date().toISOString(),
            campaign_id: campaignId,
            summary: { directions: generatedDirections, assets: generatedAssets } as never,
          })
          .eq("id", run.id);

        await admin
          .from("routines")
          .update({ last_run_at: new Date().toISOString(), status: "ativa" })
          .eq("id", routine.id);

        if (routine.auto_generate) {
          await notify(admin, {
            workspaceId: routine.workspace_id,
            userId: routine.created_by,
            kind: "rotina_executada",
            title: `A rotina "${routine.name}" rodou`,
            body: `${generatedDirections} caminhos e ${generatedAssets} criativos gerados.`,
            link: `/app/campanhas/${campaignId}`,
          });
        }

        await auditLog(admin, {
          workspaceId: routine.workspace_id,
          actorId,
          action: "rotina.executada",
          entityType: "routine",
          entityId: routine.id,
          metadata: { run_id: run.id, campaign_id: campaignId, trigger: cron ? "cron" : "manual" },
        });

        runs.push({
          routine_id: routine.id,
          run_id: run.id,
          campaign_id: campaignId,
          status: "concluida",
          directions: generatedDirections,
          assets: generatedAssets,
        });
      } catch (runFailure) {
        const message = runFailure instanceof Error ? runFailure.message : "Falha na execução";
        await admin
          .from("routine_runs")
          .update({ status: "falhou", finished_at: new Date().toISOString(), error: message.slice(0, 400) })
          .eq("id", run.id);
        await admin.from("routines").update({ status: "erro" }).eq("id", routine.id);

        await notify(admin, {
          workspaceId: routine.workspace_id,
          userId: routine.created_by,
          kind: "rotina_erro",
          title: `A rotina "${routine.name}" falhou`,
          body: message.slice(0, 160),
          link: "/app/rotinas",
        });

        runs.push({ routine_id: routine.id, run_id: run.id, status: "falhou" });
      }
    }

    return json({ processed: runs.length, runs });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
