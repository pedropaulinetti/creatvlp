import * as React from "react";
import { Check, Trash2, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Hint, MonoLabel } from "@/components/ui/field";
import { nomeDaFamilia, nomePeloArquivo } from "@/lib/fonte";
import { useFonteRemota } from "@/features/brand/useFonteRemota";
import { cn } from "@/lib/utils";

export type FonteDaMarca = {
  /** Identificador estável: id da linha, ou o caminho no Storage no rascunho. */
  id: string;
  familia: string;
  /** Endereço assinado para carregar a fonte na tela. Ausente: sem prévia. */
  url?: string | null;
};

/** Os dois papéis que a peça usa. O resto do acervo fica guardado. */
export type PapelChave = "headline" | "body";

const ROTULO: Record<PapelChave, string> = { headline: "destaque", body: "texto" };

/**
 * O acervo de fontes da marca.
 *
 * Uma marca raramente tem uma fonte só — tem a do título, a do texto, e as
 * que sobraram de versões antigas da identidade. Guardar todas e marcar quais
 * valem agora é diferente de sobrescrever a anterior a cada envio, que era o
 * que acontecia.
 *
 * O que chega ao modelo continua sendo o NOME da família das duas marcadas:
 * ele desenha as letras, não renderiza arquivo. As demais ficam de acervo.
 */
