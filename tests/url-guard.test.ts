import { describe, expect, it } from "vitest";
import { assertSafeUrl, extractPageFacts } from "../supabase/functions/_shared/url-guard.ts";

const rejects = (url: string) => {
  expect(() => assertSafeUrl(url)).toThrow();
};

describe("assertSafeUrl — proteção contra SSRF", () => {
  it("aceita http e https públicos", () => {
    expect(assertSafeUrl("https://minasestate.com.br").hostname).toBe("minasestate.com.br");
    expect(assertSafeUrl("http://exemplo.com/pagina?a=1").protocol).toBe("http:");
  });

  it("recusa protocolos que não sejam http/https", () => {
    rejects("file:///etc/passwd");
    rejects("ftp://exemplo.com");
    rejects("gopher://exemplo.com");
    rejects("javascript:alert(1)");
    rejects("data:text/html,<script>alert(1)</script>");
  });

  it("recusa localhost e loopback", () => {
    rejects("http://localhost:3000");
    rejects("http://127.0.0.1");
    rejects("http://127.1.2.3");
    rejects("http://[::1]");
    rejects("http://0.0.0.0");
  });

  it("recusa faixas privadas", () => {
    rejects("http://10.0.0.5");
    rejects("http://192.168.1.1");
    rejects("http://172.16.0.1");
    rejects("http://172.31.255.255");
    rejects("http://100.64.0.1");
  });

  it("aceita 172.32, que é público", () => {
    expect(assertSafeUrl("http://172.32.0.1").hostname).toBe("172.32.0.1");
  });

  it("recusa metadados de cloud", () => {
    rejects("http://169.254.169.254/latest/meta-data/");
    rejects("http://metadata.google.internal/computeMetadata/v1/");
    rejects("http://metadata.goog");
  });

  it("recusa domínios internos", () => {
    rejects("http://servidor.local");
    rejects("http://api.internal");
    rejects("http://maquina.lan");
    rejects("http://algo.home.arpa");
  });

  it("recusa IPv6 privado e link-local", () => {
    rejects("http://[fc00::1]");
    rejects("http://[fd12:3456::1]");
    rejects("http://[fe80::1]");
    rejects("http://[::ffff:127.0.0.1]");
  });

  it("recusa credenciais embutidas na URL", () => {
    rejects("https://usuario:senha@exemplo.com");
  });

  it("recusa endereço malformado", () => {
    rejects("não é uma url");
    rejects("");
  });

  it("aceita a mesma URL com espaços em volta", () => {
    expect(assertSafeUrl("  https://exemplo.com  ").hostname).toBe("exemplo.com");
  });
});

describe("extractPageFacts", () => {
  const html = `
    <html><head>
      <title>Minas Estate Coffee</title>
      <meta name="description" content="Cafés especiais de Minas">
      <meta property="og:title" content="Minas Estate">
      <meta property="og:image" content="https://cdn.exemplo.com/og.png">
      <meta property="og:site_name" content="Minas Estate">
    </head><body>
      <script>window.segredo = "não deve aparecer";</script>
      <style>.a{color:red}</style>
      <h1>Café de origem</h1>
      <h2>Torra semanal</h2>
      <p>Assinatura mensal com frete gr&aacute;tis.</p>
    </body></html>`;

  it("extrai título, descrição e Open Graph", () => {
    const facts = extractPageFacts(html);
    expect(facts.title).toBe("Minas Estate Coffee");
    expect(facts.description).toBe("Cafés especiais de Minas");
    expect(facts.ogTitle).toBe("Minas Estate");
    expect(facts.ogImage).toBe("https://cdn.exemplo.com/og.png");
    expect(facts.siteName).toBe("Minas Estate");
  });

  it("nunca inclui conteúdo de script ou style", () => {
    const facts = extractPageFacts(html);
    expect(facts.text).not.toContain("segredo");
    expect(facts.text).not.toContain("color:red");
  });

  it("coleta os títulos da página", () => {
    const facts = extractPageFacts(html);
    expect(facts.headings).toContain("Café de origem");
    expect(facts.headings).toContain("Torra semanal");
  });

  it("decodifica entidades HTML", () => {
    expect(extractPageFacts(html).text).toContain("frete grátis");
  });

  it("aguenta HTML vazio sem quebrar", () => {
    const facts = extractPageFacts("");
    expect(facts.title).toBe("");
    expect(facts.headings).toEqual([]);
  });
});
