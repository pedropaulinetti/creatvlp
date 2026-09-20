import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { querStream, streamEvents, type Emitir } from "../_shared/stream.ts";
import { adminClient, requireUser, requireMembership, enforceRateLimit } from "../_shared/auth.ts";
import { fetchPublicPage, extractPageFacts, fetchImage, fetchFont, decodeDataUrl } from "../_shared/url-guard.ts";
import { uploadBytes } from "../_shared/storage.ts";
import { extractDesignSystem, extractImages, extractLogo } from "../_shared/design-system.ts";
import { escolherPaginas } from "../_shared/crawl.ts";
import { firecrawlEnabled, pareceVazia, fetchRendered } from "../_shared/firecrawl.ts";
import { montarCatalogo, type Catalogo } from "../_shared/catalogo.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { brandAnalysisSchema } from "../_shared/schemas.ts";
import { brandAnalysisPrompt } from "../_shared/prompts.ts";
import { recordUsage, auditLog } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/*
 * Referência visual é matéria-prima: quanto mais a marca tiver guardado, menos
 * a geração de peças precisa inventar. O teto existe só para a leitura não
 * virar um download sem fim.
 */
const MAX_REFERENCIAS = 12;

/** Imagens de produto guardadas junto do catálogo. */
const MAX_IMAGENS_DE_PRODUTO = 12;

/** Páginas internas lidas além da home. */
const MAX_PAGINAS = 5;

/** Imagens coletadas ao todo, somando a home e as páginas internas. */
const MAX_IMAGENS = 30;

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  url: z.string().trim().min(4).max(500),
  /** Marca em rascunho do onboarding: permite já guardar o logo no lugar certo. */
  brand_id: z.string().uuid().optional(),
});

type Contexto = {
  admin: SupabaseClient;
  userId: string;
  workspaceId: string;
  url: string;
  brandId?: string;
};

export const handler = serveJson(async (request) => {
  const caller = await requireUser(request);
  const admin = adminClient();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw errors.invalid("Informe o workspace e a URL a analisar.");
  const { workspace_id: workspaceId, url, brand_id: brandId } = parsed.data;

  await requireMembership(admin, caller.userId, workspaceId);
  await enforceRateLimit(admin, workspaceId, caller.userId);

  const contexto: Contexto = { admin, userId: caller.userId, workspaceId, url, brandId };

  /*
   * Autenticação, permissão e quota já passaram: daqui para frente o erro é da
   * leitura em si. Quem pediu stream recebe as etapas assim que acontecem;
   * quem não pediu recebe o mesmo JSON de sempre, no fim.
   */
  if (querStream(request)) return streamEvents((emitir) => analisar(contexto, emitir));
  return json(await analisar(contexto, () => {}));
});

