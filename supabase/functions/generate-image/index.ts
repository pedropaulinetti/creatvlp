import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertCampaignInWorkspace, enforceRateLimit } from "../_shared/auth.ts";
import { runImages } from "../_shared/pipeline.ts";
import { availableCredits } from "../_shared/credits.ts";

const FORMATS = ["4:5", "1:1", "9:16"] as const;

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  /** Uma imagem-base por caminho. Os demais formatos saem por composição, sem nova geração. */
  direction_ids: z.array(z.string().uuid()).min(1).max(5),
  formats: z.array(z.enum(FORMATS)).min(1).max(3).default(["4:5"]),
  template_key: z.string().trim().min(1).default("produto-destaque"),
  copy_variant: z.number().int().min(0).max(4).default(0),
  quality: z.enum(["rascunho", "padrao", "alta"]).optional(),
});

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Escolha ao menos um caminho criativo para gerar.");
    const body = parsed.data;

    await requireMembership(admin, caller.userId, body.workspace_id);
    const campaign = await assertCampaignInWorkspace(admin, body.campaign_id, body.workspace_id);
    await enforceRateLimit(admin, body.workspace_id, caller.userId);

    const idempotencyKey =
      request.headers.get("x-idempotency-key")?.slice(0, 120) ||
      `imagem:${body.campaign_id}:${[...body.direction_ids].sort().join(",")}:${body.template_key}:${body.copy_variant}:${body.quality ?? "padrao"}`;

    const result = await runImages(admin, {
      workspaceId: body.workspace_id,
      campaignId: body.campaign_id,
      brandId: campaign.brand_id,
      userId: caller.userId,
      directionIds: body.direction_ids,
      formats: body.formats,
      templateKey: body.template_key,
      copyVariant: body.copy_variant,
      quality: body.quality,
      idempotencyKey,
    });

    return json({
      ...result,
      credits_left: await availableCredits(admin, body.workspace_id, "imagem").catch(() => null),
    });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
