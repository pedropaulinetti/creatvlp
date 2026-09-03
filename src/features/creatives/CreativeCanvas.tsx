import * as React from "react";
import { FORMAT_SIZE, type Format } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type Composition = {
  template_key: string;
  format: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  price: string;
  show_logo: boolean;
  palette: { ink: string; surface: string; accent: string };
  layout: Record<string, any>;
  scrim: number;
};

export const DEFAULT_LAYOUT = {
  headline: { x: 6, y: 62, size: 7.5, weight: 600, align: "left" },
  sub: { x: 6, y: 74, size: 3.6 },
  cta: { x: 6, y: 86, style: "solid" },
  logo: { x: 6, y: 6, size: 8 },
  scrim: "bottom",
};

/**
 * Onde o bloco de texto encosta. Deriva da altura que o template pedia para a
 * headline: em cima, no meio ou embaixo — mas agora o bloco cresce sem invadir
 * o que vem depois.
 */
function anchorStyle(layout: Record<string, any>, px: (percent: number) => number) {
  const y = Number(layout.headline?.y ?? 62);
  const margem = px(8);
  if (y < 35) return { top: margem };
  if (y > 55) return { bottom: margem };
  return { top: "50%", transform: "translateY(-50%)" };
}

export function emptyComposition(format: Format = "4:5"): Composition {
  return {
    template_key: "produto-destaque",
    format,
    headline: "",
    subheadline: "",
    body: "",
    cta: "",
    price: "",
    show_logo: true,
    palette: { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" },
    layout: DEFAULT_LAYOUT,
    scrim: 0.45,
  };
}

function scrimGradient(kind: string, strength: number): string {
  const alpha = Math.min(0.85, Math.max(0, strength));
  switch (kind) {
    case "full":
      return `linear-gradient(0deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${alpha * 0.7}) 100%)`;
    case "left":
      return `linear-gradient(90deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,0) 70%)`;
    case "bottom-soft":
      return `linear-gradient(0deg, rgba(0,0,0,${alpha * 0.6}) 0%, rgba(0,0,0,0) 45%)`;
    case "none":
      return "none";
    default:
      return `linear-gradient(0deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${alpha * 0.5}) 30%, rgba(0,0,0,0) 62%)`;
  }
}

/**
 * Renderiza a composição em tamanho real (1080px de largura) e reduz por
 * transform. O nó interno é o que vai para a exportação — o que se vê na tela
 * é exatamente o que sai no PNG.
 */
export const CreativeCanvas = React.forwardRef<
  HTMLDivElement,
  {
    imageUrl: string | null;
    logoUrl?: string | null;
    composition: Composition;
    format: Format;
    displayWidth?: number;
    className?: string;
  }
>(function CreativeCanvas(
  { imageUrl, logoUrl, composition, format, displayWidth = 320, className },
  ref,
) {
  const size = FORMAT_SIZE[format] ?? FORMAT_SIZE["4:5"];
  const scale = displayWidth / size.width;
  const layout: Record<string, any> = { ...DEFAULT_LAYOUT, ...(composition.layout ?? {}) };

  /** Tamanhos vêm em % da largura — viram px no tamanho real. */
  const px = (percent: number) => (size.width * percent) / 100;
  const onLight = layout.scrim === "none";
  const textColor = onLight ? composition.palette.ink : "#FFFFFF";

  return (
    <div
      className={cn("relative overflow-hidden rounded-[10px] bg-sunken", className)}
      style={{ width: displayWidth, height: size.height * scale }}
    >
      <div
        ref={ref}
        style={{
          width: size.width,
          height: size.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          background: composition.palette.surface,
          overflow: "hidden",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(-45deg, #F0ECE4 0 24px, #F4F1EA 24px 48px)",
            }}
          />
        )}

        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: scrimGradient(String(layout.scrim ?? "bottom"), composition.scrim),
          }}
        />

        {composition.show_logo && logoUrl && (
          <img
            src={logoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              left: px(layout.logo?.x ?? 6),
              top: px(layout.logo?.y ?? 6),
              height: px(layout.logo?.size ?? 8) / 2.4,
              width: "auto",
              filter: onLight ? "none" : "brightness(0) invert(1)",
            }}
          />
        )}

        {/*
          O bloco de texto flui numa coluna ancorada, em vez de cada elemento
          ter uma altura fixa. Com altura fixa, uma headline de três linhas
          invadia a subheadline — e o texto é justamente o que o CreatvOS
          controla, então não pode quebrar.
        */}
        <div
          style={{
            position: "absolute",
            left: px(layout.headline?.x ?? 6),
            right: px(layout.headline?.x ?? 6),
            ...anchorStyle(layout, px),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
            alignItems:
              (layout.headline?.align ?? "left") === "center"
                ? "center"
                : (layout.headline?.align ?? "left") === "right"
                  ? "flex-end"
                  : "flex-start",
            textAlign: (layout.headline?.align ?? "left") as "left" | "center" | "right",
          }}
        >
          {composition.headline && (
            <div
              style={{
                color: textColor,
                fontSize: px(layout.headline?.size ?? 7.5),
                fontWeight: layout.headline?.weight ?? 600,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                textWrap: "balance",
              }}
            >
              {layout.headline?.quote ? `“${composition.headline}”` : composition.headline}
            </div>
          )}

          {composition.subheadline && (
            <div
              style={{
                color: textColor,
                opacity: 0.92,
                fontSize: px(layout.sub?.size ?? 3.6),
                fontWeight: 400,
                lineHeight: 1.35,
              }}
            >
              {composition.subheadline}
            </div>
          )}

          {composition.price && (
            <div
              style={{
                color: composition.palette.accent,
                fontSize: px(layout.price?.size ?? 9),
                fontWeight: layout.price?.weight ?? 700,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {composition.price}
            </div>
          )}

          {composition.cta && (
            <div
              style={{
                marginTop: px(1.2),
                width: layout.cta?.full ? "100%" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: layout.cta?.style === "link" ? 0 : `${px(1.6)}px ${px(3.4)}px`,
                borderRadius: px(1.2),
                background: layout.cta?.style === "solid" ? composition.palette.accent : "transparent",
                border: layout.cta?.style === "outline" ? `${px(0.28)}px solid ${textColor}` : "none",
                color: layout.cta?.style === "solid" ? "#FFFFFF" : textColor,
                fontSize: px(3.3),
                fontWeight: 500,
                lineHeight: 1.2,
                textDecoration: layout.cta?.style === "link" ? "underline" : "none",
                textUnderlineOffset: px(0.6),
              }}
            >
              {composition.cta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
