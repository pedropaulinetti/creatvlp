import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, enforceRateLimit } from "../_shared/auth.ts";
import { fetchPublicPage, extractPageFacts, fetchImage } from "../_shared/url-guard.ts";
import { uploadBytes } from "../_shared/storage.ts";
import { extractDesignSystem } from "../_shared/design-system.ts";
import { firecrawlEnabled, pareceVazia, fetchRendered } from "../_shared/firecrawl.ts";
import { looksLikeShopify, importShopifyStore, detectCurrency } from "../_shared/shopify.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { brandAnalysisSchema } from "../_shared/schemas.ts";
import { brandAnalysisPrompt } from "../_shared/prompts.ts";
import { recordUsage, auditLog } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  url: z.string().trim().min(4).max(500),
  /** Marca em rascunho do onboarding: permite já guardar o logo no lugar certo. */
  brand_id: z.string().uuid().optional(),
});

export const handler = serveJson(async (request) => {
  const caller = await requireUser(request);
  const admin = adminClient();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw errors.invalid("Informe o workspace e a URL a analisar.");
  const { workspace_id: workspaceId, url, brand_id: brandId } = parsed.data;

  await requireMembership(admin, caller.userId, workspaceId);
  await enforceRateLimit(admin, workspaceId, caller.userId);

  // Leitura no servidor, com proteção contra SSRF. Scripts nunca são executados.
  const page = await fetchPublicPage(url);
  let html = page.html;
  let renderizado = false;

  /*
   * Se a página só monta o conteúdo no navegador, o HTML inicial vem vazio.
   * Nesse caso — e só nesse — pedimos a versão renderizada ao Firecrawl.
   * Sem a chave configurada, seguimos com o que veio.
   */
  if (pareceVazia(html) && firecrawlEnabled()) {
    const renderizada = await fetchRendered(page.url);
    if (renderizada.length > html.length) {
      html = renderizada;
      renderizado = true;
    }
  }

  const facts = extractPageFacts(html);

  // Design system e catálogo saem de dados estruturados, não de adivinhação:
  // as cores e fontes vêm do CSS, os produtos vêm do Shopify quando existe.
  const [design, shopify] = await Promise.all([
    extractDesignSystem(html, page.url).catch(() => null),
    looksLikeShopify(html)
      ? importShopifyStore(page.url, 12, detectCurrency(html)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const temConteudo = facts.title || facts.description || facts.headings.length > 0;
  const temEstrutura = Boolean(shopify?.isShopify || design?.colors.length);
  if (!temConteudo && !temEstrutura) {
    throw errors.invalid("A página não trouxe conteúdo suficiente. Você pode preencher os dados manualmente.");
  }

  /*
   * Cores, fontes, logo e catálogo saem de leitura pura — não dependem de IA.
   * Só a interpretação de texto (descrição, segmento, tom) usa o modelo rápido.
   * Se ele falhar, o onboarding segue com tudo que foi extraído.
   */
  const vazio = {
    name: "", description: "", segment: "", voice_tone: "",
    colors: [] as { hex: string; role: string; label: string }[],
    products: [] as { name: string; description: string }[],
    audience: "", differentiators: [] as string[], confidence: "baixa" as const,
  };

  let data = vazio;
  let usage: Awaited<ReturnType<typeof chatStructured>>["usage"] | null = null;
  let textoAnalisado = true;
  let motivoTexto = "";

  try {
    const resultado = await chatStructured({
      schema: brandAnalysisSchema,
      schemaName: "brandAnalysis",
      model: MODELS.fast,
      temperature: 0.2,
      maxTokens: 1600,
      messages: [
        {
          role: "user",
          content: brandAnalysisPrompt(
            {
              ...facts,
              // O que veio da loja entra como fato, não como suposição.
              produtos_da_loja: shopify?.products.map((p) => p.name) ?? [],
              categorias_da_loja: shopify?.productTypes ?? [],
              tipografia_detectada: design?.fonts.candidates ?? [],
            },
            page.url,
          ),
        },
      ],
    });
    data = resultado.data as typeof vazio;
    usage = resultado.usage;
  } catch (falha) {
    textoAnalisado = false;
    motivoTexto = falha instanceof Error ? falha.message : "A leitura de texto não pôde ser feita.";
    console.error("analise_texto_indisponivel", motivoTexto.slice(0, 160));
    // Sem IA, o essencial ainda vem da página.
    data = {
      ...vazio,
      name: facts.siteName || facts.ogTitle || facts.title,
      description: facts.description,
    };
  }

  // Traz o logo para o nosso Storage: o do site pode sumir, mudar ou bloquear CORS.
  let logoPath: string | null = null;
  if (brandId && design?.logo) {
    const imagem = await fetchImage(design.logo.url);
    if (imagem) {
      logoPath = await uploadBytes(admin, {
        bucket: "brand-assets",
        workspaceId,
        brandId,
        resourceType: "logo",
        bytes: imagem.bytes,
        mimeType: imagem.mimeType,
      });
    }
  }

  if (usage) {
    await recordUsage(admin, { workspaceId, userId: caller.userId, kind: "analise_marca", usage });
  }
  await auditLog(admin, {
    workspaceId,
    actorId: caller.userId,
    action: "marca.analisada",
    entityType: "brand",
    metadata: {
      url: page.url,
      confidence: data.confidence,
      shopify: Boolean(shopify?.isShopify),
      renderizado,
      cores: design?.colors.length ?? 0,
      produtos: shopify?.products.length ?? 0,
    },
  });

  return json({
    analysis: {
      ...data,
      // Cor lida do CSS vale mais que cor inferida por modelo.
      colors: design?.colors.length ? design.colors.map(({ hex, role, label }) => ({ hex, role, label })) : data.colors,
      // Produto vindo da loja tem preço e imagem; o do modelo é só um palpite.
      products: shopify?.products.length
        ? shopify.products.map((p) => ({ name: p.name, description: p.description }))
        : data.products,
      name: data.name || shopify?.vendor || "",
    },
    design_system: design ? { ...design, logo_path: logoPath } : null,
    shopify: shopify?.isShopify
      ? {
          vendor: shopify.vendor,
          currency: shopify.currency,
          products: shopify.products,
          product_types: shopify.productTypes,
        }
      : null,
    // O cliente precisa saber que a parte de texto não rodou, para pedir revisão.
    text_analysis: { ok: textoAnalisado, reason: textoAnalisado ? "" : motivoTexto },
    // Diz se a página precisou ser renderizada para render conteúdo.
    rendered: renderizado,
    source: { url: page.url, title: facts.title, og_image: facts.ogImage, site_name: facts.siteName },
  });
});

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
