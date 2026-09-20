/**
 * A regra de quem manda quando uma leitura nova encontra um rascunho velho.
 *
 * Esta foi a falha mais cara do onboarding: o rascunho tinha precedência, então
 * a primeira leitura ruim ficava gravada e nenhuma correção de servidor chegava
 * à tela — a pessoa relia o site e recebia a mesma paleta errada.
 */
import { describe, expect, it } from "vitest";
import { camposDaLeitura } from "@/features/onboarding/camposDaLeitura";
import { rascunhoVazio } from "@/features/onboarding/rascunho";
import type { Draft, RespostaAnalise } from "@/features/onboarding/tipos";

const analiseVazia = {
  name: "", description: "", segment: "", voice_tone: "",
  colors: [], products: [], audience: "", differentiators: [], confidence: "media",
};

function resposta(parcial: Partial<RespostaAnalise> = {}): RespostaAnalise {
  return {
    analysis: { ...analiseVazia, ...(parcial.analysis ?? {}) },
    design_system: parcial.design_system ?? null,
    catalog: parcial.catalog ?? null,
    shopify: parcial.shopify ?? null,
    text_analysis: { ok: true, reason: "" },
  };
}

const comLeituraAntiga = (): Draft => ({
  ...rascunhoVazio(),
  company: "Marca Velha",
  colors: [{ hex: "#364153", role: "primaria", label: "" }],
  typography: { headline: "Arial", body: "Arial" },
  logoPath: "workspace/marca/logo/velho.png",
  referencePaths: ["workspace/marca/referencia/velha.jpg"],
  products: [{ name: "Produto velho", description: "" }],
});

const design = (parcial: Partial<NonNullable<RespostaAnalise["design_system"]>> = {}) => ({
  colors: [{ hex: "#039952", role: "primaria", label: "" }],
  fonts: { headline: "Lora", body: "Inter", candidates: [] },
  stylesheets: 1,
  logo: { url: "https://exemplo.com/logo.svg", kind: "svg" },
  logo_path: "workspace/marca/logo/novo.svg",
  images: ["https://exemplo.com/a.jpg"],
  reference_paths: ["workspace/marca/referencia/nova.jpg"],
  ...parcial,
});

describe("a leitura manda no que ela mesma produz", () => {
  it("substitui paleta, tipografia, logo e referências do rascunho anterior", () => {
    const campos = camposDaLeitura("https://novo.com.br", resposta({ design_system: design() }), comLeituraAntiga());

    expect(campos.colors).toEqual([{ hex: "#039952", role: "primaria", label: "" }]);
    expect(campos.typography).toEqual({ headline: "Lora", body: "Inter" });
    expect(campos.logoPath).toBe("workspace/marca/logo/novo.svg");
    expect(campos.referencePaths).toEqual(["workspace/marca/referencia/nova.jpg"]);
  });

  it("limpa o que a leitura nova não encontrou, em vez de manter o achado antigo", () => {
    // Senão o logo de um site continua colado na marca de outro.
    const campos = camposDaLeitura(
      "https://outro.com.br",
      resposta({ design_system: design({ logo_path: null, reference_paths: [], fonts: { headline: "", body: "", candidates: [] } }) }),
      comLeituraAntiga(),
    );

    expect(campos.logoPath).toBeNull();
    expect(campos.referencePaths).toEqual([]);
    expect(campos.typography).toEqual({ headline: "", body: "" });
  });

  it("o catálogo da loja vence os produtos inferidos do texto", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({
        analysis: { ...analiseVazia, products: [{ name: "Palpite", description: "" }] },
        shopify: {
          vendor: "Loja",
          currency: "BRL",
          product_types: ["Café"],
          products: [{
            name: "Bourbon Amarelo", description: "", price_cents: 4900,
            image: "https://loja.com.br/bourbon.jpg",
            image_path: "workspace/marca/produto/bourbon.jpg",
            image_paths: [
              "workspace/marca/produto/bourbon.jpg",
              "workspace/marca/produto/bourbon-verso.jpg",
            ],
            highlights: [],
          }],
        },
      }),
      rascunhoVazio(),
    );

    // Preço, moeda e foto vinham sendo descartados: o catálogo era gravado só
    // com nome e descrição, e a primeira peça nascia sem nada para mostrar.
    expect(campos.products).toEqual([
      {
        name: "Bourbon Amarelo",
        description: "",
        priceCents: 4900,
        currency: "BRL",
        url: null,
        highlights: [],
        imagePath: "workspace/marca/produto/bourbon.jpg",
        // A galeria inteira vem da leitura: um produto tem frente, verso e uso.
        imagePaths: [
          "workspace/marca/produto/bourbon.jpg",
          "workspace/marca/produto/bourbon-verso.jpg",
        ],
        imageUrl: "https://loja.com.br/bourbon.jpg",
      },
    ]);
    expect(campos.segment).toBe("Café");
  });

  it("texto que a leitura não trouxe cai para o que já havia", () => {
    // Substituir paleta é certo; apagar a descrição que a pessoa escreveu, não.
    const anterior = { ...rascunhoVazio(), description: "Escrito à mão", voiceTone: "Próximo" };
    const campos = camposDaLeitura("https://x.com.br", resposta(), anterior);

    expect(campos.description).toBe("Escrito à mão");
    expect(campos.voiceTone).toBe("Próximo");
  });
});

/**
 * O catálogo deixou de ser só do Shopify: quando o site não é loja Shopify, os
 * produtos vêm do JSON-LD da própria página. O campo mudou de nome por isso —
 * e o nome antigo continua sendo lido, para uma função ainda não publicada não
 * apagar o catálogo de quem já está com o app novo.
 */
