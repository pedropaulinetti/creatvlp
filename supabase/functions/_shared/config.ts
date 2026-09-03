/**
 * Configuração central de modelos e endpoints.
 * Todo slug vive aqui — nunca espalhado pelo código das funções.
 *
 * Validado contra https://openrouter.ai/api/v1/models em 24/08/2026.
 * Observação: `bytedance-seed/seedream-4.5` não existe no catálogo do OpenRouter;
 * a geração de imagem usa os modelos abaixo, todos com entrada de imagem
 * (necessária para referências de produto e identidade).
 */
const env = (key: string, fallback = ""): string => Deno.env.get(key)?.trim() || fallback;

export const OPENROUTER = {
  apiKey: env("OPENROUTER_API_KEY"),
  baseUrl: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
  siteUrl: env("OPENROUTER_SITE_URL", "https://www.creatv.com.br"),
  appName: env("OPENROUTER_APP_NAME", "CreatvOS"),
  /** "chat" usa /chat/completions com modalities; "images" usa /images. */
  imageTransport: env("OPENROUTER_IMAGE_TRANSPORT", "chat") as "chat" | "images",
} as const;

export const MODELS = {
  /** Classificação, resumo, extração de briefing, reformatação, conversa simples. */
  fast: env("OPENROUTER_FAST_MODEL", "openai/gpt-5.6-luna"),
  /*
   * Posicionamento, ângulos, hooks, copies, recomendações.
   *
   * Escolhido por custo E por tempo. Medido em 02/09/2026 na carga real —
   * 3 caminhos e depois 3 copies estruturadas por caminho:
   *
   *                      direções   copies   custo/chamada
   *   gemini-2.5-flash      7,7s      8,9s   US$ 0,000874
   *   qwen3-235b-a22b      34,2s     30,2s   US$ 0,000119
   *   deepseek-v3.2        38,4s     38,2s   US$ 0,000178
   *   claude-sonnet-5          —         —   US$ 0,005086
   *
   * O qwen é 7 vezes mais barato e foi a primeira escolha, medindo só custo e
   * qualidade em saídas curtas. Na carga real ele leva 4 vezes mais tempo e
   * estoura o teto de 150 segundos da Edge Function: a campanha morria no meio
   * e deixava job órfão. Latência aqui não é conforto — é a diferença entre
   * funcionar e não funcionar.
   *
   * O gemini continua 6 vezes mais barato que o Sonnet. O qwen fica de reserva:
   * mais lento, mas de outro fornecedor e capaz de entregar quando há tempo.
   */
  strategy: env("OPENROUTER_STRATEGY_MODEL", "google/gemini-2.5-flash"),
  strategyFallback: env("OPENROUTER_STRATEGY_FALLBACK", "qwen/qwen3-235b-a22b-2507"),
} as const;

/**
 * Imagem-base por nível de qualidade. Testar em escala pede volume barato;
 * a peça que vai ao ar pede o melhor modelo. O usuário escolhe o mix a cada
 * geração e vê o custo antes de confirmar.
 *
 * Todos aceitam imagem de entrada, necessária para referências de produto
 * e identidade. Texto nunca é pedido ao modelo — quem compõe é o CreatvOS.
 */
export type ImageQuality = "rascunho" | "padrao" | "alta";

export const IMAGE_MODELS: Record<ImageQuality, { model: string; fallback: string; costUsd: number; label: string }> = {
  rascunho: {
    model: env("OPENROUTER_IMAGE_MODEL_RASCUNHO", "google/gemini-2.5-flash-image"),
    fallback: env("OPENROUTER_IMAGE_FALLBACK", "google/gemini-2.5-flash-image"),
    costUsd: Number(env("OPENROUTER_IMAGE_COST_RASCUNHO", "0.039")),
    label: "Rascunho",
  },
  padrao: {
    model: env("OPENROUTER_IMAGE_MODEL_PADRAO", "google/gemini-3.1-flash-image"),
    fallback: env("OPENROUTER_IMAGE_FALLBACK", "google/gemini-2.5-flash-image"),
    costUsd: Number(env("OPENROUTER_IMAGE_COST_PADRAO", "0.077")),
    label: "Padrão",
  },
  alta: {
    model: env("OPENROUTER_IMAGE_MODEL_ALTA", "google/gemini-3-pro-image"),
    fallback: env("OPENROUTER_IMAGE_MODEL_PADRAO", "google/gemini-3.1-flash-image"),
    costUsd: Number(env("OPENROUTER_IMAGE_COST_ALTA", "0.155")),
    label: "Alta",
  },
};

export const DEFAULT_IMAGE_QUALITY: ImageQuality = (env("OPENROUTER_IMAGE_QUALITY_DEFAULT", "padrao") as ImageQuality);

export function imageModelFor(quality: ImageQuality = DEFAULT_IMAGE_QUALITY) {
  return IMAGE_MODELS[quality] ?? IMAGE_MODELS[DEFAULT_IMAGE_QUALITY];
}

/** Custo estimado por imagem no nível escolhido, para avisar antes de gerar. */
export function estimatedImageCost(quality: ImageQuality = DEFAULT_IMAGE_QUALITY): number {
  return imageModelFor(quality).costUsd;
}

export const TIMEOUTS = {
  chatMs: Number(env("OPENROUTER_CHAT_TIMEOUT_MS", "60000")),
  imageMs: Number(env("OPENROUTER_IMAGE_TIMEOUT_MS", "120000")),
  fetchUrlMs: Number(env("URL_FETCH_TIMEOUT_MS", "8000")),
} as const;

export const LIMITS = {
  maxRetries: 2,
  /** Teto de peças por campanha e por execução de rotina. */
  maxQuantity: 30,
  /** Rate limit por usuário, por janela. */
  rateWindowSeconds: 60,
  rateMaxRequests: 20,
  /** Bytes máximos ao ler uma URL no onboarding. */
  maxUrlBytes: 1_500_000,
} as const;

export const SUPABASE = {
  url: env("SUPABASE_URL"),
  serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: env("SUPABASE_ANON_KEY"),
} as const;

/** Provider fake: só liga quando explicitamente pedido (testes/CI). Nunca em produção. */
export const USE_FAKE_AI = env("FAKE_AI") === "true";
