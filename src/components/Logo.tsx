import logoInk from "@/assets/logo-ink.svg?url";
import { cn } from "@/lib/utils";

export function Logo({ className, height = 18 }: { className?: string; height?: number }) {
  return <img src={logoInk} alt="CreatvOS" style={{ height }} className={cn("block w-auto", className)} />;
}
