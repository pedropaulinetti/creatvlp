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