async function analisar(contexto: Contexto, emitir: Emitir) {
  const { admin, userId, workspaceId, brandId } = contexto;
  const passo = (etapa: string, dados?: unknown) =>
    emitir({ tipo: "etapa", etapa, estado: "feito", dados });
  const iniciando = (etapa: string) => emitir({ tipo: "etapa", etapa, estado: "lendo" });

  // Leitura no servidor, com proteção contra SSRF. Scripts nunca são executados.
  iniciando("pagina");
  const page = await fetchPublicPage(contexto.url);
  let html = page.html;
  let renderizado = false;

  /*
   * Quando a página depende do navegador para se montar, pedimos a versão
   * renderizada ao Firecrawl. Sem a chave configurada, seguimos com o que veio.
   *
   * Duas situações pedem isso, não uma. A óbvia é o HTML chegar vazio. A outra
   * é o HTML ter texto mas nenhuma imagem: em site feito como aplicação as
   * fotos entram por JavaScript, e sem renderizar a marca fica sem nenhuma
   * referência visual — foi o caso do leavo.ai.
   */
  // Sem o recurso à imagem social: aqui a pergunta é se a página tem imagem
  // de verdade, e a social responderia "tem" mesmo quando não há nenhuma.
  const soTextoSemImagem = extractImages(html, page.url, 6, false).length === 0;
  if ((pareceVazia(html) || soTextoSemImagem) && firecrawlEnabled()) {
    const renderizada = await fetchRendered(page.url);
    if (renderizada.length > html.length) {
      html = renderizada;
      renderizado = true;
    }
  }

  const facts = extractPageFacts(html);
  passo("pagina", { url: page.url, titulo: facts.title, site: facts.siteName });

  /*
   * A home diz o que a marca é; o que ela vende costuma estar em produtos,
   * planos ou serviços — e num site feito como aplicação as fotos de verdade
   * também só aparecem nas páginas internas.
   */
  iniciando("navegacao");
  const internas = await lerPaginasInternas(html, page.url);
  passo("navegacao", { paginas: internas.map((item) => item.url) });

  /*
   * Design system e catálogo saem de dados estruturados, não de adivinhação:
   * as cores e fontes vêm do CSS; os produtos, do `/products.json` do Shopify
   * ou do JSON-LD que toda plataforma publica para o Google. O que o modelo de
   * texto diz sobre produto é palpite — nunca tem preço nem foto.
   */
  iniciando("estilos");
  iniciando("catalogo");

  const [design, catalogo] = await Promise.all([
    extractDesignSystem(html, page.url, (etapa) => passo(etapa.etapa, etapa)).catch(() => null),
    montarCatalogo({ html, url: page.url, internas, limite: MAX_IMAGENS_DE_PRODUTO })
      .then((lido) => {
        passo("catalogo", {
          produtos: lido.products,
          moeda: lido.currency,
          vendor: lido.vendor,
          fonte: lido.fonte,
        });
        return lido;
      })
      .catch(() => {
        passo("catalogo", { produtos: [] });
        return null;
      }),
  ]);

  if (design && internas.length) completarComInternas(design, internas);

  const temConteudo = facts.title || facts.description || facts.headings.length > 0;
  const temEstrutura = Boolean(catalogo?.products.length || design?.colors.length);
  if (!temConteudo && !temEstrutura) {
    throw errors.invalid("A página não trouxe conteúdo suficiente. Me conte da marca que eu monto daqui.");
  }

  const { data, usage, textoAnalisado, motivoTexto } = await interpretarTexto(
    { ...facts, outras_paginas: internas.map((item) => item.resumo) },
    page.url,
    design,
    catalogo,
    iniciando,
    passo,
  );

  // Traz o logo para o nosso Storage: o do site pode sumir, mudar ou bloquear CORS.
  let logoPath: string | null = null;
  if (brandId && design?.logo) {
    // Logo embutido em `data:` já veio com a página — não há o que baixar.
    const imagem = /^data:/i.test(design.logo.url)
      ? decodeDataUrl(design.logo.url)
      : await fetchImage(design.logo.url);

    if (imagem) {
      logoPath = await uploadBytes(admin, {
        bucket: "brand-assets",
        workspaceId,
        brandId,
        resourceType: "logo",
        bytes: imagem.bytes,
        mimeType: imagem.mimeType,
      });
      passo("logo", { logo: design.logo, logo_path: logoPath });
    }
  }

  /*
   * As imagens do site viram referência visual da marca.
   *
   * Antes elas eram extraídas e descartadas. Guardá-las é o que permite que a
   * geração de peças parta do jeito que a marca já se fotografa, em vez de
   * inventar um visual do zero na primeira campanha.
   */
  /*
   * A foto do produto é a referência mais valiosa que existe: é o que a peça
   * precisa mostrar. Vai para o Storage junto do resto e o caminho volta em
   * cada produto, para o catálogo nascer já com imagem.
   */
  const comImagem = catalogo?.products.filter((produto) => produto.image || produto.images?.length) ?? [];
  const imagensDeProduto = await guardarImagensDeProduto(
    admin,
    brandId ? { workspaceId, brandId, produtos: comImagem.slice(0, MAX_IMAGENS_DE_PRODUTO) } : null,
  );

  /*
   * As fontes que o site serve, guardadas junto da marca.
   *
   * Sem o arquivo, a tela escreve "Commissioner" na fonte do sistema e quem
   * confere a identidade não vê a tipografia dela em lugar nenhum. O nome vem
   * do próprio `@font-face`, então é autoritativo sem abrir o binário.
   */
  const fontesGuardadas = await guardarFontes(
    admin,
    brandId ? { workspaceId, brandId, fontes: design?.fontFiles ?? [] } : null,
  );

  /*
   * A etapa de tipografia é anunciada duas vezes: primeiro com os nomes, assim
   * que saem do CSS, e de novo agora com os arquivos já no nosso Storage.
   *
   * O segundo anúncio é o que permite à tela escrever o nome da família na
   * letra dela. O arquivo no site da marca não serve para isso: servidor de
   * fonte quase nunca manda `Access-Control-Allow-Origin`, e o navegador
   * recusa. Passando pelo nosso bucket, a URL assinada carrega.
   */
  if (fontesGuardadas.length) {
    passo("tipografia", { fonts: design?.fonts, font_paths: fontesGuardadas });
  }

  const daPagina = design?.images.slice(0, MAX_REFERENCIAS) ?? [];
  let referencePaths: string[] = [];
  if (brandId && daPagina.length) {
    iniciando("referencias");
    referencePaths = await guardarReferencias(admin, { workspaceId, brandId, urls: daPagina });
  }
  passo("referencias", { imagens: daPagina, guardadas: referencePaths.length });

  if (usage) {
    await recordUsage(admin, { workspaceId, userId, kind: "analise_marca", usage });
  }
  await auditLog(admin, {
    workspaceId,
    actorId: userId,
    action: "marca.analisada",
    entityType: "brand",
    metadata: {
      url: page.url,
      confidence: data.confidence,
      catalogo: catalogo?.fonte || "nenhum",
      renderizado,
      cores: design?.colors.length ?? 0,
      produtos: catalogo?.products.length ?? 0,
      referencias: referencePaths.length,
      imagens_de_produto: [...imagensDeProduto.values()].flat().length,
      paginas: 1 + internas.length,
    },
  });

  /*
   * O catálogo devolvido já traz o caminho da foto no nosso Storage: é o que
   * permite ao rascunho gravar o produto com imagem, e à geração de peças
   * mostrar o produto de verdade em vez de um objeto inventado.
   */
  const catalogoDaResposta = catalogo?.products.length
    ? {
        vendor: catalogo.vendor,
        currency: catalogo.currency,
        source: catalogo.fonte,
        products: catalogo.products.map((produto) => {
          const guardadas = imagensDeProduto.get(produto.name) ?? [];
          return {
            ...produto,
            // A primeira é a principal; as demais viram a galeria do produto.
            image_path: guardadas[0] ?? null,
            image_paths: guardadas,
          };
        }),
        product_types: catalogo.productTypes,
      }
    : null;

  return {
    analysis: {
      ...data,
      // Cor lida do CSS vale mais que cor inferida por modelo.
      colors: design?.colors.length ? design.colors.map(({ hex, role, label }) => ({ hex, role, label })) : data.colors,
      // Produto lido do site tem preço e imagem; o do modelo é só um palpite.
      products: catalogo?.products.length
        ? catalogo.products.map((p) => ({ name: p.name, description: p.description }))
        : data.products,
      name: data.name || catalogo?.vendor || "",
    },
    design_system: design
      ? { ...design, logo_path: logoPath, reference_paths: referencePaths, font_paths: fontesGuardadas }
      : null,
    catalog: catalogoDaResposta,
    /*
     * `shopify` era o nome de quando só loja Shopify tinha catálogo. Continua
     * saindo idêntico enquanto houver app publicado que só sabe ler esse campo:
     * a função sobe antes do front, e nesse intervalo o catálogo não pode sumir.
     */
    shopify: catalogoDaResposta,
    // O cliente precisa saber que a parte de texto não rodou, para pedir revisão.
    text_analysis: { ok: textoAnalisado, reason: textoAnalisado ? "" : motivoTexto },
    // Diz se a página precisou ser renderizada para render conteúdo.
    rendered: renderizado,
    source: { url: page.url, title: facts.title, og_image: facts.ogImage, site_name: facts.siteName },
    pages: [page.url, ...internas.map((item) => item.url)],
  };
}

