import { describe, expect, it } from "vitest";
import { nomeDaFamilia, nomePeloArquivo } from "../src/lib/fonte";

/** Monta um TTF mínimo com só a tabela `name`, como os leitores esperam. */
function ttfComNome(familia: string, plataforma = 3): ArrayBuffer {
  const texto = plataforma === 1
    ? new Uint8Array([...familia].map((c) => c.charCodeAt(0)))
    : new Uint8Array(familia.length * 2).map((_, i) =>
        i % 2 === 0 ? 0 : familia.charCodeAt((i - 1) / 2));

  const nome = new Uint8Array(6 + 12 + texto.length);
  const v = new DataView(nome.buffer);
  v.setUint16(0, 0);            // formato
  v.setUint16(2, 1);            // um registro
  v.setUint16(4, 6 + 12);       // onde começam as strings
  v.setUint16(6, plataforma);
  v.setUint16(6 + 6, 1);        // nameID 1 = família
  v.setUint16(6 + 8, texto.length);
  v.setUint16(6 + 10, 0);
  nome.set(texto, 6 + 12);

  const arquivo = new Uint8Array(12 + 16 + nome.length);
  const c = new DataView(arquivo.buffer);
  c.setUint32(0, 0x00010000);
  c.setUint16(4, 1);
  arquivo.set([0x6e, 0x61, 0x6d, 0x65], 12);
  c.setUint32(12 + 8, 28);
  c.setUint32(12 + 12, nome.length);
  arquivo.set(nome, 28);
  return arquivo.buffer;
}

const comoArquivo = (dados: ArrayBuffer, nome = "fonte.ttf") =>
  new File([dados], nome, { type: "font/ttf" });

describe("nomeDaFamilia", () => {
  it("lê o nome de um TTF em UTF-16", async () => {
    expect(await nomeDaFamilia(comoArquivo(ttfComNome("Poppins")))).toBe("Poppins");
  });

  /*
   * Plataforma Macintosh grava um byte por caractere. Ler como UTF-16 devolvia
   * o nome com espaço entre cada letra.
   */
  it("lê o nome de um TTF em ASCII da plataforma Macintosh", async () => {
    expect(await nomeDaFamilia(comoArquivo(ttfComNome("Inter", 1)))).toBe("Inter");
  });

  it("devolve null para WOFF2, em vez de chutar", async () => {
    const woff2 = new Uint8Array(32);
    new DataView(woff2.buffer).setUint32(0, 0x774f4632);
    expect(await nomeDaFamilia(comoArquivo(woff2.buffer, "f.woff2"))).toBeNull();
  });

  it("devolve null para arquivo corrompido, sem lançar erro", async () => {
    expect(await nomeDaFamilia(comoArquivo(new Uint8Array([1, 2, 3]).buffer))).toBeNull();
  });

  it("devolve null quando não há tabela de nomes", async () => {
    const vazio = new Uint8Array(12);
    new DataView(vazio.buffer).setUint32(0, 0x00010000);
    expect(await nomeDaFamilia(comoArquivo(vazio.buffer))).toBeNull();
  });
});

describe("nomePeloArquivo", () => {
  it("transforma o nome do arquivo num palpite legível", () => {
    expect(nomePeloArquivo("Poppins-SemiBold.woff2")).toBe("Poppins Semi Bold");
    expect(nomePeloArquivo("inter_regular.ttf")).toBe("inter regular");
    expect(nomePeloArquivo("HelveticaNeue.otf")).toBe("Helvetica Neue");
  });
});

import { validateFontFile } from "../src/lib/storage";

describe("validateFontFile", () => {
  const arquivo = (nome: string, tipo = "", bytes = 1000) =>
    new File([new Uint8Array(bytes)], nome, { type: tipo });

  it("aceita os quatro formatos de fonte", () => {
    for (const nome of ["f.ttf", "f.otf", "f.woff", "f.woff2"]) {
      expect(validateFontFile(arquivo(nome)).ok).toBe(true);
    }
  });

  /*
   * O navegador é irregular no `type` de fonte: manda vazio no Safari,
   * octet-stream no Windows e `font/*` no Chrome recente.
   */
  it("aceita o tipo que o navegador mandar", () => {
    for (const tipo of ["", "font/woff2", "application/octet-stream"]) {
      expect(validateFontFile(arquivo("f.woff2", tipo)).ok).toBe(true);
    }
  });

  it("recusa imagem disfarçada de fonte", () => {
    expect(validateFontFile(arquivo("logo.png", "image/png")).ok).toBe(false);
  });

  it("recusa extensão de fonte com tipo de imagem", () => {
    expect(validateFontFile(arquivo("f.ttf", "image/png")).ok).toBe(false);
  });

  it("recusa arquivo acima do limite", () => {
    const grande = validateFontFile(arquivo("f.ttf", "", 11 * 1024 * 1024));
    expect(grande.ok).toBe(false);
    if (!grande.ok) expect(grande.reason).toContain("10 MB");
  });
});
