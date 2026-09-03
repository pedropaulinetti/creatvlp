/**
 * Núcleo de geração, compartilhado entre a chamada manual (Edge Function
 * chamada pelo app) e a execução automática das rotinas. A lógica vive aqui
 * uma única vez.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errors } from "./http.ts";
import { chatStructured, generateImage } from "./openrouter.ts";
import { directionsResponseSchema, briefSchema, type Brief } from "./schemas.ts";
import { directionsPrompt, imagePrompt } from "./prompts.ts";
import { loadBrandMemory, loadConfirmedBrief } from "./memory.ts";
import { openJob, completeJob, failJob, recordUsage, auditLog } from "./jobs.ts";
import { reserveCredits, confirmCredits, refundCredits } from "./credits.ts";
import { uploadImage } from "./storage.ts";
import { buildComposition } from "./composition.ts";
import { notify, notifyQuotaThreshold } from "./notify.ts";
import { DEFAULT_IMAGE_QUALITY, estimatedImageCost, imageModelFor, MODELS, type ImageQuality } from "./config.ts";

export type Actor = { userId: string | null };

// --------------------------------------------------------------- direções
export async function runDirections(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    campaignId: string;
    brandId: string;
    userId: string | null;
    count: number;
    routineRunId?: string | null;
  },
) {
  const briefRow = await loadConfirmedBrief(admin, params.campaignId);
  const brief = briefSchema.parse(briefRow.payload);
  const { context } = await loadBrandMemory(admin, params.brandId, params.workspaceId);

  const job = await openJob(admin, {
    workspaceId: params.workspaceId,
    userId: params.userId ?? "",
    kind: "direcoes",
    idempotencyKey: `direcoes:${params.campaignId}:v${briefRow.version}`,
    campaignId: params.campaignId,
    routineRunId: params.routineRunId ?? null,
    model: MODELS.strategy,
    input: { count: params.count },
  });

  if (job.reused) return { reused: true, directions: job.output as unknown[], brief };

  // A campanha consome crédito uma única vez, na primeira geração de caminhos.
  const { count: previous } = await admin
    .from("ai_generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.campaignId)
    .eq("kind", "direcoes")
    .eq("status", "completed");

  const chargesCampaign = (previous ?? 0) === 0;
  if (chargesCampaign) await reserveCredits(admin, params.workspaceId, "campanha", 1, job.id);

  try {
    await admin.from("campaigns").update({ status: "gerando" }).eq("id", params.campaignId);

    const { data, usage } = await chatStructured({
      schema: directionsResponseSchema,
      schemaName: "directions",
      model: MODELS.strategy,
      fallbackModel: MODELS.strategyFallback,
      temperature: 0.85,
      maxTokens: 8000,
      messages: [{ role: "user", content: directionsPrompt(context, brief, params.count) }],
    });

    await admin
      .from("creative_directions")
      .delete()
      .eq("campaign_id", params.campaignId)
      .eq("status", "proposta");

    const saved: unknown[] = [];

    for (const [index, direction] of data.directions.entries()) {
      const { data: row, error } = await admin
        .from("creative_directions")
        .insert({
          workspace_id: params.workspaceId,
          campaign_id: params.campaignId,
          position: index,
          name: direction.name,
          hypothesis: direction.hypothesis,
          problem: direction.problem,
          promise: direction.promise,
          hook: direction.hook,
          mechanism: direction.mechanism,
          proof: direction.proof,
          objection: direction.objection,
          cta: direction.cta,
          visual_prompt: direction.visual_prompt,
          rationale: direction.rationale,
        })
        .select("*")
        .single();

      if (error || !row) throw errors.internal("Não foi possível salvar os caminhos criativos.");

      const { data: savedCopies } = await admin
        .from("creative_copies")
        .insert(
          direction.copies.map((copy, variantIndex) => ({
            workspace_id: params.workspaceId,
            campaign_id: params.campaignId,
            direction_id: row.id,
            variant_index: variantIndex,
            headline: copy.headline,
            subheadline: copy.subheadline,
            body: copy.body,
            // Sem CTA próprio, a copy herda o do caminho.
            cta: copy.cta || direction.cta,
          })),
        )
        .select("*");

      saved.push({ ...row, copies: savedCopies ?? [] });
    }

    await admin.from("campaigns").update({ status: "revisao" }).eq("id", params.campaignId);
    await completeJob(admin, job.id, saved, usage);
    await recordUsage(admin, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      jobId: job.id,
      kind: "direcoes",
      usage,
    });
    if (chargesCampaign) await confirmCredits(admin, params.workspaceId, "campanha", 1, job.id);

    await notify(admin, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      kind: "campanha_pronta",
      title: "Caminhos criativos prontos",
      body: `${saved.length} caminhos para "${brief.campaign_name}" esperando sua escolha.`,
      link: `/app/campanhas/${params.campaignId}`,
    });

    await auditLog(admin, {
      workspaceId: params.workspaceId,
      actorId: params.userId,
      action: "campanha.direcoes_geradas",
      entityType: "campaign",
      entityId: params.campaignId,
      metadata: { count: saved.length },
    });

    return { reused: false, directions: saved, brief };
  } catch (error) {
    await failJob(admin, job.id, error instanceof Error ? error.message : "Falha na geração");
    await admin.from("campaigns").update({ status: "briefing_confirmado" }).eq("id", params.campaignId);
    if (chargesCampaign) {
      await refundCredits(admin, params.workspaceId, "campanha", 1, job.id, "Falha ao gerar caminhos");
    }
    throw error;
  }
}

// ---------------------------------------------------------------- imagens
export async function runImages(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    campaignId: string;
    brandId: string;
    userId: string | null;
    directionIds: string[];
    formats: string[];
    templateKey: string;
    copyVariant: number;
    idempotencyKey: string;
    quality?: ImageQuality;
    routineRunId?: string | null;
  },
) {
  const quality: ImageQuality = params.quality ?? DEFAULT_IMAGE_QUALITY;
  const tier = imageModelFor(quality);
  const { data: directions, error } = await admin
    .from("creative_directions")
    .select("*")
    .eq("campaign_id", params.campaignId)
    .eq("workspace_id", params.workspaceId)
    .in("id", params.directionIds);

  if (error) throw errors.internal();
  if (!directions?.length) throw errors.invalid("Nenhum caminho criativo válido foi encontrado.");

  const job = await openJob(admin, {
    workspaceId: params.workspaceId,
    userId: params.userId ?? "",
    kind: "imagem",
    idempotencyKey: params.idempotencyKey,
    campaignId: params.campaignId,
    routineRunId: params.routineRunId ?? null,
    model: tier.model,
    estimatedCostUsd: estimatedImageCost(quality) * directions.length,
    creditsReserved: directions.length,
    input: { direction_ids: params.directionIds, formats: params.formats, template_key: params.templateKey, quality },
  });

  if (job.reused) return { reused: true, assets: (job.output as unknown[]) ?? [], failed: 0 };

  await reserveCredits(admin, params.workspaceId, "imagem", directions.length, job.id);

  const { brand } = await loadBrandMemory(admin, params.brandId, params.workspaceId);
  const primaryFormat = params.formats[0] ?? "4:5";

  const results = await Promise.allSettled(
    directions.map(async (direction) => {
      const { data: copy } = await admin
        .from("creative_copies")
        .select("*")
        .eq("direction_id", direction.id)
        .eq("variant_index", params.copyVariant)
        .maybeSingle();

      const { image, usage } = await generateImage({
        prompt: imagePrompt(direction.visual_prompt, brand, primaryFormat),
        quality,
      });

      const basePath = await uploadImage(admin, {
        bucket: "creative-assets",
        workspaceId: params.workspaceId,
        brandId: params.brandId,
        resourceType: "base",
        base64: image.base64,
        mimeType: image.mimeType,
      });

      const composition = await buildComposition(admin, {
        templateKey: params.templateKey,
        format: primaryFormat,
        headline: copy?.headline ?? direction.hook,
        subheadline: copy?.subheadline ?? direction.promise,
        body: copy?.body ?? "",
        cta: copy?.cta ?? direction.cta,
        brandColors: brand.colors,
      });

      const { data: asset, error: assetError } = await admin
        .from("creative_assets")
        .insert({
          workspace_id: params.workspaceId,
          brand_id: params.brandId,
          campaign_id: params.campaignId,
          direction_id: direction.id,
          copy_id: copy?.id ?? null,
          template_key: params.templateKey,
          status: "revisao",
          format: primaryFormat,
          base_path: basePath,
          composition: composition as never,
          visual_prompt: direction.visual_prompt,
          model: usage.model,
          cost_usd: usage.costUsd,
          created_by: params.userId,
        })
        .select("*")
        .single();

      if (assetError || !asset) throw errors.internal("Não foi possível salvar o criativo.");

      // Adaptação de formato é só composição — nunca gera imagem de novo.
      const extraFormats = params.formats.filter((format) => format !== primaryFormat);
      if (extraFormats.length) {
        const variants = await Promise.all(
          extraFormats.map(async (format) => ({
            workspace_id: params.workspaceId,
            asset_id: asset.id,
            format,
            composition: (await buildComposition(admin, {
              templateKey: params.templateKey,
              format,
              headline: composition.headline,
              subheadline: composition.subheadline,
              body: composition.body,
              cta: composition.cta,
              brandColors: brand.colors,
            })) as never,
          })),
        );
        await admin.from("creative_variants").insert(variants);
      }

      await recordUsage(admin, {
        workspaceId: params.workspaceId,
        userId: params.userId,
        jobId: job.id,
        kind: "imagem",
        usage,
        images: 1,
      });

      return asset;
    }),
  );

  const assets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failed = results.length - assets.length;

  if (assets.length) await confirmCredits(admin, params.workspaceId, "imagem", assets.length, job.id);
  if (failed > 0) {
    await refundCredits(admin, params.workspaceId, "imagem", failed, job.id, "Geração de imagem falhou");
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      console.error("falha_geracao_imagem", String((rejected.reason as Error)?.message).slice(0, 200));
    }
  }

  if (!assets.length) {
    await failJob(admin, job.id, "Nenhuma imagem pôde ser gerada.");
    await notify(admin, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      kind: "geracao_falhou",
      title: "A geração de imagens falhou",
      body: "Seus créditos foram devolvidos. Tente novamente em alguns instantes.",
      link: `/app/campanhas/${params.campaignId}`,
    });
    throw errors.upstream("Nenhuma imagem pôde ser gerada. Seus créditos foram devolvidos.");
  }

  await completeJob(admin, job.id, assets);
  await admin.from("campaigns").update({ status: "revisao" }).eq("id", params.campaignId);

  await notify(admin, {
    workspaceId: params.workspaceId,
    userId: params.userId,
    kind: "criativos_aguardando",
    title: `${assets.length} criativo(s) aguardando aprovação`,
    body: failed ? `${failed} não puderam ser gerados e o crédito foi devolvido.` : "",
    link: `/app/campanhas/${params.campaignId}`,
  });

  await notifyQuotaThreshold(admin, params.workspaceId, params.userId);
  await auditLog(admin, {
    workspaceId: params.workspaceId,
    actorId: params.userId,
    action: "criativo.gerado",
    entityType: "campaign",
    entityId: params.campaignId,
    metadata: { gerados: assets.length, falhas: failed, qualidade: quality },
  });

  return { reused: false, assets, failed };
}

/** Cria campanha + briefing a partir da configuração de uma rotina. */
export async function briefFromRoutine(
  admin: SupabaseClient,
  routine: Record<string, any>,
  brandName: string,
  occasionLabel: string,
): Promise<{ campaignId: string; brief: Brief }> {
  const { data: product } = routine.product_id
    ? await admin.from("products").select("name").eq("id", routine.product_id).maybeSingle()
    : { data: null };

  const brief: Brief = briefSchema.parse({
    campaign_name: `${routine.name} · ${occasionLabel}`,
    objective: routine.objective || "Vendas",
    product: product?.name ?? "Linha principal",
    audience: "Público principal da marca",
    offer: routine.recurring_offer ?? "",
    channel: routine.channel,
    formats: routine.formats?.length ? routine.formats : ["4:5"],
    quantity: routine.quantity,
    voice_tone: "",
    restrictions: [],
    occasion: occasionLabel,
    occasion_date: "",
    cta: "Comprar agora",
    primary_metric: "ROAS",
  });

  const { data: campaign, error } = await admin
    .from("campaigns")
    .insert({
      workspace_id: routine.workspace_id,
      brand_id: routine.brand_id,
      name: brief.campaign_name,
      objective: brief.objective,
      status: routine.auto_generate ? "briefing_confirmado" : "rascunho",
      channel: routine.channel,
      origin: "rotina",
      routine_id: routine.id,
      created_by: routine.created_by,
    })
    .select("id")
    .single();

  if (error || !campaign) throw errors.internal("Não foi possível criar a campanha da rotina.");

  await admin.from("campaign_briefs").insert({
    workspace_id: routine.workspace_id,
    campaign_id: campaign.id,
    version: 1,
    payload: brief as never,
    // Rotina com geração automática já entra confirmada; sem ela, fica em rascunho.
    confirmed_at: routine.auto_generate ? new Date().toISOString() : null,
    created_by: routine.created_by,
  });

  void brandName;
  return { campaignId: campaign.id, brief };
}