type PaginaInterna = {
  url: string;
  html: string;
  resumo: { url: string; titulo: string; titulos: string[]; texto: string };
};

/**
 * Lê as páginas internas escolhidas, em paralelo e sem deixar uma derrubar a
 * leitura inteira: página que não responde simplesmente não entra.
 */
async function lerPaginasInternas(html: string, baseUrl: string): Promise<PaginaInterna[]> {
  const enderecos = escolherPaginas(html, baseUrl, MAX_PAGINAS);
  if (!enderecos.length) return [];

  const lidas = await Promise.all(
    enderecos.map(async (endereco) => {
      try {
        const pagina = await fetchPublicPage(endereco);
        const facts = extractPageFacts(pagina.html);
        return {
          url: pagina.url,
          html: pagina.html,
          resumo: {
            url: pagina.url,
            titulo: facts.title,
            titulos: facts.headings.slice(0, 12),
            // O modelo não precisa da página inteira: o começo já diz o que ela vende.
            texto: facts.text.slice(0, 1800),
          },
        };
      } catch {
        return null;
      }
    }),
  );

  return lidas.filter((item): item is PaginaInterna => item !== null);
}

/**
 * Completa o design system com o que só existia nas páginas internas.
 *
 * A paleta e a tipografia não mudam de página para página — vêm das mesmas
 * folhas de estilo. Imagem e logo, sim: é comum a home não ter nenhuma foto e o
 * logo aparecer só no cabeçalho de uma página interna.
 */
