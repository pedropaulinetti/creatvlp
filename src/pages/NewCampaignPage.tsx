import * as React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/field";
import { InlineError, Notice, LoadingBlock } from "@/components/ui/states";
import { BriefEditor } from "@/features/campaigns/BriefEditor";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { supabase, requireSupabase } from "@/lib/supabase";
import { callFunction, functionErrorMessage, FunctionError } from "@/lib/functions";
import { briefSchema, type Brief } from "@/lib/schemas";
import { available } from "@/lib/quotas";
import { cn } from "@/lib/utils";

type Turn = { reply: string; questions: string[]; brief: Brief | null; ready: boolean };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; brief?: Brief | null; questions?: string[] };

export default function NewCampaignPage() {
  const { user } = useAuth();
  const { workspaceId, brandId, brand, quota, plan } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const conversationId = searchParams.get("conversa");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState("");
  const [lastFailed, setLastFailed] = React.useState<string | null>(null);
  const cancelled = React.useRef(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const seeded = React.useRef(false);

  // Recuperação depois de atualizar a página: a conversa vive no banco.
  const history = useQuery({
    queryKey: ["conversation", conversationId],
    enabled: Boolean(conversationId && supabase),
    queryFn: async () => {
      const { data, error: queryError } = await supabase!
        .from("conversation_messages")
        .select("id, role, content, payload")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  React.useEffect(() => {
    if (!history.data) return;
    setMessages(
      history.data
        .filter((item) => item.role !== "system")
        .map((item) => {
          const payload = item.payload as Turn | null;
          return {
            id: item.id,
            role: item.role as "user" | "assistant",
            content: item.content,
            brief: payload?.brief ?? null,
            questions: payload?.questions ?? [],
          };
        }),
    );
  }, [history.data]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = React.useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || !workspaceId || !brandId) return;

      cancelled.current = false;
      setError("");
      setLastFailed(null);
      setDraft("");
      setSending(true);
      setMessages((current) => [
        ...current,
        { id: `local-${crypto.randomUUID()}`, role: "user", content: clean },
      ]);

      try {
        const result = await callFunction<{ conversation_id: string; turn: Turn }>("campaign-chat", {
          workspace_id: workspaceId,
          brand_id: brandId,
          conversation_id: conversationId,
          message: clean,
        });

        if (cancelled.current) return;

        if (!conversationId) {
          setSearchParams({ conversa: result.conversation_id }, { replace: true });
        }

        setMessages((current) => [
          ...current,
          {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            content: result.turn.reply,
            brief: result.turn.ready ? result.turn.brief : null,
            questions: result.turn.questions,
          },
        ]);
      } catch (sendError) {
        if (cancelled.current) return;
        setError(functionErrorMessage(sendError));
        setLastFailed(clean);
        setMessages((current) => current.slice(0, -1));
      } finally {
        setSending(false);
      }
    },
    [workspaceId, brandId, conversationId, setSearchParams],
  );

  // Pedido vindo da tela inicial entra direto na conversa.
  React.useEffect(() => {
    const initial = (location.state as { message?: string } | null)?.message;
    if (initial && !seeded.current && workspaceId && brandId && !conversationId) {
      seeded.current = true;
      window.history.replaceState({}, "");
      void send(initial);
    }
  }, [location.state, workspaceId, brandId, conversationId, send]);

  async function confirmBrief(brief: Brief) {
    if (!workspaceId || !brandId || !user) return;
    const parsed = briefSchema.safeParse(brief);
    if (!parsed.success) {
      setError("O briefing tem campos inválidos. Edite antes de confirmar.");
      return;
    }

    setConfirming(true);
    setError("");
    const client = requireSupabase();

    try {
      const { data: campaign, error: campaignError } = await client
        .from("campaigns")
        .insert({
          workspace_id: workspaceId,
          brand_id: brandId,
          name: parsed.data.campaign_name,
          objective: parsed.data.objective,
          status: "briefing_confirmado",
          channel: parsed.data.channel,
          occasion_date: parsed.data.occasion_date || null,
          origin: "conversa",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (campaignError || !campaign) throw campaignError ?? new Error("Falha ao criar campanha");

      const { error: briefError } = await client.from("campaign_briefs").insert({
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        version: 1,
        payload: parsed.data,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        created_by: user.id,
      });
      if (briefError) throw briefError;

      if (conversationId) {
        await client
          .from("conversations")
          .update({ campaign_id: campaign.id, status: "concluida" })
          .eq("id", conversationId);
      }

      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Briefing confirmado. Gerando os caminhos criativos.");
      navigate(`/app/campanhas/${campaign.id}?gerar=1`, { replace: true });
    } catch (confirmError) {
      const message =
        confirmError instanceof FunctionError
          ? confirmError.message
          : "Não conseguimos salvar o briefing. Tente novamente.";
      setError(message);
      setConfirming(false);
    }
  }

  const campaignsLeft = quota && plan ? available(quota, plan, "campanha") : null;

  if (history.isLoading) return <LoadingBlock label="Recuperando a conversa" className="min-h-[60dvh]" />;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col px-5 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <MonoLabel className="text-accent">Nova campanha</MonoLabel>
          <h1 className="text-[24px] font-normal tracking-[-0.02em] text-ink md:text-[28px]">
            {brand ? `Conversa sobre ${brand.name}` : "Nova campanha"}
          </h1>
        </div>
        <Button variant="quiet" size="icon" className="ml-auto" aria-label="Fechar" onClick={() => navigate("/app")}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {campaignsLeft !== null && campaignsLeft <= 0 && (
        <Notice tone="warning" className="mb-4">
          Você já usou todas as campanhas do ciclo. É possível conversar e montar o briefing, mas a geração
          dos caminhos vai pedir a renovação do plano.
        </Notice>
      )}

      <div className="flex flex-1 flex-col gap-5">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-line p-5">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Descreva o que você quer testar. A memória da {brand?.name ?? "sua marca"} já entra no contexto —
              não precisa repetir produto, tom nem público.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                "Quero uma campanha para divulgar nosso café especial no Dia dos Pais.",
                "Crie anúncios para nosso software focando na redução de tarefas manuais.",
                "Preciso de 6 stories para a promoção desta semana.",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDraft(example)}
                  className="rounded-[8px] px-2 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
                >
                  “{example}”
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-3">
            <div
              className={cn(
                "flex flex-col gap-1.5",
                message.role === "user" ? "items-end" : "items-start",
              )}
            >
              <MonoLabel>{message.role === "user" ? "Você" : "CreatvOS"}</MonoLabel>
              <div
                className={cn(
                  "max-w-[85%] rounded-[14px] px-4 py-3 text-[14px] leading-relaxed",
                  message.role === "user"
                    ? "bg-ink text-surface"
                    : "border border-line bg-card text-ink",
                )}
              >
                {message.content}
              </div>
            </div>

            {message.questions && message.questions.length > 0 && (
              <ul className="flex flex-col gap-1.5 pl-1">
                {message.questions.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => setDraft(question)}
                      className="flex items-start gap-2 text-left text-[13px] text-ink-2 transition-colors hover:text-accent"
                    >
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {message.brief && (
              <BriefEditor brief={message.brief} onConfirm={confirmBrief} confirming={confirming} />
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2.5" role="status" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-faint" aria-hidden />
            <span className="text-[13px] text-ink-muted">Lendo a memória da marca…</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                cancelled.current = true;
                setSending(false);
                setMessages((current) => current.slice(0, -1));
              }}
            >
              Cancelar
            </Button>
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-2">
            <InlineError>{error}</InlineError>
            {lastFailed && (
              <Button variant="outline" size="sm" onClick={() => void send(lastFailed)} className="self-start">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Tentar de novo
              </Button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="sticky bottom-0 mt-6 flex flex-col gap-3 rounded-[16px] border border-line-strong bg-card p-4"
      >
        <label htmlFor="mensagem" className="sr-only">
          Sua mensagem
        </label>
        <textarea
          id="mensagem"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          disabled={sending}
          placeholder="Descreva o que você quer testar…"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] text-ink-faint sm:inline">
            Enter envia · Shift + Enter quebra linha
          </span>
          <Button type="submit" size="md" disabled={!draft.trim() || sending} className="ml-auto">
            {sending ? "Pensando" : "Enviar"}
            {!sending && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </Button>
        </div>
      </form>

      <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-ink-faint">
        <Sparkles className="h-3 w-3" aria-hidden />
        Imagens só são geradas depois que você confirmar o briefing e escolher os caminhos.
      </p>
    </div>
  );
}
