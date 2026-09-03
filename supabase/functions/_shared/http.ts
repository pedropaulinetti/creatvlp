export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN")?.trim() || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  unauthorized: () => new AppError("nao_autenticado", "Faça login para continuar.", 401),
  forbidden: (message = "Você não tem acesso a este workspace.") =>
    new AppError("sem_permissao", message, 403),
  invalid: (message: string, details?: unknown) =>
    new AppError("dados_invalidos", message, 422, details),
  quota: (message: string) => new AppError("quota_excedida", message, 429),
  rateLimit: () =>
    new AppError("muitas_requisicoes", "Muitas solicitações seguidas. Aguarde um instante.", 429),
  upstream: (message = "O provedor de IA não respondeu como esperado.") =>
    new AppError("falha_ia", message, 502),
  internal: (message = "Algo não deu certo do nosso lado.") =>
    new AppError("erro_interno", message, 500),
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Nunca devolve stack trace nem conteúdo de prompt para o cliente. */
export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
  }
  console.error("erro_nao_tratado", error instanceof Error ? error.message : String(error));
  return json({ error: { code: "erro_interno", message: "Algo não deu certo do nosso lado." } }, 500);
}

/** Envolve o handler com CORS, OPTIONS e tratamento de erro padronizado. */
export function serveJson(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return handleOptions();
    if (request.method !== "POST") {
      return errorResponse(new AppError("metodo_invalido", "Use POST.", 405));
    }
    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
