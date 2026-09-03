import * as React from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Carregando" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 text-ink-muted", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = "Carregando", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-ink-faint" aria-hidden />
      <p role="status" aria-live="polite" className="text-[13px] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken">
          <Icon className="h-4.5 w-4.5 text-ink-faint" aria-hidden />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {description && <p className="max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Não conseguimos carregar",
  description,
  onRetry,
  retryLabel = "Tentar de novo",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[14px] border border-danger/25 bg-danger-soft/50 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {description && <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** Mensagem de erro inline para formulários e ações. */
export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function Notice({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-sunken text-ink-2",
    accent: "border-accent/25 bg-accent-soft text-accent-ink",
    warning: "border-warning/30 bg-warning-soft text-ink-2",
  } as const;
  return (
    <div className={cn("rounded-[10px] border px-3.5 py-3 text-[12.5px] leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}
