import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Os papéis que a composição entende.
 *
 * Papel errado vira peça com cor trocada: é ele que decide qual cor pinta o
 * fundo, qual pinta o texto e qual vira o acento do CTA. A leitura do site
 * adivinha, e adivinhação precisa de conserto à mão.
 */
export const PAPEIS_DA_COR = ["primaria", "secundaria", "apoio", "fundo", "texto"] as const;

export type CorDaMarca = { hex: string; role: string; label: string };

/**
 * Uma cor da paleta, com o papel editável.
 *
 * Vivia só no onboarding. Em Minha Marca o papel era uma etiqueta morta: a
 * pessoa via "apoio" numa cor que era a primária da marca dela e não tinha
 * como corrigir, nem apagando e recriando, porque cor nova nasce como "apoio".
 * O mesmo componente agora serve as duas telas.
 */
export function CorDaPaleta({
  cor,
  aoMudar,
  aoRemover,
  atraso,
  className,
}: {
  cor: CorDaMarca;
  aoMudar: (valores: Partial<CorDaMarca>) => void;
  aoRemover: () => void;
  /** Só o onboarding anima a entrada, uma cor de cada vez. */
  atraso?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1.5 pr-1.5",
        atraso !== undefined && "cair",
        className,
      )}
      style={atraso !== undefined ? { animationDelay: `${atraso}ms` } : undefined}
    >
      <label className="cursor-pointer" title="Trocar a cor">
        <span
          aria-hidden
          className="block h-4 w-4 rounded-full border border-line"
          style={{ background: cor.hex }}
        />
        <input
          type="color"
          value={cor.hex}
          aria-label={`Cor ${cor.hex}`}
          className="sr-only"
          onChange={(evento) => aoMudar({ hex: evento.target.value.toUpperCase() })}
        />
      </label>

      <span className="font-mono text-[11px] uppercase text-ink-2">{cor.hex}</span>

      <select
        value={(PAPEIS_DA_COR as readonly string[]).includes(cor.role) ? cor.role : "apoio"}
        aria-label={`Papel de ${cor.hex}`}
        onChange={(evento) => aoMudar({ role: evento.target.value })}
        className="cursor-pointer rounded-full bg-transparent py-0.5 text-[10.5px] text-ink-faint focus:outline-none"
      >
        {PAPEIS_DA_COR.map((papel) => (
          <option key={papel} value={papel}>
            {papel}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-label={`Remover ${cor.hex}`}
        onClick={aoRemover}
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}