function completarComInternas(
  design: Awaited<ReturnType<typeof extractDesignSystem>>,
  internas: PaginaInterna[],
): void {
  for (const pagina of internas) {
    if (!design.logo) design.logo = extractLogo(pagina.html, pagina.url);

    for (const imagem of extractImages(pagina.html, pagina.url)) {
      if (design.images.length >= MAX_IMAGENS) break;
      if (!design.images.includes(imagem)) design.images.push(imagem);
    }
  }
}

/**
 * Guarda a foto de cada produto, indexada pelo nome dele.
 *
 * Falha em uma não atrapalha as outras nem o catálogo: produto sem foto entra
 * do mesmo jeito, só sem imagem.
 */
/** Quantas fotos de cada produto valem o download. Depois disso é acervo morto. */
const MAX_FOTOS_POR_PRODUTO = 3;

async function guardarImagensDeProduto(
  admin: SupabaseClient,
  alvo:
    | {
        workspaceId: string;
        brandId: string;
        produtos: { name: string; image: string | null; images?: string[] }[];
      }
    | null,
): Promise<Map<string, string[]>> {
  const caminhos = new Map<string, string[]>();
  if (!alvo?.produtos.length) return caminhos;

  const guardadas = await Promise.all(
    alvo.produtos.map(async (produto) => {
      /*
       * Todas as fotos do produto, não só a capa. Um produto tem frente, verso
       * e uso — e a peça fica melhor quando o modelo vê mais de um ângulo do
       * mesmo objeto. A primeira continua sendo a principal.
       */
      const enderecos = [...new Set([produto.image, ...(produto.images ?? [])].filter(Boolean))]
        .slice(0, MAX_FOTOS_POR_PRODUTO) as string[];

      const doProduto = await Promise.all(
        enderecos.map(async (endereco) => {
          try {
            const imagem = await fetchImage(endereco);
            if (!imagem) return null;
            return await uploadBytes(admin, {
              bucket: "product-assets",
              workspaceId: alvo.workspaceId,
              brandId: alvo.brandId,
              resourceType: "produto",
              bytes: imagem.bytes,
              mimeType: imagem.mimeType,
            });
          } catch {
            // Uma foto que falha não derruba as outras do mesmo produto.
            return null;
          }
        }),
      );

      const validos = doProduto.filter((caminho): caminho is string => Boolean(caminho));
      return validos.length ? ([produto.name, validos] as const) : null;
    }),
  );

  for (const item of guardadas) {
    if (item) caminhos.set(item[0], item[1]);
  }
  return caminhos;
}

/**
 * Baixa e guarda as imagens da página, uma falha não derrubando as outras.
 *
 * Imagem de site é grande e nem sempre acessível; o que der certo entra, o que
 * não der é ignorado em silêncio — nenhuma delas é essencial ao onboarding.
 */
