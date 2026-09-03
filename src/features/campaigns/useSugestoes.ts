import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { sugestoesDeCampanha, proximaOcasiao } from "@/features/campaigns/sugestoes";

/**
 * As aberturas de conversa desta marca.
 *
 * O catálogo é a única parte que precisa ir ao banco: ofertas, diferenciais e
 * nome já viajam no contexto do workspace.
 */
export function useSugestoes() {
  const { brand } = useWorkspace();

  const produtos = useQuery({
    queryKey: ["products", brand?.id],
    enabled: Boolean(brand?.id && supabase),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase!
        .from("products")
        .select("name")
        .eq("brand_id", brand!.id)
        .is("deleted_at", null)
        // Produto com foto gera peça melhor, então ele encabeça a sugestão.
        .order("image_path", { ascending: false, nullsFirst: false })
        .order("created_at")
        .limit(6);
      return data ?? [];
    },
  });

  return {
    sugestoes: sugestoesDeCampanha({
      produtos: produtos.data ?? [],
      ofertas: brand?.recurring_offers ?? [],
      diferenciais: brand?.differentiators ?? null,
      nomeDaMarca: brand?.name ?? null,
    }),
    ocasiao: proximaOcasiao(new Date()),
    carregando: produtos.isLoading,
  };
}
