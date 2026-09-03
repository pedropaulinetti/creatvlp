import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[14px] border border-line-strong bg-card", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center gap-3 border-b border-line-soft px-5 py-3.5", className)}>{children}</div>;
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "accent" | "positive" | "warning" | "danger" | "muted";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line text-ink-2 bg-transparent",
    muted: "border-transparent bg-sunken text-ink-muted",
    accent: "border-transparent bg-accent-soft text-accent-ink",
    positive: "border-transparent bg-positive-soft text-positive",
    warning: "border-transparent bg-warning-soft text-warning",
    danger: "border-transparent bg-danger-soft text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "accent", className }: { tone?: "accent" | "positive" | "muted" | "danger"; className?: string }) {
  const tones = {
    accent: "bg-accent",
    positive: "bg-positive",
    muted: "bg-line-contrast",
    danger: "bg-danger",
  } as const;
  return <span aria-hidden className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tones[tone], className)} />;
}

export function Divider({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  return vertical ? (
    <span aria-hidden className={cn("inline-block h-4 w-px bg-line", className)} />
  ) : (
    <hr className={cn("border-0 border-t border-line-soft", className)} />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[8px] bg-sunken", className)} />;
}
