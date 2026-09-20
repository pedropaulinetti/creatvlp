import { describe, expect, it } from "vitest";
import {
  extractColors, extractFonts, extractFontFiles, extractLogo, extractImages,
  extractSvgColors, mergeLogoColors,
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

/*
 * Os três casos abaixo saíram de sites reais lidos em 01/09/2026. Ficam como
 * CSS sintético — o padrão é o que importa, e teste não deve depender de rede
 * nem de o site continuar igual amanhã.
 */
describe("paleta declarada vence paleta inferida", () => {
  it("acha a cor núcleo mesmo quando a interface repete mais os tons claros", () => {
    // Padrão do nubank.com.br: --colors-brand-core-P é #8D0DE3, mas os tints
    // T1/T2/T4 aparecem muito mais no CSS compilado. Contando ocorrência, a
    // cor da marca perde para os próprios tons claros dela.
    const css = `
      :root{
        --colors-brand-core-P:#8D0DE3;
        --colors-brand-core-T1:#AF63FD;
        --colors-brand-core-T2:#CBA5FD;
        --colors-brand-core-T4:#ECDFFF;
      }
      ${".tint4{background:#ECDFFF}".repeat(20)}
      ${".tint2{background:#CBA5FD}".repeat(14)}
      ${".tint1{background:#AF63FD}".repeat(10)}
      .cta{background:#8D0DE3}
    `;
    expect(extractColors(css).find((c) => c.role === "primaria")?.hex).toBe("#8D0DE3");
  });

  it("mantém na paleta a cor declarada que quase não é usada", () => {
    // Padrão do creatv.com.br: o âmbar da marca vive num token e aparece pouco;
    // o azul de apoio aparece cinco vezes mais. Os dois têm que sobreviver.
    const css = `
      :root{--orange:#F3C679;--sky:#7899AB}
      ${".apoio{color:#7899AB}".repeat(15)}
      .destaque{color:#F3C679}
    `;
    const hexes = extractColors(css).map((c) => c.hex);
    expect(hexes).toContain("#F3C679");
    expect(hexes).toContain("#7899AB");
  });

  it("não confunde cinza de framework com cor de marca", () => {
    // Padrão do natura.com.br: #CBD5E0 é cinza do Tailwind e aparecia mais que
    // o laranja da marca. Croma baixo o entrega como estrutura, não identidade.
    const css = `${".borda{border-color:#CBD5E0}".repeat(14)}${".marca{color:#F48646}".repeat(13)}`;
    const cores = extractColors(css);
    expect(cores.find((c) => c.role === "primaria")?.hex).toBe("#F48646");
    expect(cores.some((c) => c.hex === "#CBD5E0" && c.role !== "fundo")).toBe(false);
  });

  it("ignora as variáveis internas que frameworks despejam no CSS", () => {
    const css = `
      :root{--tw-gradient-from:#244774;--chakra-ring-color:#3B82F6;--brand:#B4623A}
      .a{color:#B4623A}
    `;
    const hexes = extractColors(css).map((c) => c.hex);
    expect(hexes).toContain("#B4623A");
    expect(hexes).not.toContain("#244774");
    expect(hexes).not.toContain("#3B82F6");
  });

  it("devolve a paleta inteira, não só três cores", () => {
    const css = `:root{
      --brand-1:#B4623A;--brand-2:#F3C679;--brand-3:#4F7184;
      --brand-4:#87E2A6;--brand-5:#DE3529;--brand-6:#0078A1;
    }`;
    const marca = extractColors(css).filter((c) => c.role !== "fundo" && c.role !== "texto");
    expect(marca.length).toBe(6);
  });
});

describe("cores vindas do SVG do logo", () => {
  it("lê fill, stroke e stop-color, descartando cinza", () => {
    const svg = `<svg><path fill="#B4623A"/><path stroke="#F3C679"/>
      <stop stop-color="#8A8A8A"/><path style="fill:#4F7184"/></svg>`;
    expect(extractSvgColors(svg)).toEqual(["#B4623A", "#F3C679", "#4F7184"]);
  });

  it("o logo lidera a paleta, mesmo contra a cor mais repetida do CSS", () => {
    // Caso do vibiz.com.br: o CSS elegia um amarelo de ícone como primária
    // enquanto o verde do logo ficava em terceiro.
    const paleta = extractColors(
      `${".icone{color:#D4A820}".repeat(9)}${".verde{color:#039952}".repeat(4)}body{background:#FFFFFF}`,
    );
    expect(paleta.find((c) => c.role === "primaria")?.hex).toBe("#D4A820");

    const juntas = mergeLogoColors(paleta, ["#039952", "#023554"]);
    expect(juntas.find((c) => c.role === "primaria")?.hex).toBe("#039952");
    expect(juntas.find((c) => c.role === "secundaria")?.hex).toBe("#023554");
    // O amarelo continua na paleta — só deixa de mandar nela.
    expect(juntas.some((c) => c.hex === "#D4A820")).toBe(true);
    // A cor do logo que já estava na paleta não entra duas vezes.
    expect(juntas.filter((c) => c.hex === "#039952").length).toBe(1);
  });

  it("não mexe na paleta quando o logo não traz cor", () => {
    const paleta = extractColors(".a{color:#B4623A}".repeat(5));
    expect(mergeLogoColors(paleta, [])).toBe(paleta);
  });

  it("mantém azul marinho de marca, que é escuro mas não é preto", () => {
    // #023554 tem luminância 0.03 — o piso antigo o descartava como se fosse
    // texto preto, e ele é metade do logo do vibiz.
    const cores = extractColors(".a{color:#023554}".repeat(5));
    expect(cores.find((c) => c.role === "primaria")?.hex).toBe("#023554");
  });
});

describe("cinza de framework não vence cor de marca por repetição", () => {
  it("descarta o slate do Tailwind mesmo aparecendo o dobro das vezes", () => {
    // Caso do vibiz.com.br: #364153 é o slate-700, usado em 14 lugares; a cor
    // da marca aparecia em 7 e perdia.
    const css = `${".texto{color:#364153}".repeat(14)}${".marca{color:#C87A4A}".repeat(7)}`;
    expect(extractColors(css).find((c) => c.role === "primaria")?.hex).toBe("#C87A4A");
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

  it("prefere o logo que o próprio site declara em JSON-LD", () => {
    // Caso do leavo.ai: aplicação em React cujo HTML inicial não tem nenhum
    // <img> de conteúdo. O schema.org é a única pista do logo de verdade — e
    // sem ele a leitura caía no favicon.
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization",
       "name":"Leavo AI","logo":"https://leavo.ai/assets/logo-light.svg"}
      </script>
      <link rel="icon" href="/favicon.png"/>`;
    expect(extractLogo(html, base)).toEqual({
      url: "https://leavo.ai/assets/logo-light.svg",
      kind: "svg",
    });
  });

  it("acha o logo dentro de @graph e de ImageObject", () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebSite"},{"@type":"Organization","logo":{"@type":"ImageObject","url":"/marca.svg"}}]}
      </script>`;
    expect(extractLogo(html, base)?.url).toBe("https://marca.com.br/marca.svg");
  });

  it("não quebra com JSON-LD malformado", () => {
    const html = `<script type="application/ld+json">{isso não é json}</script>
      <link rel="icon" href="/favicon.png"/>`;
    expect(extractLogo(html, base)?.url).toBe("https://marca.com.br/favicon.png");
  });

  it("acha o logo embutido em data: URI, sem palavra que o identifique", () => {
    // Padrão do vibiz.com.br: Next.js publica o logo como SVG inline, e nada na
    // tag diz "logo". Um vetor embutido no topo da página é sempre a marca.
    const html = `<header><img src="data:image/svg+xml,%3csvg%3e%3c/svg%3e"/></header>
      <img src="/foto.jpg" alt="equipe"/>`;
    expect(extractLogo(html, base)).toEqual({
      url: "data:image/svg+xml,%3csvg%3e%3c/svg%3e",
      kind: "svg",
    });
  });

  it("não confunde o logo embutido com referência visual", () => {
    const html = `<img src="data:image/svg+xml,%3csvg%3e%3c/svg%3e"/><img src="/foto.jpg"/>`;
    expect(extractImages(html, base)).toEqual(["https://marca.com.br/foto.jpg"]);
  });

  it("devolve null quando não há nada", () => {
    expect(extractLogo("<html></html>", base)).toBeNull();
  });

  it("descarta o pixel de rastreio, que não diz no endereço que é pixel", () => {
    // Caso do leavo.ai: o pixel do Facebook era a única "imagem" da página.
    const html = `<img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=348380045002894&ev=PageView&noscript=1"/>`;
    expect(extractImages(html, base)).toEqual([]);
  });

  it("usa a imagem social quando a página não tem imagem de conteúdo", () => {
    // Aplicação em React monta o conteúdo no navegador; a imagem social é feita
    // à mão pela marca e é a única referência visual que sobra.
    const html = `<meta property="og:image" content="https://cdn.com/social.png"/>
      <img height="1" width="1" style="display:none" src="https://tracker.com/tr"/>`;
    expect(extractImages(html, base)).toEqual(["https://cdn.com/social.png"]);
  });

  it("não usa a imagem social quando já há imagem de conteúdo", () => {
    const html = `<meta property="og:image" content="https://cdn.com/social.png"/>
      <img src="/foto.jpg"/>`;
    expect(extractImages(html, base)).toEqual(["https://marca.com.br/foto.jpg"]);
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

describe("extractFontFiles", () => {
  const base = "https://marca.com.br/";

  it("acha a família e o arquivo lado a lado no @font-face", () => {
    const css = `@font-face{font-family:"Commissioner";src:url("/fonts/Commissioner-Regular.woff2") format("woff2")}`;
    expect(extractFontFiles(css, base)).toEqual([
      { familia: "Commissioner", url: "https://marca.com.br/fonts/Commissioner-Regular.woff2" },
    ]);
  });

  /*
   * O primeiro @font-face da família costuma ser o peso mais fino. Mostrar o
   * nome da marca em Thin é mostrar um traço que não é o dela.
   */
  it("prefere o peso regular entre os vários da mesma família", () => {
    const css = `
      @font-face{font-family:"Kefir";font-weight:100;src:url("/f/kefir-thin.woff2")}
      @font-face{font-family:"Kefir";font-weight:400;src:url("/f/kefir-regular.woff2")}
      @font-face{font-family:"Kefir";font-weight:700;src:url("/f/kefir-bold.woff2")}`;
    expect(extractFontFiles(css, base)[0].url).toContain("kefir-regular");
  });

  it("escolhe woff2 quando o src lista vários formatos", () => {
    const css = `@font-face{font-family:"Inter";src:url("/f/i.woff") format("woff"),url("/f/i.woff2") format("woff2")}`;
    expect(extractFontFiles(css, base)[0].url).toContain(".woff2");
  });

  it("ignora fonte embutida em base64", () => {
    const css = `@font-face{font-family:"Embutida";src:url(data:font/woff2;base64,AAAA) format("woff2")}`;
    expect(extractFontFiles(css, base)).toEqual([]);
  });

  it("ignora família genérica e nome interno de ícone", () => {
    const css = `
      @font-face{font-family:"sans-serif";src:url("/f/a.woff2")}
      @font-face{font-family:"icomoon";src:url("/f/b.woff2")}`;
    expect(extractFontFiles(css, base)).toEqual([]);
  });

  it("resolve endereço relativo contra a base", () => {
    const css = `@font-face{font-family:"Rel";src:url("fonts/rel.woff2")}`;
    expect(extractFontFiles(css, "https://marca.com.br/sobre/")[0].url).toBe(
      "https://marca.com.br/sobre/fonts/rel.woff2",
    );
  });

  it("sem @font-face, devolve lista vazia", () => {
    expect(extractFontFiles("body{font-family:Inter}", base)).toEqual([]);
  });
});
