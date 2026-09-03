import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errors } from "./http.ts";
import { brandContext, type BrandMemory } from "./prompts.ts";

/** O produto como a geração precisa dele — inclusive onde está a foto. */
export type ProdutoDaMarca = {
  name: string;
  description: string | null;
  price_cents: number | null;
  highlights: string[] | null;
  image_path: string | null;
};

/** Carrega a memória completa da marca — fonte de verdade de toda geração. */
export async function loadBrandMemory(
  admin: SupabaseClient,
  brandId: string,
  workspaceId: string,
): Promise<{ brand: BrandMemory; context: string; products: ProdutoDaMarca[] }> {
  const [brandResult, productsResult, audiencesResult, learningsResult] = await Promise.all([
    admin.from("brands").select("*").eq("id", brandId).eq("workspace_id", workspaceId).is("deleted_at", null).maybeSingle(),
    admin.from("products").select("name, description, price_cents, highlights, image_path").eq("brand_id", brandId).is("deleted_at", null).limit(12),
    admin.from("audiences").select("name, description, pains, desires, objections").eq("brand_id", brandId).limit(6),
    admin.from("brand_learnings").select("kind, statement, confidence").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(10),
  ]);

  if (brandResult.error) throw errors.internal("Não foi possível ler a memória da marca.");
  if (!brandResult.data) throw errors.forbidden("Marca não encontrada neste workspace.");

  const brand = brandResult.data as unknown as BrandMemory;
  const context = brandContext(
    brand,
    productsResult.data ?? [],
    audiencesResult.data ?? [],
    learningsResult.data ?? [],
  );

  return { brand, context, products: (productsResult.data ?? []) as ProdutoDaMarca[] };
}

export async function loadConfirmedBrief(admin: SupabaseClient, campaignId: string) {
  const { data, error } = await admin
    .from("campaign_briefs")
    .select("id, payload, confirmed_at, version")
    .eq("campaign_id", campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw errors.internal();
  if (!data) throw errors.invalid("Esta campanha ainda não tem briefing.");
  if (!data.confirmed_at) throw errors.invalid("Confirme o briefing antes de gerar.");
  return data;
}
