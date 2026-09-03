/**
 * Onboarding de quem não tem site.
 *
 * Mesma saída de `analyze-brand`, outra entrada: em vez de ler o CSS de uma
 * página, lê o que a pessoa contou. Nada é gravado — o resultado alimenta o
 * mesmo rascunho e o mesmo cartão de confirmação.
 */
import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, enforceRateLimit } from "../_shared/auth.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { brandInterviewSchema } from "../_shared/schemas.ts";
import { brandInterviewPrompt } from "../_shared/prompts.ts";
import { recordUsage } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";

/** Conversa curta de propósito: se não deu em quatro trocas, não vai dar. */
const MAX_TURNOS = 8;

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(MAX_TURNOS),
});

export const handler = serveJson(async (request) => {
  const caller = await requireUser(request);
  const admin = adminClient();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw errors.invalid("Conte um pouco sobre a marca para continuarmos.");
  const { workspace_id: workspaceId, messages } = parsed.data;

  await requireMembership(admin, caller.userId, workspaceId);
  await enforceRateLimit(admin, workspaceId, caller.userId);

  const { data, usage } = await chatStructured({
    schema: brandInterviewSchema,
    schemaName: "brandInterview",
    model: MODELS.fast,
    temperature: 0.3,
    maxTokens: 1200,
    messages: [{ role: "system", content: brandInterviewPrompt() }, ...messages],
  });

  await recordUsage(admin, { workspaceId, userId: caller.userId, kind: "analise_marca", usage });

  // Depois do teto de turnos a conversa termina de qualquer jeito: insistir
  // vira interrogatório, e o que faltar se completa depois em Minha Marca.
  const complete = data.complete || messages.length >= MAX_TURNOS - 1;

  return json({ analysis: data.analysis, question: complete ? "" : data.question, complete });
});

if (import.meta.main) Deno.serve(handler);
