import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton, Dot, Divider } from "@/components/ui/surface";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useHomeSignals } from "@/features/campaigns/queries";
import { cn, greeting } from "@/lib/utils";
import { available } from "@/lib/quotas";

const SUGGESTIONS = [
  "Repetir o ângulo vencedor",
  "Stories para os produtos em promoção",
  "Testar prova social",
];

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function HomePage() {
  const { profile } = useAuth();
  const { brand, quota, plan } = useWorkspace();
  const { data, isLoading } = useHomeSignals();
  const navigate = useNavigate();
  const [message, setMessage] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const firstName = profile?.full_name?.trim().split(" ")[0] ?? "";

  const start = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    navigate("/app/campanhas/nova", { state: { message: clean } });
  };

  const imagesLeft = quota && plan ? available(quota, plan, "imagem") : null;

  const routineLabel = (() => {
    const routine = data?.nextRoutine;
    if (!routine?.next_run_at) return null;
    const date = new Date(routine.next_run_at);
    const weekday = WEEKDAYS[date.getDay()];
    return `Rotina de ${weekday}, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  })();

  return (
    <div className="flex min-h-full flex-col">
      {/* Centro: quase nada na tela — só o pedido */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-10 md:px-10 md:pb-[60px] md:pt-0">
        <div className="flex w-full max-w-[640px] flex-col gap-7 md:items-center md:gap-[34px]">
          <div className="flex flex-col gap-2.5 md:items-center md:gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent md:text-[11px]">
              {greeting()}
              {firstName && `, ${firstName}`}
            </span>
            <h1 className="text-[31px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-center md:text-[44px] md:leading-[1.08] md:tracking-[-0.035em]">
              O que você quer criar hoje?
            </h1>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              start(message);
            }}
            className="flex w-full flex-col gap-3.5 rounded-[15px] border border-line-strong bg-card p-[15px] md:gap-3.5 md:rounded-[16px] md:p-[18px] md:pb-3"
          >
            <label htmlFor="pedido" className="sr-only">
              Descreva a campanha que você quer criar
            </label>
            <textarea
              id="pedido"
              ref={textareaRef}
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  start(message);
                }
              }}
              placeholder={
                brand
                  ? `Quero uma campanha para divulgar ${brand.name} no Dia dos Pais…`
                  : "Quero uma campanha para o Dia dos Pais…"
              }
              className="w-full resize-none bg-transparent text-[15.5px] leading-[1.4] text-ink placeholder:text-ink-faint focus:outline-none md:text-[17px] md:leading-[1.45]"
            />

            <div className="flex items-center gap-2 md:gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="iconLg"
                aria-label="Anexar referência"
                onClick={() => navigate("/app/marca")}
                className="md:border-0 md:hover:bg-sunken"
              >
                <Paperclip className="h-[15px] w-[15px]" aria-hidden strokeWidth={1.8} />
              </Button>
              <span className="hidden text-[12.5px] text-ink-faint md:inline">
                Sua marca já entra no contexto.
              </span>
              <Button type="submit" disabled={!message.trim()} className="ml-auto max-md:h-[46px] max-md:flex-1">
                Criar campanha
                <ArrowRight className="h-3.5 w-3.5" aria-hidden strokeWidth={2.1} />
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="chip"
                size="sm"
                onClick={() => {
                  setMessage(suggestion);
                  textareaRef.current?.focus();
                }}
                className="max-md:h-[34px] max-md:justify-start max-md:px-3.5"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Rodapé: o mínimo que exige atenção */}
      <footer className="border-t border-line-soft px-5 py-3.5 md:px-6 md:py-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="hidden h-4 w-40 md:block" />
          </div>
        ) : (
          <nav
            aria-label="Precisa de atenção"
            className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-center md:gap-[26px]"
          >
            <FooterLink
              onClick={() => navigate("/app/biblioteca?status=revisao")}
              highlight={Boolean(data?.awaitingApproval)}
              disabled={!data?.awaitingApproval}
            >
              {data?.awaitingApproval ? (
                <>
                  <Dot />
                  {data.awaitingApproval} {data.awaitingApproval === 1 ? "criativo aguardando" : "criativos aguardando"} aprovação
                </>
              ) : (
                "Nenhum criativo aguardando aprovação"
              )}
            </FooterLink>

            {data?.producing?.length ? (
              <>
                <Divider vertical className="hidden md:block" />
                <FooterLink onClick={() => navigate(`/app/campanhas/${data.producing[0].id}`)}>
                  {data.producing[0].name}
                  {data.producing.length > 1 && ` · +${data.producing.length - 1} em produção`}
                </FooterLink>
              </>
            ) : null}

            {routineLabel && (
              <>
                <Divider vertical className="hidden md:block" />
                <FooterLink onClick={() => navigate("/app/rotinas")}>{routineLabel}</FooterLink>
              </>
            )}

            {data?.nextTest && (
              <>
                <Divider vertical className="hidden md:block" />
                <FooterLink onClick={() => setMessage(data.nextTest!.statement)}>
                  Próximo teste sugerido
                </FooterLink>
              </>
            )}

            {imagesLeft !== null && (
              <>
                <Divider vertical className="hidden md:block" />
                <FooterLink onClick={() => navigate("/app/configuracoes")}>
                  {imagesLeft > 0 ? `${imagesLeft} imagens no ciclo` : "Limite de imagens atingido"}
                </FooterLink>
              </>
            )}
          </nav>
        )}
      </footer>
    </div>
  );
}

function FooterLink({
  children,
  onClick,
  highlight = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-[6px] text-left text-[13px] transition-colors",
        highlight ? "text-ink" : "text-ink-muted",
        disabled ? "cursor-default" : "hover:text-accent",
      )}
    >
      {children}
    </button>
  );
}
