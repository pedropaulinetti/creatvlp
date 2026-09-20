import type { Draft, RespostaAnalise } from "./tipos";

/**
 * Traduz o resultado de uma leitura nos campos do rascunho.
 *
 * A leitura manda no que ela mesma produz — paleta, tipografia, logo, imagens e
 * catálogo são substituídos, não mesclados. O rascunho anterior só serve de
 * rede para os campos de texto que a leitura não conseguiu preencher.
 *
 * Já foi ao contrário, para "não sobrescrever o que a pessoa digitou". O efeito
 * real era outro: uma leitura ruim ficava gravada no rascunho e toda tentativa
 * seguinte devolvia a mesma paleta velha, mesmo depois de corrigido o servidor.
 * Ler é um gesto explícito; quem pede uma leitura nova quer o resultado dela.
 */
export function camposDaLeitura(
  endereco: string,
  { analysis, design_system: ds, catalog, shopify }: RespostaAnalise,
  anterior: Draft,
): Partial<Draft> {
  // `shopify` é o nome antigo do mesmo campo: uma função ainda não atualizada
  // devolve só ele, e o catálogo não pode sumir por causa disso.
  const catalogo = catalog ?? shopify;
  const doCatalogo = catalogo?.products.map((item) => ({
    name: item.name,
    description: item.description,
    priceCents: item.price_cents,
    currency: catalogo.currency || "BRL",
    url: item.url ?? null,
    highlights: item.highlights ?? [],
    imagePath: item.image_path ?? null,
    // A galeria já vem guardada da leitura; a primeira é a principal.
    imagePaths: item.image_paths ?? (item.image_path ? [item.image_path] : []),
    imageUrl: item.image ?? null,
  }));

  return {
    website: endereco,
    /*
     * As fontes que a leitura baixou do site. É o que faz o nome da família
     * aparecer escrito na própria letra, em vez de na fonte do sistema.
     */
    fontFiles: (ds?.font_paths ?? []).map((fonte) => ({
      path: fonte.path,
      familia: fonte.familia,
    })),
    company: analysis.name || catalogo?.vendor || anterior.company,
    description: analysis.description || anterior.description,
    segment: analysis.segment || catalogo?.product_types?.[0] || anterior.segment,
    voiceTone: analysis.voice_tone || anterior.voiceTone,
    audience: analysis.audience || anterior.audience,
    colors: ds?.colors.length ? ds.colors : analysis.colors,
    typography:
      ds?.fonts && (ds.fonts.headline || ds.fonts.body)
        ? { headline: ds.fonts.headline, body: ds.fonts.body }
        : { headline: "", body: "" },
    logoPath: ds?.logo_path ?? null,
    referencePaths: ds?.reference_paths ?? [],
    products: doCatalogo?.length ? doCatalogo : analysis.products,
  };
}