export function ListaDeFontes({
  fontes,
  tipografia,
  aoMudarPapel,
  aoEnviar,
  aoRemover,
}: {
  fontes: FonteDaMarca[];
  tipografia: { headline: string; body: string };
  aoMudarPapel: (papel: PapelChave, familia: string) => void;
  aoEnviar: (arquivo: File, familia: string) => Promise<void>;
  aoRemover: (id: string) => void;
}) {
  const [lendo, setLendo] = React.useState(false);
  const carregadas = React.useRef(new Set<string>());
  const [, redesenhar] = React.useReducer((n: number) => n + 1, 0);

  /*
   * Cada fonte é registrada no navegador com um nome próprio, derivado do id.
   * Usar o nome da família criaria conflito com a fonte do sistema quando a
   * marca usa uma que já existe na máquina.
   */
  React.useEffect(() => {
    let vivo = true;
    for (const fonte of fontes) {
      if (!fonte.url || carregadas.current.has(fonte.id)) continue;
      carregadas.current.add(fonte.id);
      const face = new FontFace(`marca-${fonte.id}`, `url(${fonte.url})`);
      face
        .load()
        .then((pronta) => {
          if (!vivo) return;
          document.fonts.add(pronta);
          redesenhar();
        })
        .catch(() => {
          // Formato que o navegador não abre continua guardado, só sem prévia.
        });
    }
    return () => {
      vivo = false;
    };
  }, [fontes]);

  /**
   * Devolve a família da fonte enviada, para quem enviou marcar o papel.
   *
   * O nome de dentro do binário manda, quando dá para lê-lo. WOFF2 comprime a
   * tabela de nomes com Brotli, que o navegador não descomprime, e aí sobra o
   * palpite pelo nome do arquivo: "Kefir-Regular.woff2" vira "Kefir Regular".
   *
   * Quando o slot já tem família vinda do CSS do site, ela ganha do palpite.
   * O site diz "Kefir", e é esse nome que vai no prompt: o peso pendurado no
   * fim seria ruído numa linha que pede "tipografia próxima de X".
   */
  async function receber(arquivo: File, familiaAtual?: string): Promise<string> {
    setLendo(true);
    try {
      const lido = await nomeDaFamilia(arquivo);
      const escolhida = lido || familiaAtual?.trim() || nomePeloArquivo(arquivo.name);
      await aoEnviar(arquivo, escolhida);
      return escolhida;
    } finally {
      setLendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MonoLabel>Tipografia · {fontes.length}</MonoLabel>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-accent transition-opacity hover:opacity-80">
          <Type className="h-3.5 w-3.5" aria-hidden />
          {lendo ? "Lendo…" : "Enviar fonte"}
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="sr-only"
            disabled={lendo}
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              evento.target.value = "";
              if (arquivo) void receber(arquivo);
            }}
          />
        </label>
      </div>

      {fontes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {fontes.map((fonte) => {
            const papeis = (["headline", "body"] as PapelChave[]).filter(
              (papel) => tipografia[papel] === fonte.familia,
            );

            return (
              <div
                key={fonte.id}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] border px-3 py-2 transition-colors",
                  papeis.length ? "border-accent bg-accent-soft" : "border-line",
                )}
              >
                <span
                  className="min-w-0 flex-1 truncate text-[15px] text-ink"
                  style={{ fontFamily: `"marca-${fonte.id}", var(--font-sans)` }}
                >
                  {fonte.familia}
                </span>

                {(["headline", "body"] as PapelChave[]).map((papel) => {
                  const marcada = tipografia[papel] === fonte.familia;
                  return (
                    <Button
                      key={papel}
                      type="button"
                      size="sm"
                      variant={marcada ? "solid" : "quiet"}
                      aria-pressed={marcada}
                      onClick={() => aoMudarPapel(papel, marcada ? "" : fonte.familia)}
                    >
                      {ROTULO[papel]}
                    </Button>
                  );
                })}

                <Button
                  type="button"
                  variant="quiet"
                  size="iconLg"
                  aria-label={`Remover ${fonte.familia}`}
                  onClick={() => aoRemover(fonte.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/*
        A leitura já descobriu as duas famílias, então a tela mostra a letra e
        não pede para digitar o nome de novo. Quando a letra não é a dela de
        verdade, o que falta é o arquivo, e é o arquivo que o slot pede.
        Digitar o nome continua possível, em segundo plano, para o caso de a
        leitura ter errado a família e não haver arquivo nenhum à mão.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["headline", "body"] as PapelChave[]).map((papel) => (
          <Papel
            key={papel}
            papel={papel}
            familia={tipografia[papel]}
            arquivo={fontes.find((fonte) => fonte.familia === tipografia[papel])}
            lendo={lendo}
            aoMudar={(familia) => aoMudarPapel(papel, familia)}
            aoReceberArquivo={async (arquivo) =>
              aoMudarPapel(papel, await receber(arquivo, tipografia[papel]))
            }
          />
        ))}
      </div>

      <Hint>
        As duas acima são as que vão para a geração. O modelo recebe o nome da família e desenha
        as letras, não usa o arquivo. As demais ficam guardadas no kit da marca.
      </Hint>
    </div>
  );
}

/**
 * Uma das duas fontes que vão para a geração.
 *
 * O slot mostra a letra e diz de onde ela veio. Quando não há arquivo, o que
 * está na tela é uma aproximação: o Google Fonts tem a família homônima, ou
 * nem isso, e aí sobra a fonte do app. A saída para isso é o arquivo da marca,
 * então é ele que o slot pede, num clique, já marcando este papel.
 *
 * Digitar o nome ficou em segundo plano. Serve para quando a leitura errou a
 * família e não há arquivo à mão, que é o caso raro. O nome importa porque é
 * ele que vai no prompt: o modelo desenha as letras, não lê o binário.
 */
function Papel({
  papel,
  familia,
  arquivo,
  lendo,
  aoMudar,
  aoReceberArquivo,
}: {
  papel: PapelChave;
  familia: string;
  arquivo?: FonteDaMarca;
  lendo: boolean;
  aoMudar: (familia: string) => void;
  aoReceberArquivo: (arquivo: File) => Promise<void>;
}) {
  const [editando, setEditando] = React.useState(false);
  useFonteRemota(familia);

  // O arquivo da marca ganha do Google Fonts: é a letra dela, não a homônima.
  const temArquivo = Boolean(arquivo?.url);
  const pilha = temArquivo
    ? `"marca-${arquivo!.id}", "${familia}", var(--font-sans)`
    : `"${familia}", var(--font-sans)`;

  const vazia = !familia.trim();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <MonoLabel>Fonte de {ROTULO[papel]}</MonoLabel>
        <label className="ml-auto flex cursor-pointer items-center gap-1 text-[11.5px] text-accent transition-opacity hover:opacity-80">
          <Upload className="h-3 w-3" aria-hidden />
          {lendo ? "Lendo…" : temArquivo ? "trocar arquivo" : "enviar arquivo"}
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="sr-only"
            disabled={lendo}
            aria-label={`Enviar arquivo da fonte de ${ROTULO[papel]}`}
            onChange={(evento) => {
              const enviado = evento.target.files?.[0];
              evento.target.value = "";
              if (enviado) void aoReceberArquivo(enviado);
            }}
          />
        </label>
      </div>

      {vazia || editando ? (
        <Input
          autoFocus={editando}
          value={familia}
          placeholder={papel === "headline" ? "Instrument Serif" : "Inter"}
          aria-label={`Fonte de ${ROTULO[papel]}`}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={() => setEditando(false)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" || evento.key === "Escape") setEditando(false);
          }}
        />
      ) : (
        <>
          <div className="flex min-h-[58px] flex-col justify-center rounded-[10px] border border-line px-3 py-1.5">
            <span className="truncate text-[21px] leading-tight text-ink" style={{ fontFamily: pilha }}>
              {familia}
            </span>
            <span className="truncate text-[12px] leading-snug text-ink-muted" style={{ fontFamily: pilha }}>
              ABCDEFG abcdefg 0123456789
            </span>
          </div>

          <span className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
            {temArquivo ? (
              <>
                <Check className="h-3 w-3 text-positive" aria-hidden />
                arquivo da marca
              </>
            ) : (
              <>
                letra aproximada
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="text-accent transition-opacity hover:opacity-80"
                >
                  corrigir nome
                </button>
              </>
            )}
          </span>
        </>
      )}
    </div>
  );
}