describe("catálogo lido de qualquer plataforma", () => {
  const produto = {
    name: "Sérum de Vitamina C",
    description: "",
    price_cents: 8990,
    image: "https://loja.vtexassets.com/serum.jpg",
    image_path: "workspace/marca/produto/serum.jpg",
    highlights: [],
  };

  it("usa o catálogo novo, com foto e preço, mesmo fora do Shopify", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({
        analysis: { ...analiseVazia, products: [{ name: "Palpite", description: "" }] },
        catalog: { vendor: "", currency: "BRL", product_types: ["Skincare"], products: [produto], source: "pagina" },
      }),
      rascunhoVazio(),
    );

    expect(campos.products?.[0]).toMatchObject({
      name: "Sérum de Vitamina C",
      priceCents: 8990,
      imagePath: "workspace/marca/produto/serum.jpg",
      imageUrl: "https://loja.vtexassets.com/serum.jpg",
    });
    expect(campos.segment).toBe("Skincare");
  });

  it("ainda lê o campo antigo quando a função publicada é anterior", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({ shopify: { vendor: "Loja", currency: "BRL", product_types: [], products: [produto] } }),
      rascunhoVazio(),
    );

    expect(campos.products?.[0]).toMatchObject({ name: "Sérum de Vitamina C", priceCents: 8990 });
    expect(campos.company).toBe("Loja");
  });
});

describe("galeria do produto vinda da leitura", () => {
  it("sem image_paths, a foto principal vira uma galeria de uma", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({
        shopify: {
          vendor: "Loja", currency: "BRL", product_types: [],
          products: [{
            name: "Prensa", description: "", price_cents: 9700,
            image: "https://loja.com.br/p.jpg",
            image_path: "w/m/produto/p.jpg", highlights: [],
          }],
        },
      }),
      rascunhoVazio(),
    );
    expect(campos.products?.[0].imagePaths).toEqual(["w/m/produto/p.jpg"]);
  });

  it("produto sem foto nenhuma tem galeria vazia, não nula", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({
        shopify: {
          vendor: "Loja", currency: "BRL", product_types: [],
          products: [{ name: "Assinatura", description: "", price_cents: null, image: null, highlights: [] }],
        },
      }),
      rascunhoVazio(),
    );
    expect(campos.products?.[0].imagePaths).toEqual([]);
  });
});

describe("as fontes do site chegam ao rascunho", () => {
  it("mapeia os arquivos baixados pela leitura", () => {
    const campos = camposDaLeitura(
      "https://memoe.com.br",
      resposta({
        design_system: {
          colors: [],
          fonts: { headline: "Kefir", body: "Commissioner", candidates: [] },
          stylesheets: 1,
          logo: null,
          logo_path: null,
          font_paths: [
            { familia: "Kefir", path: "w/m/fonte/kefir.woff2" },
            { familia: "Commissioner", path: "w/m/fonte/commissioner.woff2" },
          ],
        },
      }),
      rascunhoVazio(),
    );

    // Sem isto a tela escreve "Kefir" na fonte do sistema: o nome vem, o
    // arquivo não, e quem confere a marca não vê a tipografia dela.
    expect(campos.fontFiles).toEqual([
      { path: "w/m/fonte/kefir.woff2", familia: "Kefir" },
      { path: "w/m/fonte/commissioner.woff2", familia: "Commissioner" },
    ]);
    expect(campos.typography).toEqual({ headline: "Kefir", body: "Commissioner" });
  });

  it("função antiga, sem font_paths, não quebra a leitura", () => {
    const campos = camposDaLeitura(
      "https://loja.com.br",
      resposta({
        design_system: {
          colors: [], fonts: { headline: "Inter", body: "Inter", candidates: [] },
          stylesheets: 1, logo: null, logo_path: null,
        },
      }),
      rascunhoVazio(),
    );
    expect(campos.fontFiles).toEqual([]);
  });
});

/**
 * A etapa de tipografia é anunciada duas vezes: os nomes saem do CSS logo no
 * começo, e os arquivos só existem depois de baixados e guardados. O segundo
 * anúncio é o que deixa a tela escrever a família na letra dela, então ele não
 * pode ser descartado nem apagar o que o primeiro trouxe.
 */
describe("arquivos de fonte na leitura", () => {
  it("chega ao rascunho pelo payload completo", () => {
    const campos = camposDaLeitura(
      "https://memoe.com.br",
      resposta({
        design_system: design({
          fonts: { headline: "Kefir", body: "Commissioner", candidates: [] },
          font_paths: [
            { familia: "Kefir", path: "w/b/fonte/1.woff2" },
            { familia: "Commissioner", path: "w/b/fonte/2.woff2" },
          ],
        }),
      }),
      rascunhoVazio(),
    );

    expect(campos.typography).toEqual({ headline: "Kefir", body: "Commissioner" });
    expect(campos.fontFiles).toEqual([
      { path: "w/b/fonte/1.woff2", familia: "Kefir" },
      { path: "w/b/fonte/2.woff2", familia: "Commissioner" },
    ]);
  });

  it("fica vazio quando a função não devolveu arquivo nenhum", () => {
    const campos = camposDaLeitura(
      "https://exemplo.com",
      resposta({ design_system: design({ fonts: { headline: "Rubik", body: "Inter", candidates: [] } }) }),
      rascunhoVazio(),
    );

    expect(campos.fontFiles).toEqual([]);
  });
});
