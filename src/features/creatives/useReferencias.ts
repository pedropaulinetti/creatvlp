import { useQuery } from "@tanstack/react-query";
import { supabase, requireSupabase } from "@/lib/supabase";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type Referencia = {
  key: string;
  segmento: string;
  /** A marca de onde veio a referência — serve de legenda para reconhecê-la. */
  origem: string;
  storage_path: string;
  estrutura: string;
  url: string | null;
};

/*
 * O que separa os dois acervos é o que o anúncio precisa mostrar: e-commerce
 * mostra um objeto, SaaS mostra uma tela ou uma ideia. A mesma leitura que a
 * Edge Function faz — repetida aqui porque a escolha acontece antes de chamar.
 */
const PALAVRAS_DE_SOFTWARE = [
  "saas", "software", "aplicativo", "app", "plataforma", "sistema",
  "tecnologia", "b2b", "crm", "erp", "automação", "automacao", "digital",
];

export function segmentoDaMarca(segmento: string | null | undefined): "ecommerce" | "saas" {
  const texto = (segmento ?? "").toLowerCase();
  if (!texto) return "ecommerce";
  return PALAVRAS_DE_SOFTWARE.some((palavra) => texto.includes(palavra)) ? "saas" : "ecommerce";
}

/** Quantas referências entram por vez. */
export const POR_PAGINA = 24;

/**
 * Miniatura, não original.
 *
 * O acervo de e-commerce tem 55 arquivos e 16 MB; o de SaaS, 186. Servir os
 * originais numa grade travava a aba inteira — não dava nem para passar o
 * mouse enquanto o navegador decodificava tudo. A transformação do Storage
 * resolve na origem, e só o que está na página é assinado.
 */
async function assinar(paths: string[], largura: number): Promise<Map<string, string>> {
  const client = requireSupabase();
  const mapa = new Map<string, string>();

  await Promise.all(
    paths.map(async (path) => {
      const { data } = await client.storage
        .from("layout-references")
        .createSignedUrl(path, 3600, { transform: { width: largura, quality: 65 } });
      if (data?.signedUrl) mapa.set(path, data.signedUrl);
    }),
  );

  return mapa;
}

/**
 * O acervo de layouts do segmento da marca, uma página por vez.
 *
 * Só carrega quando alguém abre a escolha: a campanha inteira funciona sem
 * abrir isso uma vez sequer.
 */
export function useReferencias(enabled: boolean, paginas: number) {
  const { brand } = useWorkspace();
  const segmento = segmentoDaMarca(brand?.segment);

  return useQuery({
    queryKey: ["layout-references", segmento, paginas],
    enabled: enabled && Boolean(supabase),
    staleTime: 30 * 60_000,
    // Trocar de página não pode piscar a grade inteira.
    placeholderData: (anterior) => anterior,
    queryFn: async (): Promise<{ itens: Referencia[]; total: number }> => {
      const { data, error } = await supabase!
        .from("layout_references")
        .select("key, segmento, origem, storage_path, estrutura")
        .eq("segmento", segmento)
        .eq("ativo", true)
        .order("key")
        .limit(300);

      if (error) throw error;
      const linhas = data ?? [];
      const visiveis = linhas.slice(0, paginas * POR_PAGINA);
      if (!visiveis.length) return { itens: [], total: linhas.length };

      const urls = await assinar(visiveis.map((linha) => linha.storage_path), 320);

      return {
        total: linhas.length,
        itens: visiveis.map((linha) => ({
          ...linha,
          origem: linha.origem ?? "",
          estrutura: linha.estrutura ?? "",
          url: urls.get(linha.storage_path) ?? null,
        })),
      };
    },
  });
}

/** A referência de perto: aí sim vale carregar uma versão grande. */
export function useReferenciaAmpliada(storagePath: string | null) {
  return useQuery({
    queryKey: ["layout-reference-full", storagePath],
    enabled: Boolean(storagePath && supabase),
    staleTime: 30 * 60_000,
    queryFn: async () => (await assinar([storagePath!], 900)).get(storagePath!) ?? null,
  });
}
