import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * O campo do código de confirmação.
 *
 * Seis caixas em vez de um input só: a pessoa vê quantos dígitos faltam sem
 * contar caracteres, e errar um dígito não obriga a reescrever tudo.
 *
 * O texto do código chega por e-mail, então colar é o caminho mais comum — e é
 * por isso que qualquer caixa aceita a colagem inteira, não só a primeira.
 */
export function CampoDeCodigo({
  valor,
  aoMudar,
  aoCompletar,
  desabilitado = false,
  invalido = false,
  tamanho = 6,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  /** Disparado quando o último dígito entra: evita um botão a mais. */
  aoCompletar?: (valor: string) => void;
  desabilitado?: boolean;
  invalido?: boolean;
  tamanho?: number;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digitos = valor.split("");

  const escrever = (proximo: string, focarEm: number) => {
    const limpo = proximo.replace(/\D/g, "").slice(0, tamanho);
    aoMudar(limpo);
    refs.current[Math.min(focarEm, tamanho - 1)]?.focus();
    if (limpo.length === tamanho) aoCompletar?.(limpo);
  };

  return (
    <div
      className="flex gap-2"
      role="group"
      aria-label={`Código de ${tamanho} dígitos`}
      onPaste={(evento) => {
        // Colar em qualquer caixa preenche o código inteiro.
        evento.preventDefault();
        const colado = evento.clipboardData.getData("text").replace(/\D/g, "");
        if (colado) escrever(colado, colado.length);
      }}
    >
      {Array.from({ length: tamanho }, (_, indice) => (
        <input
          key={indice}
          ref={(elemento) => {
            refs.current[indice] = elemento;
          }}
          // `text` com inputMode numérico: `number` traz setinhas e aceita sinal.
          type="text"
          inputMode="numeric"
          autoComplete={indice === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={desabilitado}
          aria-label={`Dígito ${indice + 1}`}
          aria-invalid={invalido || undefined}
          value={digitos[indice] ?? ""}
          onChange={(evento) => {
            const entrada = evento.target.value.replace(/\D/g, "");
            if (!entrada) return;
            const atual = valor.split("");
            atual[indice] = entrada[entrada.length - 1];
            escrever(atual.join("").slice(0, tamanho), indice + 1);
          }}
          onKeyDown={(evento) => {
            if (evento.key === "Backspace") {
              evento.preventDefault();
              // Caixa vazia: apaga a anterior, que é o que a pessoa quer dizer.
              const alvo = digitos[indice] ? indice : Math.max(0, indice - 1);
              const atual = valor.split("");
              atual.splice(alvo, 1);
              escrever(atual.join(""), alvo);
            }
            if (evento.key === "ArrowLeft") refs.current[Math.max(0, indice - 1)]?.focus();
            if (evento.key === "ArrowRight") refs.current[Math.min(tamanho - 1, indice + 1)]?.focus();
          }}
          className={cn(
            "h-13 w-11 rounded-[10px] border bg-surface text-center font-mono text-[20px] text-ink transition-colors",
            "focus:border-accent focus:outline-none disabled:opacity-60",
            invalido ? "border-danger" : "border-line-strong",
          )}
        />
      ))}
    </div>
  );
}

/**
 * A contagem para reenviar.
 *
 * Sem espera, quem não recebe o e-mail clica em reenviar várias vezes seguidas
 * e esbarra no limite de envio — e aí nem o primeiro código chega.
 */
export function useEsperaParaReenviar(segundos = 45) {
  const [restam, setRestam] = React.useState(segundos);

  React.useEffect(() => {
    if (restam <= 0) return;
    const relogio = setTimeout(() => setRestam((atual) => atual - 1), 1000);
    return () => clearTimeout(relogio);
  }, [restam]);

  return { restam, reiniciar: () => setRestam(segundos) };
}
