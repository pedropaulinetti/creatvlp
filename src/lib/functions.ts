import { requireSupabase } from "@/lib/supabase";

export class FunctionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "FunctionError";
  }

  get isQuota() {
    return this.code === "quota_excedida";
  }
  get isRateLimit() {
    return this.code === "muitas_requisicoes";
  }
}

export type EdgeFunctionName =
  | "analyze-brand"
  | "campaign-chat"
  | "generate-directions"
  | "generate-copies"
  | "generate-image"
  | "regenerate-asset"
  | "run-routines"
  | "record-performance"
  | "recommend-next-test"
  | "admin-retry-job";

/**
 * Toda chamada de IA passa por aqui — e daqui para uma Edge Function.
 * O navegador nunca fala com o OpenRouter diretamente.
 */
export async function callFunction<T>(
  name: EdgeFunctionName,
  body: Record<string, unknown>,
  options: { idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const client = requireSupabase();

  const { data, error } = await client.functions.invoke(name, {
    body,
    headers: options.idempotencyKey ? { "x-idempotency-key": options.idempotencyKey } : undefined,
  });

  if (error) {
    // O corpo do erro traz nosso formato { error: { code, message } }.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const payload = await context.json();
        const detail = payload?.error;
        if (detail?.message) {
          throw new FunctionError(detail.code ?? "erro_interno", detail.message, context.status ?? 500, detail.details);
        }
      } catch (parseError) {
        if (parseError instanceof FunctionError) throw parseError;
      }
    }
    throw new FunctionError("falha_rede", "Não conseguimos falar com o servidor. Verifique sua conexão.", 0);
  }

  const payload = data as { error?: { code: string; message: string; details?: unknown } } & T;
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new FunctionError(payload.error.code, payload.error.message, 400, payload.error.details);
  }

  return payload as T;
}

/** Mensagem pronta para exibir ao usuário, sem vazar detalhes internos. */
export function functionErrorMessage(error: unknown): string {
  if (error instanceof FunctionError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Algo não deu certo. Tente novamente em instantes.";
}
