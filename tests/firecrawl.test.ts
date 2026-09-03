import { describe, expect, it } from "vitest";
import { pareceVazia, firecrawlEnabled } from "../supabase/functions/_shared/firecrawl.ts";

describe("quando vale renderizar a página", () => {
  it("considera vazia a casca de uma SPA", () => {
    const spa = `<html><head><title>App</title></head><body>
      <div id="root"></div>
      <script src="/bundle.js"></script>
    </body></html>`;
    expect(pareceVazia(spa)).toBe(true);
  });

  it("não renderiza de novo uma página que já veio completa", () => {
    const html = `<html><body>
      <h1>Café especial de Minas</h1>
      <h2>Assinatura mensal</h2>
      <p>${"Torramos sob demanda e enviamos em até dois dias. ".repeat(20)}</p>
    </body></html>`;
    expect(pareceVazia(html)).toBe(false);
  });

  it("não se deixa enganar por página cheia de script e sem conteúdo", () => {
    const html = `<html><body><div id="app"></div>
      <script>${"var x = 1;".repeat(400)}</script>
      <style>${".a{color:red}".repeat(200)}</style>
    </body></html>`;
    expect(pareceVazia(html)).toBe(true);
  });

  it("trata página sem título como suspeita", () => {
    const html = `<html><body><p>${"texto ".repeat(200)}</p></body></html>`;
    expect(pareceVazia(html)).toBe(true);
  });

  it("fica desligado sem chave configurada", () => {
    // O ambiente de teste não define FIRECRAWL_API_KEY.
    expect(firecrawlEnabled()).toBe(false);
  });
});
