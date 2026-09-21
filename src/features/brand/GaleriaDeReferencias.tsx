import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Hint, MonoLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type ReferenciaVisual = {
  /** Id da linha, ou o caminho no Storage enquanto o rascunho não foi gravado. */
  id: string;
  url: string | null;
};

/**
 * Quantas entram em CADA peça.
 *
 * O provedor aceita quatro anexos e a foto do produto leva um, então sobram
 * três por chamada. Não é quantas da marca são usadas: desde a rotação, o
 * acervo inteiro entra, três de cada vez, girando peça a peça.
 */
export const QUANTAS_POR_PECA = 3;

const FORMATOS = "image/png,image/jpeg,image/webp,image/avif";

/**
 * As imagens que ensinam o modelo a fotografar como a marca.
 *
 * Diferente da logo, estas chegam na geração de verdade: entram anexadas ao
 * pedido e definem luz, paleta e clima da cena. São também o item mais fácil
 * de estragar sem perceber — uma foto de banner promocional ali dentro puxa
 * toda a campanha para o visual errado.
 *
 * As três primeiras eram marcadas como "usadas" porque a geração levava só
 * elas, sempre. Desde que a janela passou a girar por peça, todas entram: a
 * ideia 1 usa as três primeiras, a ideia 2 as três seguintes, e assim por
 * diante. A tela dizia que nove das doze não serviam para nada, o que fazia
 * quem cuidava da marca parar de enviar.
 */
export function GaleriaDeReferencias({
  referencias,
  aoEnviar,
  aoRemover,
  aoTornarPrincipal,
  maximo = 12,
}: {
  referencias: ReferenciaVisual[];
  aoEnviar: (arquivos: File[]) => Promise<void>;
  aoRemover: (id: string) => void;
  aoTornarPrincipal: (id: string) => void;
  maximo?: number;
}) {
  const [enviando, setEnviando] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <MonoLabel>
        Referências visuais · {referencias.length}
        {referencias.length > QUANTAS_POR_PECA && ` · ${QUANTAS_POR_PECA} por peça, girando`}
      </MonoLabel>

      <div className="flex flex-wrap gap-2">
        {referencias.map((referencia, indice) => {
          // A primeira peça começa por estas; as demais seguem girando.
          const naPrimeiraPeca = indice < QUANTAS_POR_PECA;
          return (
            <div key={referencia.id} className="group relative">
              <div
                className={cn(
                  "h-20 w-20 overflow-hidden rounded-[8px] border transition-colors",
                  naPrimeiraPeca ? "border-accent" : "border-line",
                )}
              >
                {referencia.url && (
                  <img
                    src={referencia.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(evento) => {
                      evento.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </div>

              {naPrimeiraPeca && (
                <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-surface">
                  1ª peça
                </span>
              )}

              <button
                type="button"
                aria-label={`Remover referência ${indice + 1}`}
                onClick={() => aoRemover(referencia.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-ink-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>

              {!naPrimeiraPeca && (
                <button
                  type="button"
                  onClick={() => aoTornarPrincipal(referencia.id)}
                  className="absolute inset-x-0 bottom-0 rounded-b-[8px] bg-ink/70 py-0.5 text-[10px] text-surface opacity-0 transition-opacity group-hover:opacity-100"
                >
                  pôr na frente
                </button>
              )}
            </div>
          );
        })}

        {referencias.length < maximo && (
          <label
            className={cn(
              "flex h-20 w-20 cursor-pointer items-center justify-center rounded-[8px] border border-dashed border-line-contrast text-ink-faint transition-colors hover:border-accent hover:text-ink",
              enviando && "opacity-60",
            )}
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            <input
              type="file"
              accept={FORMATOS}
              // Várias de uma vez: ninguém escolhe referência de uma em uma.
              multiple
              className="sr-only"
              disabled={enviando}
              onChange={async (evento) => {
                const arquivos = [...(evento.target.files ?? [])];
                evento.target.value = "";
                if (!arquivos.length) return;
                setEnviando(true);
                await aoEnviar(arquivos.slice(0, maximo - referencias.length));
                setEnviando(false);
              }}
            />
          </label>
        )}
      </div>

      <Hint>
        {enviando
          ? "Enviando…"
          : `Fotos de como a marca fotografa: produto, ambiente, pessoas. Todas entram, ${QUANTAS_POR_PECA} por peça, girando. Quanto mais variedade de luz e clima, menos as peças se parecem. Até ${maximo}.`}
      </Hint>
    </div>
  );
}
