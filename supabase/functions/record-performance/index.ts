/**
 * Registro manual de resultados. Calcula as métricas derivadas no servidor,
 * para que o app nunca precise recalcular de formas diferentes.
 */
import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertCampaignInWorkspace } from "../_shared/auth.ts";
import { auditLog } from "../_shared/jobs.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  report_id: z.string().uuid().nullable().default(null),
  asset_id: z.string().uuid().nullable().default(null),
  winner_asset_id: z.string().uuid().nullable().default(null),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spend_cents: z.number().int().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  leads: z.number().int().min(0).default(0),
  purchases: z.number().int().min(0).default(0),
  revenue_cents: z.number().int().min(0).default(0),
  notes: z.string().trim().max(1200).default(""),
});

export function derivedMetrics(input: {
  spend_cents: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue_cents: number;
}) {
  const safe = (value: number, divisor: number) => (divisor > 0 ? value / divisor : null);
  return {
    ctr: safe(input.clicks * 100, input.impressions),
    cpc_cents: safe(input.spend_cents, input.clicks),
    cpm_cents: safe(input.spend_cents * 1000, input.impressions),
    cpa_cents: safe(input.spend_cents, input.purchases),
    cpl_cents: safe(input.spend_cents, input.leads),
    roas: safe(input.revenue_cents, input.spend_cents),
    conversion_rate: safe(input.purchases * 100, input.clicks),
  };
}

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw errors.invalid("Confira os números informados.", parsed.error.issues.slice(0, 6));
    }
    const body = parsed.data;

    if (body.period_end < body.period_start) {
      throw errors.invalid("O fim do período precisa ser depois do início.");
    }
    if (body.impressions > 0 && body.clicks > body.impressions) {
      throw errors.invalid("Os cliques não podem passar das impressões.");
    }

    await requireMembership(admin, caller.userId, body.workspace_id);
    await assertCampaignInWorkspace(admin, body.campaign_id, body.workspace_id);

    const payload = {
      workspace_id: body.workspace_id,
      campaign_id: body.campaign_id,
      asset_id: body.asset_id,
      winner_asset_id: body.winner_asset_id,
      period_start: body.period_start,
      period_end: body.period_end,
      spend_cents: body.spend_cents,
      impressions: body.impressions,
      clicks: body.clicks,
      leads: body.leads,
      purchases: body.purchases,
      revenue_cents: body.revenue_cents,
      notes: body.notes,
      created_by: caller.userId,
    };

    const query = body.report_id
      ? admin.from("performance_reports").update(payload).eq("id", body.report_id).eq("workspace_id", body.workspace_id)
      : admin.from("performance_reports").insert(payload);

    const { data, error } = await query.select("*").single();
    if (error) throw errors.internal("Não foi possível salvar o resultado.");

    await auditLog(admin, {
      workspaceId: body.workspace_id,
      actorId: caller.userId,
      action: body.report_id ? "resultado.atualizado" : "resultado.registrado",
      entityType: "performance_report",
      entityId: data.id,
      metadata: { campaign_id: body.campaign_id },
    });

    return json({ report: data, metrics: derivedMetrics(body) });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
