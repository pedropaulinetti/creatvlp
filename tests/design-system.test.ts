import { describe, expect, it } from "vitest";
import {
  extractColors, extractFonts, extractLogo, extractImages,
} from "../supabase/functions/_shared/design-system.ts";
import { looksLikeShopify, detectCurrency } from "../supabase/functions/_shared/shopify.ts";

describe("extração de paleta a partir do CSS", () => {
  it("lê hex, rgb e hsl", () => {
    const css = `
      .a{color:#B4623A}.b{color:#B4623A}.c{color:#B4623A}
      .d{background:rgb(120,153,171)}.e{background:rgb(120,153,171)}.f{background:rgb(120,153,171)}
      .g{border-color:hsl(24, 60%, 50%)}
      body{background:#FFFFFF}h1{color:#171412}
    `;
    const cores = extractColors(css);
    const hexes = cores.map((c) => c.hex);
    expect(hexes).toContain("#B4623A");
    expect(hexes).toContain("#7899AB");
  });

  it("classifica fundo claro e texto escuro", () => {
    const css = "body{background:#FFFFFF;color:#111111}".repeat(5) + ".x{color:#B4623A}".repeat(4);
    const cores = extractColors(css);
    expect(cores.find((c) => c.role === "fundo")?.hex).toBe("#FFFFFF");
    expect(cores.find((c) => c.role === "texto")?.hex).toBe("#111111");
  });

  it("agrupa tons quase iguais em vez de listar doze azuis", () => {
    const css = ".a{color:#7899AB}.b{color:#7A9BAD}.c{color:#7697A9}.d{color:#7899AC}";
    const cores = extractColors(css).filter((c) => c.role !== "fundo" && c.role !== "texto");
    expect(cores.length).toBe(1);
    expect(cores[0].count).toBe(4);
  });

  it("descarta cor de uso isolado quando há candidata usada de verdade", () => {
    // #007AFF é o azul de link do sistema: aparece uma vez e não é identidade.
    const css = ".link{color:#007AFF}" + ".marca{color:#A69B8C}".repeat(6);
    const cores = extractColors(css);
    expect(cores.find((c) => c.role === "primaria")?.hex).toBe("#A69B8C");
  });

  it("ignora cores quase transparentes", () => {
    const css = ".a{background:rgba(255,0,0,0.05)}" + ".b{color:#B4623A}".repeat(4);
    const cores = extractColors(css);
    expect(cores.some((c) => c.hex === "#FF0000")).toBe(false);
  });

  it("aguenta CSS vazio", () => {
    expect(extractColors("")).toEqual([]);
  });
});

describe("extração de tipografia", () => {
  it("resolve font-family declarada em variável CSS", () => {
    const css = `:root{--body:"Inter",sans-serif;--serif:"Instrument Serif",serif}
      body{font-family:var(--body)}
      h1{font-family:var(--serif)}`;
    const fonts = extractFonts(css, "");
    expect(fonts.headline).toBe("Instrument Serif");
    expect(fonts.candidates).toContain("Inter");
  });

  it("lê famílias do Google Fonts no HTML e no @import do CSS", () => {
    const html = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap">';
    const css = '@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@400");';
    const fonts = extractFonts(css, html);
    expect(fonts.candidates).toContain("Inter");
    expect(fonts.candidates).toContain("DM Mono");
  });

  it("não escolhe monoespaçada para texto corrido", () => {
    const css = ':root{}' + '.a{font-family:"DM Mono"}'.repeat(10) + '.b{font-family:"Inter"}'.repeat(2);
    const fonts = extractFonts(css, "");
    expect(fonts.body).toBe("Inter");
  });

  it("ignora famílias genéricas do sistema", () => {
    const fonts = extractFonts("body{font-family:-apple-system,sans-serif}", "");
    expect(fonts.candidates).toEqual([]);
  });

  it("descarta nomes internos gerados por framework", () => {
    // Next.js e afins reescrevem a fonte como __Inter_a1b2c3 ao otimizar.
    const css = 'body{font-family:__totvsPro_80ca37}h1{font-family:__Inter_a1b2c3}.x{font-family:"Manrope"}';
    const fonts = extractFonts(css, "");
    expect(fonts.candidates).toEqual(["Manrope"]);
    expect(fonts.headline).toBe("Manrope");
  });
});

describe("logo e imagens", () => {
  const base = "https://marca.com.br/";

  it("prefere a imagem que se identifica como logo", () => {
    const html = '<img src="/hero.png"><img class="site-logo" src="/img/logo.svg" alt="Marca">';
    expect(extractLogo(html, base)?.url).toBe("https://marca.com.br/img/logo.svg");
  });

  it("cai para o ícone do head, preferindo SVG", () => {
    const html = '<link rel="icon" href="/fav.png" sizes="32x32"><link rel="icon" href="/fav.svg">';
    const logo = extractLogo(html, base);
    expect(logo?.kind).toBe("svg");
    expect(logo?.url).toBe("https://marca.com.br/fav.svg");
  });

  it("usa a imagem social como último recurso", () => {
    const html = '<meta property="og:image" content="https://cdn.com/og.png">';
    expect(extractLogo(html, base)?.kind).toBe("og");
  });

  it("devolve null quando não há nada", () => {
    expect(extractLogo("<html></html>", base)).toBeNull();
  });

  it("não confunde ícone e pixel de rastreio com referência visual", () => {
    const html = '<img src="/icon-cart.png"><img src="/pixel.gif"><img src="/foto-produto.jpg">';
    const imagens = extractImages(html, base);
    expect(imagens).toEqual(["https://marca.com.br/foto-produto.jpg"]);
  });
});

describe("detecção de Shopify", () => {
  it("reconhece os sinais da plataforma", () => {
    expect(looksLikeShopify('<script src="https://cdn.shopify.com/x.js">')).toBe(true);
    expect(looksLikeShopify('<div class="shopify-section">')).toBe(true);
    expect(looksLikeShopify("<html><body>loja comum</body></html>")).toBe(false);
  });

  it("lê a moeda ativa da loja", () => {
    expect(detectCurrency('Shopify.currency = {"active":"USD","rate":"1.0"}')).toBe("USD");
    expect(detectCurrency('{"currency":"BRL"}')).toBe("BRL");
    expect(detectCurrency("<html></html>")).toBe("BRL");
  });
});
