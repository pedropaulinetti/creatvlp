import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { Field, Textarea } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import {
  LIMITE_DE_CARACTERES,
  TIPOS_DE_FEEDBACK,
  useEnviarFeedback,
  type TipoDeFeedback,
} from "@/features/feedback/useEnviarFeedback";

const MINIMO = 3;

/**
 * Fica fixo em cima de tudo, em todas as telas do app. No celular ele sobe
 * acima da barra inferior para não cobrir a navegação.
 */
export function BotaoDeFeedback() {
  const [aberto, setAberto] = React.useState(false);
  const [tipo, setTipo] = React.useState<TipoDeFeedback>("sugestao");
  const [texto, setTexto] = React.useState("");
  const [erro, setErro] = React.useState("");
  const enviar = useEnviarFeedback();

  function fechar(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) {
      setTexto("");
      setTipo("sugestao");
      setErro("");
    }
  }

  function submeter(event: React.FormEvent) {
    event.preventDefault();
    const conteudo = texto.trim();
    if (conteudo.length < MINIMO) {
      setErro("Escreva pelo menos uma frase para a gente entender o pedido.");
      return;
    }
    setErro("");
    enviar.mutate(
      { kind: tipo, message: conteudo },
      {
        onSuccess: () => {
          toast.success("Recebemos. Obrigado por escrever.");
          fechar(false);
        },
        onError: () => setErro("Não conseguimos enviar agora. Tente de novo em instantes."),
      },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Enviar sugestão"
        className={cn(
          "fixed bottom-[74px] right-4 z-40 flex h-11 items-center gap-2 rounded-full bg-ink pl-3.5 pr-4",
          "text-[13px] font-medium text-surface shadow-pop transition-colors hover:bg-accent",
          "md:bottom-5 md:right-5",
        )}
      >
        <MessageSquarePlus className="h-[17px] w-[17px]" aria-hidden strokeWidth={1.7} />
        Sugestão
      </button>

      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent
          title="O que dá para melhorar?"
          description="Estamos em beta e lemos tudo. Conte o que faltou, o que atrapalhou ou o que você gostaria de ver aqui."
        >
          <form onSubmit={submeter} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo do recado">
              {TIPOS_DE_FEEDBACK.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={tipo === item.value}
                  onClick={() => setTipo(item.value)}
                  className={cn(
                    "h-[30px] rounded-full border px-3 text-[12.5px] transition-colors",
                    tipo === item.value
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-ink-2 hover:border-line-contrast",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Field label="Seu recado" htmlFor="feedback-mensagem">
              <Textarea
                id="feedback-mensagem"
                rows={6}
                autoFocus
                maxLength={LIMITE_DE_CARACTERES}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Ex: na tela de campanhas eu queria poder duplicar uma peça que deu certo."
              />
            </Field>

            <InlineError>{erro}</InlineError>

            <DialogFooter className="mt-0">
              <Button type="button" variant="quiet" size="md" onClick={() => fechar(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="md" loading={enviar.isPending}>
                Enviar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
