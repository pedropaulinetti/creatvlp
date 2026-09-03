import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertCampaignInWorkspace, enforceRateLimit } from "../_shared/auth.ts";
import { runDirections } from "../_shared/pipeline.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  /*
   * Ausente, o número de caminhos sai do briefing. É o pedido do usuário que
   * manda — antes vinha fixo do app e a quantidade não desencadeava nada.
   */
  count: z.number().int().min(3).max(5).optional(),
});

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Informe o workspace e a campanha.");
    const { workspace_id: workspaceId, campaign_id: campaignId, count } = parsed.data;

    await requireMembership(admin, caller.userId, workspaceId);
    const campaign = await assertCampaignInWorkspace(admin, campaignId, workspaceId);
    await enforceRateLimit(admin, workspaceId, caller.userId);

    /*
     * A chave mandada pelo app distingue as duas intenções que chegam por aqui:
     * repetir a mesma tentativa (sem chave, o job anterior é reaproveitado) e
     * pedir caminhos novos (chave própria, geração do zero). Mesmo acordo de
     * `generate-image` e `regenerate-asset`.
     */
    const idempotencyKey = request.headers.get("x-idempotency-key")?.slice(0, 120) ?? null;

    const result = await runDirections(admin, {
      workspaceId,
      campaignId,
      brandId: campaign.brand_id,
      userId: caller.userId,
      count,
      idempotencyKey,
    });

    return json(result);
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
