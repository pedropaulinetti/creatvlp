import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Composition = {
  template_key: string;
  format: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  price: string;
  /** Itens de lista: benefícios, sinais, números. Só alguns arquétipos usam. */
  bullets: string[];
  /** Enquete: a pergunta é o anúncio, e não há headline. */
  pergunta: string;
  opcoes: { texto: string; votos: number }[];
  /** Conversa: os balões, na ordem em que aparecem. */
  mensagens: { de: string; texto: string }[];
  show_logo: boolean;
  palette: { ink: string; surface: string; accent: string };
  /*
   * A tipografia da marca, lida do site no onboarding.
   *
   * Fica gravada na composição, e não só na marca, porque a peça precisa
   * continuar igual depois: mudar a fonte da marca amanhã não pode reescrever
   * um criativo que já foi aprovado e publicado.
   */
  typography: { headline: string; body: string };
  layout: Record<string, unknown>;
  scrim: number;
};

const DEFAULT_PALETTE = { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" };

/** Sem tipografia lida do site, a peça usa a do app. */
const DEFAULT_TYPOGRAPHY = { headline: "Inter", body: "Inter" };

export function typographyFromBrand(typography: unknown): { headline: string; body: string } {
  if (!typography || typeof typography !== "object") return DEFAULT_TYPOGRAPHY;
  const fontes = typography as { headline?: unknown; body?: unknown };
  const limpar = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
  const headline = limpar(fontes.headline);
  const body = limpar(fontes.body);
  // Uma só declarada serve para as duas: melhor a marca inteira numa fonte dela
  // do que metade dela e metade da nossa.
  return {
    headline: headline || body || DEFAULT_TYPOGRAPHY.headline,
    body: body || headline || DEFAULT_TYPOGRAPHY.body,
  };
}

export function paletteFromBrand(colors: unknown): { ink: string; surface: string; accent: string } {
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
    bullets?: string[];
    pergunta?: string;
    opcoes?: { texto: string; votos: number }[];
    mensagens?: { de: string; texto: string }[];
    brandColors: unknown;
    brandTypography?: unknown;
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
    bullets: (params.bullets ?? []).slice(0, 5),
    pergunta: params.pergunta ?? "",
    opcoes: (params.opcoes ?? []).slice(0, 3),
    mensagens: (params.mensagens ?? []).slice(0, 5),
    show_logo: true,
    palette: paletteFromBrand(params.brandColors),
    typography: typographyFromBrand(params.brandTypography),
    layout: (template?.layout as Record<string, unknown>) ?? {},
    scrim: 0.45,
  };
}

/**
 * A composição de uma peça desenhada pelo modelo.
 *
 * Não é mais o que se renderiza: a peça sai pronta da geração. Continua sendo
 * gravada porque é o registro do texto — é dela que sai o prompt quando alguém
 * edita a headline e manda desenhar de novo. Por isso não consulta a tabela de
 * templates: layout aqui não quer dizer nada.
 */
export function composicaoDaPeca(params: {
  templateKey: string;
  format: string;
  headline: string;
  subheadline?: string;
  body?: string;
  cta: string;
  price?: string;
  bullets?: string[];
  pergunta?: string;
  opcoes?: { texto: string; votos: number }[];
  mensagens?: { de: string; texto: string }[];
  brandColors: unknown;
  brandTypography?: unknown;
}): Composition {
  return {
    template_key: params.templateKey,
    format: params.format,
    headline: params.headline,
    subheadline: params.subheadline ?? "",
    body: params.body ?? "",
    cta: params.cta,
    price: params.price ?? "",
    bullets: (params.bullets ?? []).slice(0, 5),
    pergunta: params.pergunta ?? "",
    opcoes: (params.opcoes ?? []).slice(0, 3),
    mensagens: (params.mensagens ?? []).slice(0, 5),
    show_logo: true,
    palette: paletteFromBrand(params.brandColors),
    typography: typographyFromBrand(params.brandTypography),
    layout: {},
    scrim: 0.45,
  };
}
