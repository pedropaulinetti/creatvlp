import logoInk from "@/assets/logo-ink.svg?url";
import logoMark from "@/assets/logo-mark.svg?url";
import { cn } from "@/lib/utils";

export function Logo({ className, height = 18 }: { className?: string; height?: number }) {
  return <img src={logoInk} alt="CreatvOS" style={{ height }} className={cn("block w-auto", className)} />;
}

/** Só o símbolo, na mesma altura/proporção do logo completo — para espaços estreitos. */
export function LogoMark({ className, height = 18 }: { className?: string; height?: number }) {
  return <img src={logoMark} alt="CreatvOS" style={{ height }} className={cn("block w-auto", className)} />;
}

/** Selo da fase atual do produto. Anda colado no logo. */
export function BetaTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] border border-line px-1.5 py-[1px] font-mono",
        "text-[9.5px] uppercase leading-[14px] tracking-[0.08em] text-ink-faint",
        className,
      )}
    >
      Beta
    </span>
  );
}
