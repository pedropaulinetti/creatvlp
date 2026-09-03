import { z } from "npm:zod@3.23.8";
import { serveJson, json, errors } from "../_shared/http.ts";
import { adminClient, requireUser, requireMembership, assertBrandInWorkspace, enforceRateLimit } from "../_shared/auth.ts";
import { chatStructured } from "../_shared/openrouter.ts";
import { chatTurnSchema } from "../_shared/schemas.ts";
import { chatSystemPrompt } from "../_shared/prompts.ts";
import { loadBrandMemory } from "../_shared/memory.ts";
import { recordUsage } from "../_shared/jobs.ts";
import { MODELS } from "../_shared/config.ts";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(2).max(4000),
});

const HISTORY_LIMIT = 20;

export const handler = serveJson(async (request) => {
    const caller = await requireUser(request);
    const admin = adminClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw errors.invalid("Envie a marca e a mensagem da conversa.");
    const { workspace_id: workspaceId, brand_id: brandId, message } = parsed.data;

    await requireMembership(admin, caller.userId, workspaceId);
    await assertBrandInWorkspace(admin, brandId, workspaceId);
    await enforceRateLimit(admin, workspaceId, caller.userId);

    // Conversa existente ou nova — a conversa sobrevive a recarregar a página.
    let conversationId = parsed.data.conversation_id ?? null;
    if (conversationId) {
      const { data } = await admin
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!data) throw errors.forbidden("Conversa não encontrada neste workspace.");
    } else {
      const { data, error } = await admin
        .from("conversations")
        .insert({
          workspace_id: workspaceId,
          brand_id: brandId,
          title: message.slice(0, 70),
          created_by: caller.userId,
        })
        .select("id")
        .single();
      if (error || !data) throw errors.internal("Não foi possível abrir a conversa.");
      conversationId = data.id;
    }

    const { data: history } = await admin
      .from("conversation_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    await admin.from("conversation_messages").insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    const { context } = await loadBrandMemory(admin, brandId, workspaceId);

    const turns = (history ?? [])
      .reverse()
      .filter((item) => item.role !== "system")
      .map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));

    const { data: turn, usage } = await chatStructured({
      schema: chatTurnSchema,
      schemaName: "chatTurn",
      // Interpretar pedido e extrair briefing é tarefa do modelo rápido.
      model: MODELS.fast,
      temperature: 0.4,
      maxTokens: 2000,
      messages: [
        { role: "system", content: chatSystemPrompt(context) },
        ...turns,
        { role: "user", content: message },
      ],
    });

    await admin.from("conversation_messages").insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: "assistant",
      content: turn.reply,
      payload: turn as never,
      model: usage.model,
      tokens_in: usage.tokensIn,
      tokens_out: usage.tokensOut,
    });

    await admin
      .from("conversations")
      .update({ status: turn.ready ? "briefing" : "aberta" })
      .eq("id", conversationId);

    await recordUsage(admin, { workspaceId, userId: caller.userId, kind: "chat", usage });

    return json({ conversation_id: conversationId, turn });
  });

// Executada pelo runtime do Supabase; importável em testes locais.
if (import.meta.main) Deno.serve(handler);
