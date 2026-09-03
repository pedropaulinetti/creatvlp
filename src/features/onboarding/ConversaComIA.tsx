import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint, MonoLabel, Textarea } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { cn } from "@/lib/utils";
import type { Draft } from "./tipos";

type Turno = { role: "user" | "assistant"; content: string };

type Resposta = {
  analysis: {
    name: string; description: string; segment: string; voice_tone: string;
    products: { name: string; description: string }[];
    audience: string; differentiators: string[]; confidence: string;
  };
  question: string;
  complete: boolean;
};

const ABERTURA =
  "Me conta da sua marca: o nome, o que ela vende e para quem. Pode escrever do seu jeito.";

/**
 * O caminho de quem não tem site — ou cujo site não deu leitura.
 *
 * A alternativa era um formulário de oito etapas. Aqui a pessoa escreve um
 * parágrafo do jeito dela e a IA pergunta, uma coisa por vez, só o que ainda
 * falta. Termina no mesmo cartão de confirmação do caminho do site.
 */
export function ConversaComIA({
  workspaceId,
  aplicar,
  aoConcluir,
  aoVoltar,
}: {
  workspaceId: string | null;
  aplicar: (valores: Partial<Draft>) => void;
  aoConcluir: () => void;
  aoVoltar: () => void;
}) {
  const [turnos, setTurnos] = React.useState<Turno[]>([{ role: "assistant", content: ABERTURA }]);
  const [texto, setTexto] = React.useState("");
  const [pensando, setPensando] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const fim = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [turnos, pensando]);

  async function responder() {
    const dito = texto.trim();
    if (!dito || !workspaceId || pensando) return;

    const conversa: Turno[] = [...turnos, { role: "user", content: dito }];
    setTurnos(conversa);
    setTexto("");
    setPensando(true);
    setErro("");

    try {
      const resposta = await callFunction<Resposta>("interpret-brand", {
        workspace_id: workspaceId,
        // A abertura é nossa, não da pessoa: o modelo não precisa dela.
        messages: conversa.slice(1).map(({ role, content }) => ({ role, content })),
      });

      const { analysis } = resposta;
      aplicar({
        company: analysis.name,
        description: analysis.description,
        segment: analysis.segment,
        voiceTone: analysis.voice_tone,
        audience: analysis.audience,
        products: analysis.products.length ? analysis.products : [],
      });

      if (resposta.complete) {
        aoConcluir();
        return;
      }

      setTurnos([...conversa, { role: "assistant", content: resposta.question || ABERTURA }]);
    } catch (falha) {
      setErro(functionErrorMessage(falha));
      setTurnos(conversa);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <MonoLabel className="text-accent">Sem site, sem problema</MonoLabel>
        <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[36px]">
          Então me conta você.
        </h1>
        <Hint>Escreva do seu jeito. Eu pergunto o que faltar — uma coisa de cada vez.</Hint>
      </header>

      <div className="flex flex-col gap-3" aria-live="polite">
        {turnos.map((turno, index) => (
          <p
            key={index}
            className={cn(
              "surgir max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[14px] leading-relaxed",
              turno.role === "assistant"
                ? "self-start border border-line bg-surface text-ink"
                : "self-end bg-ink text-surface",
            )}
          >
            {turno.content}
          </p>
        ))}
        {pensando && (
          <span className="surgir flex items-center gap-2 self-start text-[12.5px] text-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            anotando
          </span>
        )}
        <div ref={fim} />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          void responder();
        }}
      >
        <Textarea
          autoFocus
          rows={3}
          className="min-h-[84px]"
          aria-label="Sua resposta"
          value={texto}
          disabled={pensando}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter envia; Shift+Enter quebra linha. É o gesto que se espera de um chat.
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              void responder();
            }
          }}
          placeholder="Ex.: Minas Estate Coffee, café especial de fazenda em Minas, vendido para quem faz café em casa."
        />

        <InlineError>{erro}</InlineError>

        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" className="px-0" onClick={aoVoltar}>
            Tenho um site, quero colar o endereço
          </Button>
          <Button type="submit" className="ml-auto" loading={pensando} disabled={!texto.trim()}>
            {!pensando && <ArrowRight className="h-4 w-4" aria-hidden />}
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
