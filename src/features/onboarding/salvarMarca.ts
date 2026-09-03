import { requireSupabase } from "@/lib/supabase";
import { completeness } from "./rascunho";
import type { Draft } from "./tipos";

/**
 * Grava a marca inteira: é aqui, e só aqui, que o rascunho vira dado.
 *
 * A ordem importa. A marca vem primeiro porque produtos, público e arquivos
 * apontam para ela; o perfil é marcado como concluído por último, para que
 * uma falha no meio deixe a pessoa no onboarding em vez de num app vazio.
 */
export async function salvarMarca({
  draft,
  workspaceId,
  userId,
}: {
  draft: Draft;
  workspaceId: string;
  userId: string;
}): Promise<void> {
  const client = requireSupabase();

  const { error: erroMarca } = await client.from("brands").insert({
    id: draft.brandId,
    workspace_id: workspaceId,
    name: draft.company.trim(),
    description: draft.description.trim(),
    website: draft.website.trim() || null,
    segment: draft.segment.trim() || null,
    voice_tone: draft.voiceTone,
    recommended_words: draft.recommendedWords,
    forbidden_words: draft.forbiddenWords,
    colors: draft.colors,
    typography: draft.typography,
    channels: draft.channels,
    formats: draft.formats,
    cadence: draft.cadence,
    logo_path: draft.logoPath,
    completeness: completeness(draft),
    created_by: userId,
  });
  if (erroMarca) throw erroMarca;

  const produtos = draft.products.filter((produto) => produto.name.trim());
  if (produtos.length) {
    const { error } = await client.from("products").insert(
      // Preço, moeda, endereço, destaques e foto vinham sendo descartados aqui:
      // o catálogo era gravado só com nome e descrição.
      produtos.map((produto) => ({
        workspace_id: workspaceId,
        brand_id: draft.brandId,
        name: produto.name.trim(),
        description: produto.description.trim(),
        price_cents: produto.priceCents ?? null,
        currency: produto.currency || "BRL",
        url: produto.url ?? null,
        highlights: produto.highlights ?? [],
        image_path: produto.imagePath ?? null,
        created_by: userId,
      })),
    );
    if (error) throw error;
  }

  if (draft.audience.trim()) {
    await client.from("audiences").insert({
      workspace_id: workspaceId,
      brand_id: draft.brandId,
      name: draft.audience.trim().slice(0, 80),
      description: draft.audience.trim(),
      pains: draft.audiencePains,
      is_primary: true,
      created_by: userId,
    });
  }

  const arquivos = [
    ...(draft.logoPath ? [{ kind: "logo", path: draft.logoPath }] : []),
    ...draft.referencePaths.map((path) => ({ kind: "referencia", path })),
  ];
  if (arquivos.length) {
    await client.from("brand_assets").insert(
      arquivos.map((arquivo) => ({
        workspace_id: workspaceId,
        brand_id: draft.brandId,
        kind: arquivo.kind,
        storage_path: arquivo.path,
        bucket: "brand-assets",
        mime_type: arquivo.path.endsWith(".svg") ? "image/svg+xml" : "image/png",
        size_bytes: 0,
        created_by: userId,
      })),
    );
  }

  const { error: erroPerfil } = await client
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
  if (erroPerfil) throw erroPerfil;
}

/** Mensagem para a pessoa, sem vazar detalhe de banco. */
export function mensagemDeFalha(falha: unknown): string {
  const detalhe = falha instanceof Error ? falha.message : "";
  return detalhe.includes("duplicate") || detalhe.includes("unique")
    ? "Já existe uma marca com esses dados. Recarregue a página e tente de novo."
    : "Não conseguimos salvar sua marca. Verifique sua conexão e tente novamente.";
}
