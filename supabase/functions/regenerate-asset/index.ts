import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, enforceRateLimit } from "../_shared/auth.ts";
import { generateImage, chatStructured } from "../_shared/openrouter.ts";
import { imagePrompt, copiesPrompt } from "../_shared/prompts.ts";
import { copiesResponseSchema, briefSchema } from "../_shared/schemas.ts";
import { loadBrandMemory, loadConfirmedBrief } from "../_shared/memory.ts";
import { openJob, completeJob, failJob, recordUsage, auditLog } from "../_shared/jobs.ts";
import { reserveCredits, confirmCredits, refundCredits } from "../_shared/credits.ts";
import { uploadImage } from "../_shared/storage.ts";
import { notifyQuotaThreshold } from "../_shared/notify.ts";
import { DEFAULT_IMAGE_QUALITY, estimatedImageCost, imageModelFor, MODELS, type ImageQuality } from "../_shared/config.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  /** "imagem" gasta crédito; "copy" não gasta imagem. */
  mode: z.enum(["imagem", "copy", "ambos"]),
  visual_prompt: z.string().trim().max(2000).optional(),
  quality: z.enum(["rascunho", "padrao", "alta"]).optional(),
});

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Informe o criativo e o que deve ser regenerado.");
    const { workspace_id: workspaceId, asset_id: assetId, mode } = parsed.data;
    const quality: ImageQuality = parsed.data.quality ?? DEFAULT_IMAGE_QUALITY;

    await requireMembership(admin, caller.userId, workspaceId);
    await enforceRateLimit(admin, workspaceId, caller.userId);

    const { data: asset, error } = await admin
      .from("creative_assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw errors.internal();
    if (!asset) throw errors.forbidden("Criativo não encontrado neste workspace.");

    const { data: direction } = await admin
      .from("creative_directions")
      .select("*")
      .eq("id", asset.direction_id ?? "")
      .maybeSingle();

    const { brand } = await loadBrandMemory(admin, asset.brand_id, workspaceId);
    const needsImage = mode === "imagem" || mode === "ambos";
    const needsCopy = mode === "copy" || mode === "ambos";

    const idempotencyKey =
      request.headers.get("x-idempotency-key")?.slice(0, 120) || `regen:${assetId}:${mode}:${Date.now()}`;

    const job = await openJob(admin, {
      workspaceId,
      userId: caller.userId,
      kind: "regeneracao",
      idempotencyKey,
      campaignId: asset.campaign_id,
      assetId,
      model: needsImage ? imageModelFor(quality).model : MODELS.strategy,
      estimatedCostUsd: needsImage ? estimatedImageCost(quality) : 0,
      creditsReserved: needsImage ? 1 : 0,
      input: { mode, quality },
    });

    if (job.reused) return json({ reused: true, asset: job.output });

    if (needsImage) await reserveCredits(admin, workspaceId, "imagem", 1, job.id);

    try {
      await admin.from("creative_assets").update({ status: "gerando" }).eq("id", assetId);

      const update: Record<string, unknown> = {};
      const composition = { ...(asset.composition as Record<string, unknown>) };

      if (needsImage) {
        const visualPrompt = parsed.data.visual_prompt?.trim() || asset.visual_prompt || direction?.visual_prompt || "";
        if (!visualPrompt) throw errors.invalid("Este criativo não tem prompt visual para regenerar.");

        const { image, usage } = await generateImage({
          prompt: imagePrompt(visualPrompt, brand, asset.format),
          quality,
        });

        const basePath = await uploadImage(admin, {
          bucket: "creative-assets",
          workspaceId,
          brandId: asset.brand_id,
          resourceType: "base",
          base64: image.base64,
          mimeType: image.mimeType,
        });

        // A versão anterior sai do caminho, mas o arquivo antigo não é apagado
        // até a exclusão definitiva do criativo.
        update.base_path = basePath;
        update.render_path = null;
        update.visual_prompt = visualPrompt;
        update.model = usage.model;
        update.cost_usd = Number(asset.cost_usd ?? 0) + usage.costUsd;

        await recordUsage(admin, { workspaceId, userId: caller.userId, jobId: job.id, kind: "regeneracao", usage, images: 1 });
      }

      if (needsCopy && direction && asset.campaign_id) {
        const briefRow = await loadConfirmedBrief(admin, asset.campaign_id);
        const brief = briefSchema.parse(briefRow.payload);
        const { context } = await loadBrandMemory(admin, asset.brand_id, workspaceId);

        const { data: copies, usage } = await chatStructured({
          schema: copiesResponseSchema,
          schemaName: "copies",
          model: MODELS.strategy,
          fallbackModel: MODELS.strategyFallback,
          temperature: 0.95,
          maxTokens: 1500,
          messages: [{ role: "user", content: copiesPrompt(context, brief, direction, 1) }],
        });

        const copy = copies.copies[0];
        composition.headline = copy.headline;
        composition.subheadline = copy.subheadline;
        composition.body = copy.body;
        composition.cta = copy.cta;
        update.composition = composition;
        update.render_path = null;

        await recordUsage(admin, { workspaceId, userId: caller.userId, jobId: job.id, kind: "regeneracao_copy", usage });
      }

      update.status = "revisao";

      const { data: updated, error: updateError } = await admin
        .from("creative_assets")
        .update(update)
        .eq("id", assetId)
        .select("*")
        .single();
      if (updateError) throw errors.internal("Não foi possível atualizar o criativo.");

      await completeJob(admin, job.id, updated);
      if (needsImage) {
        await confirmCredits(admin, workspaceId, "imagem", 1, job.id);
        await notifyQuotaThreshold(admin, workspaceId, caller.userId);
      }

      await auditLog(admin, {
        workspaceId,
        actorId: caller.userId,
        action: "criativo.regenerado",
        entityType: "creative_asset",
        entityId: assetId,
        metadata: { mode, qualidade: quality },
      });

      return json({ reused: false, asset: updated });
    } catch (regenError) {
      const message = regenError instanceof Error ? regenError.message : "Falha ao regenerar";
      await failJob(admin, job.id, message);
      await admin.from("creative_assets").update({ status: "revisao" }).eq("id", assetId);
      if (needsImage) await refundCredits(admin, workspaceId, "imagem", 1, job.id, "Falha ao regenerar imagem");
      throw regenError;
    }
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
