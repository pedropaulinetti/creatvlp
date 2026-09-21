import { requireSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

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
  /**
   * O mesmo pedido ainda está rodando no servidor.
   *
   * Separado do rate limit porque a conduta é outra: aqui não adianta pedir
   * mais devagar, adianta esperar a geração anterior terminar ou ser dada por
   * abandonada. A mensagem do servidor já diz quantos segundos faltam.
   */
  get isEmCurso() {
    return this.code === "geracao_em_curso";
  }
}

export type EdgeFunctionName =
  | "analyze-brand"
  | "interpret-brand"
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

/** Uma etapa anunciada por uma função que transmite progresso. */
export type EtapaFuncao = { etapa: string; estado: "lendo" | "feito"; dados?: unknown };

type EventoStream =
  | ({ tipo: "etapa" } & EtapaFuncao)
  | { tipo: "pronto"; payload: unknown }
  | { tipo: "erro"; code: string; message: string };

/**
 * Igual a `callFunction`, mas acompanha as etapas enquanto elas acontecem.
 *
 * `functions.invoke` do supabase-js junta a resposta inteira antes de devolver,
 * o que anula o streaming — por isso aqui o fetch é direto, repetindo o mesmo
 * redirecionamento de host que o cliente usa nos testes ponta a ponta.
 *
 * Quem chama deve tratar a falha caindo para `callFunction`: o resultado é o
 * mesmo, só chega de uma vez.
 */
export async function streamFunction<T>(
  name: EdgeFunctionName,
  body: Record<string, unknown>,
  aoEtapa: (etapa: EtapaFuncao) => void,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FunctionError("nao_autenticado", "Faça login para continuar.", 401);

  const base = env.functionsUrl ?? `${env.supabaseUrl}/functions/v1`;
  const response = await fetch(`${base}/${name}`, {
    method: "POST",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseKey ?? "",
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    // Erro antes de o stream abrir ainda vem no formato JSON de sempre.
    const payload = await response.json().catch(() => null);
    const detail = (payload as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    throw new FunctionError(
      detail?.code ?? "falha_rede",
      detail?.message ?? "Não conseguimos falar com o servidor. Verifique sua conexão.",
      response.status,
      detail?.details,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resultado: T | undefined;

  const consumir = (bruto: string) => {
    const linha = bruto.split("\n").find((parte) => parte.startsWith("data: "));
    if (!linha) return;
    let evento: EventoStream;
    try {
      evento = JSON.parse(linha.slice(6)) as EventoStream;
    } catch {
      return; // pacote truncado: o próximo traz o evento inteiro
    }
    if (evento.tipo === "etapa") aoEtapa({ etapa: evento.etapa, estado: evento.estado, dados: evento.dados });
    else if (evento.tipo === "pronto") resultado = evento.payload as T;
    else if (evento.tipo === "erro") throw new FunctionError(evento.code, evento.message, 400);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const pacotes = buffer.split("\n\n");
    buffer = pacotes.pop() ?? "";
    for (const pacote of pacotes) consumir(pacote);
  }
  if (buffer.trim()) consumir(buffer);

  if (resultado === undefined) {
    throw new FunctionError("stream_incompleto", "A leitura foi interrompida antes do fim.", 0);
  }
  return resultado;
}
