import { describe, expect, it } from "vitest";
import { EXTENSAO_POR_TIPO, uploadBytes } from "../supabase/functions/_shared/storage.ts";

/**
 * A tabela de extensões só conhecia tipo de imagem, e `uploadBytes` desiste
 * quando não acha extensão. Toda fonte baixada do site da marca morria ali,
 * antes do upload, sem erro visível: o nome da família aparecia na tela (vem
 * do CSS) e o arquivo nunca chegava ao Storage.
 */
function clienteFalso() {
  const enviados: { path: string; contentType: string }[] = [];
  const admin = {
    storage: {
      from: () => ({
        upload: (path: string, _bytes: Uint8Array, opcoes: { contentType: string }) => {
          enviados.push({ path, contentType: opcoes.contentType });
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
  // deno-lint-ignore no-explicit-any
  return { admin: admin as any, enviados };
}

const base = {
  bucket: "brand-assets",
  workspaceId: "w1",
  brandId: "b1",
  resourceType: "fonte",
  bytes: new Uint8Array([1, 2, 3]),
};

describe("uploadBytes", () => {
  it("guarda fonte servida como font/woff2", async () => {
    const { admin, enviados } = clienteFalso();
    const caminho = await uploadBytes(admin, { ...base, mimeType: "font/woff2" });

    expect(caminho).not.toBeNull();
    expect(caminho).toMatch(/^w1\/b1\/fonte\/[0-9a-f-]+\.woff2$/);
    expect(enviados[0].contentType).toBe("font/woff2");
  });

  it("usa a extensão do endereço quando o servidor manda octet-stream", async () => {
    const { admin } = clienteFalso();
    const caminho = await uploadBytes(admin, {
      ...base,
      mimeType: "application/octet-stream",
      extensao: "ttf",
    });

    expect(caminho).toMatch(/\.ttf$/);
  });

  it("continua desistindo de tipo que não sabe nomear", async () => {
    const { admin, enviados } = clienteFalso();
    const caminho = await uploadBytes(admin, { ...base, mimeType: "application/zip" });

    expect(caminho).toBeNull();
    expect(enviados).toHaveLength(0);
  });

  it("cobre os tipos que o bucket brand-assets aceita para fonte", () => {
    for (const tipo of ["font/woff", "font/woff2", "font/ttf", "font/otf", "application/font-woff"]) {
      expect(EXTENSAO_POR_TIPO[tipo], tipo).toBeTruthy();
    }
  });
});
