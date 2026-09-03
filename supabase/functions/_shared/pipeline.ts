/**
 * Núcleo de geração, compartilhado entre a chamada manual (Edge Function
 * chamada pelo app) e a execução automática das rotinas. A lógica vive aqui
 * uma única vez.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errors } from "./http.ts";
import { chatStructured, generateImage } from "./openrouter.ts";
import { directionsResponseSchema, copiesResponseSchema, briefSchema, type Brief } from "./schemas.ts";
import { directionsPrompt, copiesPrompt, imagePrompt } from "./prompts.ts";
import { loadBrandMemory, loadConfirmedBrief } from "./memory.ts";
import { openJob, completeJob, failJob, recordUsage, auditLog, chaveDosCaminhos } from "./jobs.ts";
import { reserveCredits, confirmCredits, refundCredits } from "./credits.ts";
import { uploadImage } from "./storage.ts";
import { composicaoDaPeca } from "./composition.ts";
import { carregarReferencias, segmentoDaMarca } from "./referencias.ts";
import { planejarPecas, textoDaPeca, geracoesNecessarias } from "./pecas.ts";
import { notify, notifyQuotaThreshold } from "./notify.ts";
import { DEFAULT_IMAGE_QUALITY, estimatedImageCost, imageModelFor, MODELS, type ImageQuality } from "./config.ts";

export type Actor = { userId: string | null };

/*
 * Teto de peças por chamada.
 *
 * Cada peça é uma geração de imagem inteira, e a Edge Function morre aos 150
 * segundos. Trinta gerações numa chamada só não cabem: quem pede mais recebe
 * em lotes, e é o app que fatia.
 */
export const MAX_PECAS_POR_CHAMADA = 10;