/**
 * Baixa e guarda os arquivos de fonte do site.
 *
 * Uma falha não derruba as outras, e fonte nenhuma não impede a leitura de
 * concluir: o nome da família continua valendo para a geração.
 */
async function guardarFontes(
  admin: SupabaseClient,
  alvo: { workspaceId: string; brandId: string; fontes: { familia: string; url: string }[] } | null,
): Promise<{ familia: string; path: string }[]> {
  if (!alvo?.fontes.length) return [];

  const guardadas = await Promise.all(
    alvo.fontes.map(async (fonte) => {
      try {
        const arquivo = await fetchFont(fonte.url);
        if (!arquivo) return null;
        /*
         * Servidor de fonte manda `octet-stream` com frequência. Quando manda,
         * o tipo não diz se é woff2 ou ttf e só o endereço sabe.
         */
        const extensao = fonte.url.match(/\.(woff2|woff|otf|ttf)(?:[?#]|$)/i)?.[1].toLowerCase();
        const caminho = await uploadBytes(admin, {
          bucket: "brand-assets",
          workspaceId: alvo.workspaceId,
          brandId: alvo.brandId,
          resourceType: "fonte",
          bytes: arquivo.bytes,
          mimeType: arquivo.mimeType,
          extensao,
        });
        return caminho ? { familia: fonte.familia, path: caminho } : null;
      } catch {
        return null;
      }
    }),
  );

  return guardadas.filter((item): item is { familia: string; path: string } => Boolean(item));
}

async function guardarReferencias(
  admin: SupabaseClient,
  { workspaceId, brandId, urls }: { workspaceId: string; brandId: string; urls: string[] },
): Promise<string[]> {
  const guardadas = await Promise.all(
    urls.map(async (url) => {
      try {
        const imagem = await fetchImage(url);
        if (!imagem) return null;
        return await uploadBytes(admin, {
          bucket: "brand-assets",
          workspaceId,
          brandId,
          resourceType: "referencia",
          bytes: imagem.bytes,
          mimeType: imagem.mimeType,
        });
      } catch {
        return null;
      }
    }),
  );

  return guardadas.filter((caminho): caminho is string => Boolean(caminho));
}

/*
 * Cores, fontes, logo e catálogo saem de leitura pura — não dependem de IA.
 * Só a interpretação de texto (descrição, segmento, tom) usa o modelo rápido.
 * Se ele falhar, o onboarding segue com tudo que foi extraído.
 */
async function interpretarTexto(
  facts: ReturnType<typeof extractPageFacts> & { outras_paginas?: unknown[] },
  url: string,
  design: Awaited<ReturnType<typeof extractDesignSystem>> | null,
  catalogo: Catalogo | null,
  iniciando: (etapa: string) => void,
  passo: (etapa: string, dados?: unknown) => void,
) {
  const vazio = {
    name: "", description: "", segment: "", voice_tone: "",
    colors: [] as { hex: string; role: string; label: string }[],
    products: [] as { name: string; description: string }[],
    audience: "", differentiators: [] as string[], confidence: "baixa" as const,
  };

  iniciando("texto");
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
              // O que veio do catálogo entra como fato, não como suposição.
              produtos_da_loja: catalogo?.products.map((p) => p.name) ?? [],
              categorias_da_loja: catalogo?.productTypes ?? [],
              tipografia_detectada: design?.fonts.candidates ?? [],
            },
            url,
          ),
        },
      ],
    });
    const data = resultado.data as typeof vazio;
    passo("texto", { name: data.name, description: data.description, segment: data.segment, voice_tone: data.voice_tone, audience: data.audience });
    return { data, usage: resultado.usage, textoAnalisado: true, motivoTexto: "" };
  } catch (falha) {
    const motivoTexto = falha instanceof Error ? falha.message : "A leitura de texto não pôde ser feita.";
    console.error("analise_texto_indisponivel", motivoTexto.slice(0, 160));
    // Sem IA, o essencial ainda vem da página.
    const data = {
      ...vazio,
      name: facts.siteName || facts.ogTitle || facts.title,
      description: facts.description,
    };
    passo("texto", { name: data.name, description: data.description, indisponivel: true });
    return { data, usage: null, textoAnalisado: false, motivoTexto };
  }
}

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
