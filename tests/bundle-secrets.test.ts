/**
 * Nenhuma chave secreta pode chegar ao navegador.
 * Procura valores reais de segredo no bundle — não as palavras soltas, que
 * aparecem legitimamente dentro do supabase-js.
 *
 * Roda contra dist/. Se ainda não houver build, o teste é pulado.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = "dist";

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? allFiles(full) : [full];
  });
}

/** Padrões de valor real, não de nome de variável. */
const PROIBIDOS: { nome: string; padrao: RegExp }[] = [
  { nome: "chave do OpenRouter", padrao: /sk-or-v1-[A-Za-z0-9]{20,}/ },
  { nome: "token pessoal do Supabase", padrao: /sbp_(v0_)?[a-f0-9]{32,}/ },
  { nome: "chave secreta do Supabase", padrao: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  // JWT com role de serviço: o payload contém "service_role".
  { nome: "service role key (JWT)", padrao: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}/ },
  { nome: "URL de conexão do Postgres", padrao: /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/ },
];

describe.skipIf(!existsSync(DIST))("nenhum segredo no bundle de produção", () => {
  const arquivos = existsSync(DIST) ? allFiles(DIST).filter((f) => /\.(js|css|html|map)$/.test(f)) : [];

  it("gera arquivos para inspecionar", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  for (const { nome, padrao } of PROIBIDOS) {
    it(`não contém ${nome}`, () => {
      const encontrados = arquivos.filter((arquivo) => padrao.test(readFileSync(arquivo, "utf8")));
      expect(encontrados, `${nome} encontrado em: ${encontrados.join(", ")}`).toEqual([]);
    });
  }

  it("contém apenas a chave publicável, que é pública por natureza", () => {
    const comChave = arquivos.filter((arquivo) => /sb_publishable_/.test(readFileSync(arquivo, "utf8")));
    expect(comChave.length).toBeGreaterThan(0);
  });
});
