import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

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
  layout: Record<string, unknown>;
  scrim: number;
};

const DEFAULT_PALETTE = { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" };

function paletteFromBrand(colors: unknown): { ink: string; surface: string; accent: string } {
  if (!Array.isArray(colors)) return DEFAULT_PALETTE;
  const find = (role: string) =>
    colors.find(
      (item): item is { hex: string; role?: string } =>
        typeof item === "object" && item !== null && "hex" in item && (item as { role?: string }).role === role,
    )?.hex;
  return {
    ink: find("texto") ?? DEFAULT_PALETTE.ink,
    surface: find("fundo") ?? DEFAULT_PALETTE.surface,
    accent: find("primaria") ?? find("secundaria") ?? DEFAULT_PALETTE.accent,
  };
}

/**
 * Monta a composição determinística: texto, logo, preço e CTA são do CreatvOS,
 * nunca da imagem gerada. Guardada como JSON editável.
 */
export async function buildComposition(
  admin: SupabaseClient,
  params: {
    templateKey: string;
    format: string;
    headline: string;
    subheadline?: string;
    body?: string;
    cta: string;
    price?: string;
    brandColors: unknown;
  },
): Promise<Composition> {
  const { data: template } = await admin
    .from("templates")
    .select("key, layout")
    .eq("key", params.templateKey)
    .is("workspace_id", null)
    .maybeSingle();

  return {
    template_key: template?.key ?? "produto-destaque",
    format: params.format,
    headline: params.headline,
    subheadline: params.subheadline ?? "",
    body: params.body ?? "",
    cta: params.cta,
    price: params.price ?? "",
    show_logo: true,
    palette: paletteFromBrand(params.brandColors),
    layout: (template?.layout as Record<string, unknown>) ?? {},
    scrim: 0.45,
  };
}