// --------------------------------------------------------------- direções
export async function runDirections(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    campaignId: string;
    brandId: string;
    userId: string | null;
    /** Ausente, sai do briefing: é onde a quantidade pedida finalmente pesa. */
    count?: number;
    /**
     * Ausente, a chave é a da versão do briefing e uma repetição devolve o
     * resultado anterior. Presente, é um pedido novo: "Novos caminhos".
     */
    idempotencyKey?: string | null;
    routineRunId?: string | null;
  },
) {
  const briefRow = await loadConfirmedBrief(admin, params.campaignId);
  const brief = briefSchema.parse(briefRow.payload);
  const { context } = await loadBrandMemory(admin, params.brandId, params.workspaceId);

  /*
   * Caminho criativo é hipótese, não peça: três é o mínimo para haver
   * comparação e cinco é o teto em que ainda se escolhe sem cansar. Dentro
   * disso, quem pede mais peças ganha mais hipóteses para distribuí-las.
   */
  const count = Math.min(5, Math.max(3, params.count ?? brief.quantity));

  const job = await openJob(admin, {
    workspaceId: params.workspaceId,
    userId: params.userId ?? "",
    kind: "direcoes",
    idempotencyKey: chaveDosCaminhos(params.campaignId, briefRow.version, params.idempotencyKey),
    campaignId: params.campaignId,
    routineRunId: params.routineRunId ?? null,
    model: MODELS.strategy,
    input: { count },
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
      messages: [{ role: "user", content: directionsPrompt(context, brief, count) }],
    });

    await admin
      .from("creative_directions")
      .delete()
      .eq("campaign_id", params.campaignId)
      .eq("status", "proposta");

    /*
     * Os caminhos primeiro, as copies depois — uma chamada por caminho, todas
     * em paralelo.
     *
     * Pedir tudo de uma vez levava 121 segundos e estourava o tempo da função:
     * a campanha morria no meio, o job ficava órfão e a tela travava. Assim o
     * relógio passa a ser o da chamada mais lenta, não o da soma, e cada
     * chamada é pequena o bastante para caber com folga.
     */
    const saved = await Promise.all(
      data.directions.map(async (direction, index) => {
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

        // As três formas — título, enquete e conversa — deste caminho.
        const { data: escritas } = await chatStructured({
          schema: copiesResponseSchema,
          schemaName: "copies",
          model: MODELS.strategy,
          fallbackModel: MODELS.strategyFallback,
          temperature: 0.9,
          maxTokens: 3000,
          messages: [{ role: "user", content: copiesPrompt(context, brief, direction, 3) }],
        });

        const { data: savedCopies } = await admin
          .from("creative_copies")
          .insert(
            escritas.copies.map((copy, variantIndex) => ({
              workspace_id: params.workspaceId,
              campaign_id: params.campaignId,
              direction_id: row.id,
              variant_index: variantIndex,
              headline: copy.headline,
              subheadline: copy.subheadline,
              body: copy.body,
              // Sem CTA próprio, a copy herda o do caminho.
              cta: copy.cta || direction.cta,
              bullets: copy.bullets ?? [],
              formato: copy.formato ?? "titulo",
              pergunta: copy.pergunta ?? "",
              opcoes: copy.opcoes ?? [],
              mensagens: copy.mensagens ?? [],
            })),
          )
          .select("*");

        return { ...row, copies: savedCopies ?? [] };
      }),
    );


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
    /** Quantas peças. Cada formato escolhido é um desenho próprio de cada uma. */
    quantidade: number;
    /** Layouts escolhidos à mão. Vazio: o sistema varia pelo acervo. */
    referenceKeys?: string[];
    idempotencyKey: string;
    quality?: ImageQuality;
    routineRunId?: string | null;
  },
) {
  const quality: ImageQuality = params.quality ?? DEFAULT_IMAGE_QUALITY;
  const tier = imageModelFor(quality);

  // O que pesa é a geração, não a ideia: seis peças em dois formatos são doze.
  if (geracoesNecessarias(params.quantidade, params.formats) > MAX_PECAS_POR_CHAMADA) {
    throw errors.invalid(
      `Cada chamada desenha no máximo ${MAX_PECAS_POR_CHAMADA} imagens, e cada formato de cada peça é uma. Peça em lotes.`,
    );
  }

  const { data: directions, error } = await admin
    .from("creative_directions")
    .select("*")
    .eq("campaign_id", params.campaignId)
    .eq("workspace_id", params.workspaceId)
    .in("id", params.directionIds);

  if (error) throw errors.internal();
  if (!directions?.length) throw errors.invalid("Nenhum caminho criativo válido foi encontrado.");

  /*
   * As copies de todos os caminhos numa consulta só. Antes eram uma por
   * caminho, dentro do laço de geração — e a peça esperava o banco antes de
   * esperar o modelo.
   */
  const { data: todasAsCopies } = await admin
    .from("creative_copies")
    .select("*")
    .in("direction_id", params.directionIds)
    .order("variant_index", { ascending: true });

  const copiesPorCaminho = new Map<string, { id: string; [campo: string]: any }[]>();
  for (const copy of todasAsCopies ?? []) {
    const doCaminho = copiesPorCaminho.get(copy.direction_id) ?? [];
    doCaminho.push(copy);
    copiesPorCaminho.set(copy.direction_id, doCaminho);
  }

  const { brand, products } = await loadBrandMemory(admin, params.brandId, params.workspaceId);

  /*
   * O nome do produto, como o usuário escreveu na conversa. Campanha de rotina
   * sem briefing confirmado simplesmente não tem — e aí a escolha continua
   * saindo do texto da peça.
   */
  const produtoDoBriefing = await loadConfirmedBrief(admin, params.campaignId)
    .then((linha) => briefSchema.parse(linha.payload).product)
    .catch(() => "");

  // O acervo de layouts do segmento da marca. Vazio antes do seed: a peça sai
  // mesmo assim, com uma das formas escritas à mão no prompt.
  const acervo = await carregarReferencias(
    admin,
    segmentoDaMarca(brand.segment),
    params.referenceKeys ?? [],
  );

  const plano = planejarPecas({
    quantidade: params.quantidade,
    caminhos: directions.map((direction) => ({
      id: direction.id,
      copies: copiesPorCaminho.get(direction.id) ?? [],
    })),
    formatos: params.formats,
    referencias: acervo,
  });

  if (!plano.length) throw errors.invalid("Nenhuma peça a gerar. Escolha ao menos um caminho.");

  // Um identificador por ideia; todos os formatos dela carregam o mesmo.
  const grupos = new Map<number, string>();
  for (const peca of plano) {
    if (!grupos.has(peca.ideia)) grupos.set(peca.ideia, crypto.randomUUID());
  }

  const job = await openJob(admin, {
    workspaceId: params.workspaceId,
    userId: params.userId ?? "",
    kind: "imagem",
    idempotencyKey: params.idempotencyKey,
    campaignId: params.campaignId,
    routineRunId: params.routineRunId ?? null,
    model: tier.model,
    estimatedCostUsd: estimatedImageCost(quality) * plano.length,
    creditsReserved: plano.length,
    input: {
      direction_ids: params.directionIds,
      formats: params.formats,
      quantidade: params.quantidade,
      geracoes: plano.length,
      reference_keys: params.referenceKeys ?? [],
      quality,
    },
  });

  if (job.reused) return { reused: true, assets: (job.output as unknown[]) ?? [], failed: 0 };

  // Uma peça é uma geração inteira: o crédito é por peça, não por caminho.
  await reserveCredits(admin, params.workspaceId, "imagem", plano.length, job.id);

  const porId = new Map(directions.map((direction) => [direction.id, direction]));
  const copyPorId = new Map((todasAsCopies ?? []).map((copy) => [copy.id, copy]));
  const destaques = (products.find((produto) => produto.highlights?.length)?.highlights ?? []).slice(0, 3);

  // O que a marca já tem de imagem entra como contexto de luz e clima.
  const doEstilo = await referenciasDeEstilo(admin, params.brandId, params.workspaceId);

  const results = await Promise.allSettled(
    plano.map(async (peca) => {
      const direction = porId.get(peca.directionId)!;
      const copy = peca.copyId ? copyPorId.get(peca.copyId) ?? null : null;
      const texto = textoDaPeca(copy, direction, destaques);

      /*
       * O texto não é mais desenhado pelo modelo.
       *
       * A peça inteira gerada pela IA saía com o logo e o rótulo em rabisco, e
       * sem conserto possível: errou o acento, gera tudo de novo. Agora o
       * modelo entrega só a fotografia, e headline, subheadline, CTA e logo
       * entram por cima, vetoriais, no layout fixo de `DEFAULT_LAYOUT` —
       * logo no topo à esquerda, texto no rodapé, CTA em pílula.
       */
      const composition = composicaoDaPeca({
        templateKey: "coluna",
        format: peca.formato,
        headline: texto.headline,
        subheadline: texto.subheadline,
        body: copy?.body ?? "",
        cta: texto.cta,
        bullets: texto.bullets,
        pergunta: copy?.pergunta ?? "",
        opcoes: (copy?.opcoes as { texto: string; votos: number }[] | null) ?? [],
        mensagens: (copy?.mensagens as { de: string; texto: string }[] | null) ?? [],
        brandColors: brand.colors,
        brandTypography: brand.typography,
      });

      /*
       * A ordem das referências é a ordem da importância: a foto do produto
       * primeiro, porque é o objeto que precisa ser reproduzido com fidelidade;
       * o estilo da marca depois, que é luz e clima. O teto de quatro é do
       * próprio provedor, e a disputa é real: cada imagem a mais dilui a
       * anterior.
       *
       * A referência de layout saiu daqui. Ela existia para o modelo desenhar a
       * arquitetura do anúncio — e agora quem desenha a arquitetura é o canvas.
       * Mandar um anúncio pronto junto de "não escreva nada" só convidava o
       * modelo a redesenhar texto. As vagas que ela ocupava vão para o produto
       * e para o estilo, que é o que a fotografia precisa.
       */
      const doProduto = await fotoDoProduto(admin, products, direction, texto.headline, produtoDoBriefing);
      const doEstiloCabem = doEstilo.slice(0, 4 - (doProduto ? 1 : 0));

      const references = [doProduto, ...doEstiloCabem].filter(
        (url): url is string => Boolean(url),
      );

      const anexos = {
        produto: Boolean(doProduto),
        estilo: doEstiloCabem.length,
      };

      const { image, usage } = await generateImage({
        // A hipótese do caminho criativo é o que separa uma fotografia da outra.
        prompt: imagePrompt(direction.visual_prompt ?? "", brand, peca.formato, {
          produto: anexos.produto,
          estilo: anexos.estilo,
        }),
        references,
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

      const { data: asset, error: assetError } = await admin
        .from("creative_assets")
        .insert({
          workspace_id: params.workspaceId,
          brand_id: params.brandId,
          campaign_id: params.campaignId,
          direction_id: direction.id,
          copy_id: copy?.id ?? null,
          grupo_id: grupos.get(peca.ideia),
          // A referência que deu a estrutura fica registrada: é o que permite
          // descobrir depois qual layout converte.
          // O layout é o do arquétipo que sobrepõe o texto, não o da referência.
          template_key: "coluna",
          status: "revisao",
          format: peca.formato,
          /*
           * A imagem é a fotografia de fundo; o texto vem por cima no canvas.
           * `generated_path` fica nulo de propósito — é ele que o card usa para
           * decidir entre mostrar o arquivo pronto e compor a peça.
           */
          base_path: basePath,
          generated_path: null,
          composition: composition as never,
          visual_prompt: direction.visual_prompt,
          model: usage.model,
          cost_usd: usage.costUsd,
          created_by: params.userId,
        })
        .select("*")
        .single();

      if (assetError || !asset) throw errors.internal("Não foi possível salvar o criativo.");

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
    await refundCredits(admin, params.workspaceId, "imagem", failed, job.id, "Geração de peça falhou");
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      console.error("falha_geracao_peca", String((rejected.reason as Error)?.message).slice(0, 200));
    }
  }

  if (!assets.length) {
    await failJob(admin, job.id, "Nenhuma peça pôde ser gerada.");
    await notify(admin, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      kind: "geracao_falhou",
      title: "A geração de peças falhou",
      body: "Seus créditos foram devolvidos. Tente novamente em alguns instantes.",
      link: `/app/campanhas/${params.campaignId}`,
    });
    throw errors.upstream("Nenhuma peça pôde ser gerada. Seus créditos foram devolvidos.");
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

/** Quanto tempo uma URL assinada precisa viver: o suficiente para o provedor buscar. */
const MINUTOS_DE_ACESSO = 15 * 60;

/**
 * Referências visuais da marca, para o modelo saber como ela se fotografa.
 *
 * Só imagens de referência entram — o logo não, porque a imagem-base é proibida
 * de conter marca: logo e texto são compostos depois, de forma determinística.
 */
async function referenciasDeEstilo(
  admin: SupabaseClient,
  brandId: string,
  workspaceId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("brand_assets")
    .select("storage_path")
    .eq("brand_id", brandId)
    .eq("workspace_id", workspaceId)
    .eq("kind", "referencia")
    .is("deleted_at", null)
    .limit(3);

  const caminhos = (data ?? []).map((item) => item.storage_path).filter(Boolean);
  if (!caminhos.length) return [];

  const { data: assinadas } = await admin.storage
    .from("brand-assets")
    .createSignedUrls(caminhos, MINUTOS_DE_ACESSO);

  return (assinadas ?? [])
    .map((item) => item.signedUrl)
    .filter((url): url is string => Boolean(url));
}

/**
 * A foto do produto de que esta direção fala.
 *
 * A campanha não aponta para um produto, então a ligação é feita pelo nome: se
 * o hook ou o prompt visual cita um produto do catálogo, é dele que se trata.
 * Sem citação, vale o primeiro que tenha foto — melhor a peça mostrar algum
 * produto real da marca do que um objeto inventado.
 */
async function fotoDoProduto(
  admin: SupabaseClient,
  products: { name: string; image_path?: string | null }[],
  direction: { hook?: string | null; visual_prompt?: string | null },
  headline: string,
  /*
   * O produto que o briefing nomeia.
   *
   * É a resposta mais direta que existe para "de qual produto é esta campanha"
   * — o usuário digitou. Ficava sem uso: a escolha saía do hook e do prompt
   * visual, e quando nenhum citava o nome caía no primeiro produto com foto.
   * Numa marca com shampoo, condicionador e kit, isso é dois terços de chance
   * de anunciar o produto errado.
   */
  produtoDoBriefing = "",
): Promise<string | null> {
  const comFoto = products.filter((produto) => produto.image_path);
  if (!comFoto.length) return null;

  const normalizar = (valor: string) =>
    valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const doBriefing = normalizar(produtoDoBriefing);
  const daPeca = normalizar(`${direction.hook ?? ""} ${direction.visual_prompt ?? ""} ${headline}`);

  // O briefing manda; a peça desempata; o primeiro com foto é o último recurso.
  const acha = (texto: string) =>
    texto
      ? comFoto.find((produto) => {
          const nome = normalizar(produto.name ?? "");
          return Boolean(nome) && (texto.includes(nome) || nome.includes(texto));
        })
      : undefined;

  const escolhido = acha(doBriefing) ?? acha(daPeca) ?? comFoto[0];

  const { data } = await admin.storage
    .from("product-assets")
    .createSignedUrl(escolhido.image_path!, MINUTOS_DE_ACESSO);

  return data?.signedUrl ?? null;
}
