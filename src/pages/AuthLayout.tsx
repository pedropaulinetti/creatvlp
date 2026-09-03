import * as React from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

/**
 * Mesa de trabalho em duas colunas: à esquerda o contexto editorial,
 * à direita a ação. No mobile vira uma coluna só.
 */
export function AuthLayout({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <section className="flex flex-col justify-between gap-10 px-6 py-8 lg:w-[46%] lg:px-14 lg:py-12">
        <Link to="/" aria-label="CreatvOS, voltar ao site">
          <Logo height={18} />
        </Link>

        <div className="flex max-w-[30ch] flex-col gap-5">
          <span className="label-mono text-accent">{eyebrow}</span>
          <h1 className="text-[34px] font-normal leading-[1.08] tracking-[-0.035em] text-ink lg:text-[44px]">
            {title}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">{lede}</p>
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          <span className="label-mono">Produto</span>
          <span aria-hidden className="h-px w-6 bg-line-contrast" />
          <span className="label-mono">Ângulos</span>
          <span aria-hidden className="h-px w-6 bg-line-contrast" />
          <span className="label-mono">Criativos</span>
          <span aria-hidden className="h-px w-6 bg-line-contrast" />
          <span className="label-mono text-accent">Resultado</span>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-14">
        <div className="w-full max-w-[400px] rounded-[16px] border border-line-strong bg-surface p-6 lg:p-8">
          {children}
          {footer && <div className="mt-6 border-t border-line-soft pt-5 text-[13px] text-ink-muted">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
