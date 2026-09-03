import { describe, expect, it } from "vitest";
import { extrairProdutosJsonLd } from "../supabase/functions/_shared/catalogo.ts";

const envolver = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;

describe("catálogo lido do JSON-LD da página", () => {
  it("lê a vitrine em ItemList, como a VTEX publica", () => {
    const html = envolver(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            item: {
              "@type": "Product",
              name: "Sérum Facial de Vitamina C",
              image: "https://loja.vtexassets.com/arquivos/serum.jpg",
              description: "Antioxidante para o rosto.",
              category: "Skincare",
              offers: { "@type": "AggregateOffer", lowPrice: 89.9, priceCurrency: "BRL" },
            },
          },
        ],
      }),
    );

    const produtos = extrairProdutosJsonLd(html, "https://loja.com.br/skincare");
    expect(produtos).toHaveLength(1);
    expect(produtos[0].name).toBe("Sérum Facial de Vitamina C");
    expect(produtos[0].image).toBe("https://loja.vtexassets.com/arquivos/serum.jpg");
    expect(produtos[0].price_cents).toBe(8990);
  });

  it("acha o produto aninhado numa página de detalhe", () => {
    const html = envolver(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProductDetailsPage",
        breadcrumbList: { "@type": "BreadcrumbList", itemListElement: [] },
        product: {
          "@type": "ProductGroup",
          name: "Cinto de Correr",
          image: "https://cdn.exemplo.com/cinto",
          offers: { price: "199.00", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
        },
      }),
    );

    const produtos = extrairProdutosJsonLd(html, "https://www.exemplo.com.br/produto/cinto");
    expect(produtos.map((p) => p.name)).toEqual(["Cinto de Correr"]);
    expect(produtos[0].available).toBe(true);
  });

  it("resolve imagem em caminho relativo contra a página", () => {
    const html = envolver(
      JSON.stringify({ "@type": "Product", name: "Camiseta", image: "/media/camiseta.png" }),
    );
    const produtos = extrairProdutosJsonLd(html, "https://marca.com/loja/camisetas");
    expect(produtos[0].image).toBe("https://marca.com/media/camiseta.png");
  });

  it("aceita imagem como lista e como objeto", () => {
    const lista = envolver(JSON.stringify({ "@type": "Product", name: "A", image: ["https://x.com/1.jpg", "https://x.com/2.jpg"] }));
    const objeto = envolver(JSON.stringify({ "@type": "Product", name: "B", image: { "@type": "ImageObject", url: "https://x.com/3.jpg" } }));
    expect(extrairProdutosJsonLd(lista, "https://x.com")[0].image).toBe("https://x.com/1.jpg");
    expect(extrairProdutosJsonLd(objeto, "https://x.com")[0].image).toBe("https://x.com/3.jpg");
  });

  it("não repete o mesmo produto anunciado em dois blocos", () => {
    const html =
      envolver(JSON.stringify({ "@type": "Product", name: "Tênis Alfa", image: "https://x.com/a.jpg" })) +
      envolver(JSON.stringify({ "@type": "Product", name: "tênis alfa", image: "https://x.com/a.jpg" }));
    expect(extrairProdutosJsonLd(html, "https://x.com")).toHaveLength(1);
  });

  it("ignora o que não é produto e não quebra com JSON inválido", () => {
    const html =
      envolver(JSON.stringify({ "@type": "Organization", name: "Marca" })) +
      envolver("{ isso não é json }") +
      envolver(JSON.stringify({ "@type": "Product", name: "Válido", image: "https://x.com/v.jpg" }));
    expect(extrairProdutosJsonLd(html, "https://x.com").map((p) => p.name)).toEqual(["Válido"]);
  });

  it("descarta produto sem nome e produto sem imagem aproveitável", () => {
    const html =
      envolver(JSON.stringify({ "@type": "Product", name: "", image: "https://x.com/a.jpg" })) +
      envolver(JSON.stringify({ "@type": "Product", name: "Sem foto" }));
    const produtos = extrairProdutosJsonLd(html, "https://x.com");
    expect(produtos.map((p) => p.name)).toEqual(["Sem foto"]);
    expect(produtos[0].image).toBeNull();
  });
});

describe("variante não é produto novo", () => {
  it("junta o ProductGroup e suas variantes num produto só, com o preço da variante", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "ProductGroup",
      name: "Cinto de Correr",
      image: "https://cdn.exemplo.com/cinto.png",
      category: "Cachorros > Acessórios",
      hasVariant: [
        { "@type": "Product", name: "Cinto de Correr U", offers: { price: "199.00", priceCurrency: "BRL" } },
        { "@type": "Product", name: "Cinto de Correr G", offers: { price: "199.00", priceCurrency: "BRL" } },
      ],
    })}</script>`;

    const produtos = extrairProdutosJsonLd(html, "https://exemplo.com.br/produto/cinto");
    expect(produtos.map((p) => p.name)).toEqual(["Cinto de Correr"]);
    expect(produtos[0].price_cents).toBe(19900);
  });
});
