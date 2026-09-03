import { z } from "npm:zod@3.23.8";
import { imageModelFor, LIMITS, MODELS, OPENROUTER, TIMEOUTS, USE_FAKE_AI, type ImageQuality } from "./config.ts";
import { errors } from "./http.ts";
import { fakeChat, fakeImage } from "./fake-provider.ts";

export type Usage = {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headers() {
  if (!OPENROUTER.apiKey) {
    throw errors.internal(
      "OPENROUTER_API_KEY não configurada. Configure o segredo da Edge Function para gerar com IA.",
    );
  }
  return {
    Authorization: `Bearer ${OPENROUTER.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": OPENROUTER.siteUrl,
    "X-Title": OPENROUTER.appName,
  };
}

/** POST com timeout, retry limitado e respeito ao Retry-After. */
async function post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= LIMITS.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${OPENROUTER.baseUrl}${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        if (attempt < LIMITS.maxRetries) {
          await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 800 * 2 ** attempt);
          continue;
        }
        const detail = await response.text().catch(() => "");
        throw errors.upstream(
          response.status === 429
            ? "O provedor de IA está limitando as requisições. Tente de novo em instantes."
            : `O provedor de IA respondeu ${response.status}. ${detail.slice(0, 160)}`,
        );
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw errors.upstream(`O provedor de IA recusou a chamada (${response.status}). ${detail.slice(0, 160)}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (aborted && attempt < LIMITS.maxRetries) {
        continue;
      }
      if (aborted) throw errors.upstream("O provedor de IA demorou demais para responder.");
      if (attempt >= LIMITS.maxRetries) throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? errors.upstream();
}

function readUsage(payload: Record<string, any>, model: string, latencyMs: number): Usage {
  const usage = payload?.usage ?? {};
  return {
    model: payload?.model ?? model,
    tokensIn: Number(usage.prompt_tokens ?? 0),
    tokensOut: Number(usage.completion_tokens ?? 0),
    costUsd: Number(usage.cost ?? 0),
    latencyMs,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"");
  try {
    return JSON.parse(withoutFence);
  } catch {
    // Último recurso: primeiro objeto balanceado do texto.
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw errors.upstream("A resposta da IA não veio em JSON válido.");
  }
}

/**
 * Saída estruturada validada com Zod.
 * Se o JSON vier inválido, faz **uma** tentativa de reparo. Nunca entra em laço.
 */
export async function chatStructured<T>({
  schema,
  schemaName,
  messages,
  model = MODELS.strategy,
  fallbackModel,
  maxTokens = 4000,
  temperature = 0.7,
}: {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  messages: ChatMessage[];
  model?: string;
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ data: T; usage: Usage }> {
  if (USE_FAKE_AI) return fakeChat(schema, schemaName, messages);

  const call = async (chatMessages: ChatMessage[], useModel: string) => {
    const started = Date.now();
    const response = await post(
      "/chat/completions",
      {
        model: useModel,
        models: fallbackModel ? [useModel, fallbackModel] : undefined,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
        usage: { include: true },
      },
      TIMEOUTS.chatMs,
    );
    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const text: string = choice?.message?.content ?? "";
    return {
      text,
      finishReason: String(choice?.finish_reason ?? choice?.native_finish_reason ?? "desconhecido"),
      usage: readUsage(payload, useModel, Date.now() - started),
    };
  };

  const first = await call(messages, model);
  const firstParse = schema.safeParse(safeExtract(first.text));
  if (firstParse.success) return { data: firstParse.data, usage: first.usage };

  // Uma única tentativa de reparo, informando exatamente o que falhou.
  const repair = await call(
    [
      ...messages,
      { role: "assistant", content: first.text.slice(0, 6000) },
      {
        role: "user",
        content:
          `O JSON acima é inválido para o schema "${schemaName}". Erros:\n` +
          JSON.stringify(firstParse.error.issues.slice(0, 12)) +
          "\n\nResponda somente com o JSON corrigido, sem comentários e sem markdown.",
      },
    ],
    model,
  );

  const repairParse = schema.safeParse(safeExtract(repair.text));
  if (!repairParse.success) {
    /*
     * Diagnóstico sem conteúdo: só onde falhou e por quê. Sem isso, um job
     * quebrado vira "tente de novo" e ninguém consegue investigar.
     */
    const campos = repairParse.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "(raiz)"}:${issue.code}`)
      .join(", ");
    const truncou = first.finishReason === "length" || repair.finishReason === "length";

    console.error("saida_estruturada_invalida", JSON.stringify({
      schema: schemaName,
      campos,
      finish_reason_1: first.finishReason,
      finish_reason_2: repair.finishReason,
      tamanho_1: first.text.length,
      tamanho_2: repair.text.length,
    }));

    throw errors.upstream(
      truncou
        ? `A resposta da IA foi cortada antes do fim (schema ${schemaName}). Reduza a quantidade de peças e tente de novo.`
        : `A IA devolveu um resultado fora do formato em: ${campos}. Tente novamente.`,
    );
  }

  return {
    data: repairParse.data,
    usage: {
      ...repair.usage,
      tokensIn: first.usage.tokensIn + repair.usage.tokensIn,
      tokensOut: first.usage.tokensOut + repair.usage.tokensOut,
      costUsd: first.usage.costUsd + repair.usage.costUsd,
    },
  };
}

function safeExtract(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

/** Texto livre — usado só onde não há estrutura a validar. */
export async function chatText({
  messages,
  model = MODELS.fast,
  maxTokens = 1200,
  temperature = 0.6,
}: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; usage: Usage }> {
  if (USE_FAKE_AI) {
    return { text: "Resposta de teste.", usage: { model: "fake", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 1 } };
  }
  const started = Date.now();
  const response = await post(
    "/chat/completions",
    { model, messages, max_tokens: maxTokens, temperature, usage: { include: true } },
    TIMEOUTS.chatMs,
  );
  const payload = await response.json();
  return {
    text: payload?.choices?.[0]?.message?.content ?? "",
    usage: readUsage(payload, model, Date.now() - started),
  };
}

export type GeneratedImage = { base64: string; mimeType: string };

/**
 * Imagem-base. O prompt descreve **cena e fundo** — headline, logo, preço e CTA
 * são compostos depois pelo CreatvOS, de forma determinística.
 */
export async function generateImage({
  prompt,
  references = [],
  quality,
  model,
  fallbackModel,
}: {
  prompt: string;
  references?: string[];
  quality?: ImageQuality;
  model?: string;
  fallbackModel?: string;
}): Promise<{ image: GeneratedImage; usage: Usage }> {
  if (USE_FAKE_AI) return fakeImage();

  const tier = imageModelFor(quality);
  model = model ?? tier.model;
  fallbackModel = fallbackModel ?? tier.fallback;
  const started = Date.now();

  if (OPENROUTER.imageTransport === "images") {
    const response = await post("/images", { model, prompt, n: 1, usage: { include: true } }, TIMEOUTS.imageMs);
    const payload = await response.json();
    const item = payload?.data?.[0];
    const raw: string = item?.b64_json ?? item?.image_url?.url ?? "";
    return { image: parseImage(raw), usage: readUsage(payload, model, Date.now() - started) };
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const reference of references.slice(0, 4)) {
    content.push({ type: "image_url", image_url: { url: reference } });
  }

  const response = await post(
    "/chat/completions",
    {
      model,
      models: fallbackModel ? [model, fallbackModel] : undefined,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      usage: { include: true },
    },
    TIMEOUTS.imageMs,
  );

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  const raw: string = message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.url ?? "";
  if (!raw) throw errors.upstream("O modelo não devolveu nenhuma imagem.");

  return { image: parseImage(raw), usage: readUsage(payload, model, Date.now() - started) };
}

function parseImage(raw: string): GeneratedImage {
  if (!raw) throw errors.upstream("O modelo não devolveu nenhuma imagem.");
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(raw);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: "image/png", base64: raw };
}
