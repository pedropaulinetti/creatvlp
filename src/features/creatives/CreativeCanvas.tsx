import * as React from "react";
import { type Format } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { ARQUETIPOS } from "./arquetipos";
import {
  DEFAULT_LAYOUT,
  medidas,
  useFonteDaMarca,
  pilhaDeFonte,
  type Composition,
  type Palco,
} from "./composicao";

export { DEFAULT_LAYOUT, emptyComposition, type Composition } from "./composicao";

/**
 * Renderiza a composição em tamanho real (1080px de largura) e reduz por
 * transform. O nó interno é o que vai para a exportação — o que se vê na tela
 * é exatamente o que sai no PNG.
 *
 * O desenho em si mora em `arquetipos.tsx`: aqui fica só o palco e a escolha de
 * quem desenha. Cada arquétipo é uma forma diferente de anunciar, não a mesma
 * coluna de texto em outra altura.
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
  useFonteDaMarca(composition.typography);

  const { size, px } = medidas(format);
  const scale = displayWidth / size.width;
  const layout: Record<string, any> = { ...DEFAULT_LAYOUT, ...(composition.layout ?? {}) };

  const palco: Palco = { composition, layout, px, size, imageUrl, logoUrl };
  const Arquetipo = ARQUETIPOS[String(layout.arquetipo ?? "coluna")] ?? ARQUETIPOS.coluna;

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
          fontFamily: pilhaDeFonte(composition.typography?.body),
        }}
      >
        <Arquetipo palco={palco} />
      </div>
    </div>
  );
});
