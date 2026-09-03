import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertCampaignInWorkspace, enforceRateLimit } from "../_shared/auth.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { copiesResponseSchema, briefSchema } from "../_shared/schemas.ts";
import { copiesPrompt } from "../_shared/prompts.ts";
import { loadBrandMemory, loadConfirmedBrief } from "../_shared/memory.ts";
import { recordUsage } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  direction_id: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(3),
  replace: z.boolean().default(false),
});

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Informe o caminho criativo.");
    const { workspace_id: workspaceId, direction_id: directionId, count, replace } = parsed.data;

    await requireMembership(admin, caller.userId, workspaceId);
    await enforceRateLimit(admin, workspaceId, caller.userId);

    const { data: direction, error } = await admin
      .from("creative_directions")
      .select("*")
      .eq("id", directionId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw errors.internal();
    if (!direction) throw errors.forbidden("Caminho criativo não encontrado neste workspace.");

    const campaign = await assertCampaignInWorkspace(admin, direction.campaign_id, workspaceId);
    const briefRow = await loadConfirmedBrief(admin, direction.campaign_id);
    const brief = briefSchema.parse(briefRow.payload);
    const { context } = await loadBrandMemory(admin, campaign.brand_id, workspaceId);

    const { data, usage } = await chatStructured({
      schema: copiesResponseSchema,
      schemaName: "copies",
      model: MODELS.strategy,
      fallbackModel: MODELS.strategyFallback,
      temperature: 0.9,
      maxTokens: 3000,
      messages: [{ role: "user", content: copiesPrompt(context, brief, direction, count) }],
    });

    if (replace) {
      await admin.from("creative_copies").delete().eq("direction_id", directionId);
    }

    const { data: existing } = await admin
      .from("creative_copies")
      .select("variant_index")
      .eq("direction_id", directionId)
      .order("variant_index", { ascending: false })
      .limit(1);

    const start = replace ? 0 : ((existing?.[0]?.variant_index ?? -1) + 1);

    const { data: saved, error: insertError } = await admin
      .from("creative_copies")
      .insert(
        data.copies.map((copy, index) => ({
          workspace_id: workspaceId,
          campaign_id: direction.campaign_id,
          direction_id: directionId,
          variant_index: start + index,
          headline: copy.headline,
          subheadline: copy.subheadline,
          body: copy.body,
          cta: copy.cta,
        })),
      )
      .select("*");

    if (insertError) throw errors.internal("Não foi possível salvar as copies.");

    await recordUsage(admin, { workspaceId, userId: caller.userId, kind: "copies", usage });

    return json({ copies: saved ?? [] });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
