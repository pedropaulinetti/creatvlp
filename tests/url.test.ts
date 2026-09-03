import { describe, expect, it } from "vitest";
import { normalizeUrl, looksLikeUrl, prettyUrl } from "@/lib/url";
import { normalizeUrl as normalizeServidor } from "../supabase/functions/_shared/url-guard.ts";

/** Cliente e servidor precisam concordar: senão o campo mostra uma coisa e o servidor lê outra. */
const casos: [string, string][] = [
  ["suamarca.com.br", "https://suamarca.com.br/"],
  ["www.suamarca.com.br", "https://www.suamarca.com.br/"],
  ["  suamarca.com.br/  ", "https://suamarca.com.br/"],
  ["SuaMarca.COM.BR", "https://suamarca.com.br/"],
  ["http://suamarca.com.br", "http://suamarca.com.br/"],
  ["https://suamarca.com.br/loja", "https://suamarca.com.br/loja"],
  ["https:/suamarca.com.br", "https://suamarca.com.br/"],
  ["https//suamarca.com.br", "https://suamarca.com.br/"],
  ['"suamarca.com.br"', "https://suamarca.com.br/"],
  ["suamarca.com.br#topo", "https://suamarca.com.br/"],
];

describe("normalização do endereço digitado", () => {
  for (const [entrada, esperado] of casos) {
    it(`aceita ${JSON.stringify(entrada)}`, () => {
      expect(normalizeUrl(entrada)).toBe(esperado);
      expect(normalizeServidor(entrada)).toBe(esperado);
    });
  }

  it("não transforma esquema não-web em https", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBe("file:///etc/passwd");
    expect(normalizeUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
  });

  it("devolve vazio para entrada vazia", () => {
    expect(normalizeUrl("   ")).toBe("");
  });
});

describe("quando o endereço parece utilizável", () => {
  it("aceita domínio completo, com ou sem esquema", () => {
    expect(looksLikeUrl("suamarca.com.br")).toBe(true);
    expect(looksLikeUrl("https://suamarca.com.br")).toBe(true);
    expect(looksLikeUrl("loja.suamarca.com.br/produtos")).toBe(true);
  });

  it("recusa o que ainda não é um domínio", () => {
    expect(looksLikeUrl("suamarca")).toBe(false);
    expect(looksLikeUrl("")).toBe(false);
    expect(looksLikeUrl("abc")).toBe(false);
  });

  it("recusa esquema que não seja http ou https", () => {
    expect(looksLikeUrl("file:///etc/passwd")).toBe(false);
    expect(looksLikeUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("exibição curta", () => {
  it("some com o esquema e a barra final", () => {
    expect(prettyUrl("https://suamarca.com.br/")).toBe("suamarca.com.br");
    expect(prettyUrl("suamarca.com.br")).toBe("suamarca.com.br");
  });
});
