#!/usr/bin/env node
/**
 * Publica os segredos do .env.local nas Edge Functions do Supabase.
 *
 * As chaves ficam só na sua máquina e no Supabase — nunca no repositório,
 * nunca no bundle do navegador. Este script recusa qualquer variável com
 * prefixo VITE_, justamente porque essas iriam parar no navegador.
 *
 *   npm run secrets:push
 */
import { readFileSync, existsSync } from "node:fs";

const ARQUIVO = ".env.local";
const REF = process.env.PROJECT_REF ?? "hqmhxoismhzcrytkqdpi";

/** Só estas sobem. Qualquer outra coisa no arquivo é ignorada. */
const PERMITIDAS = new Set([
  "OPENROUTER_API_KEY",
  "FIRECRAWL_API_KEY",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
  "OPENROUTER_FAST_MODEL",
  "OPENROUTER_STRATEGY_MODEL",
  "OPENROUTER_STRATEGY_FALLBACK",
  "OPENROUTER_IMAGE_MODEL_RASCUNHO",
  "OPENROUTER_IMAGE_MODEL_PADRAO",
  "OPENROUTER_IMAGE_MODEL_ALTA",
  "OPENROUTER_IMAGE_QUALITY_DEFAULT",
  "CRON_SECRET",
]);

/** Erros de digitação comuns: melhor avisar do que publicar uma chave quebrada. */
const FORMATOS = {
  OPENROUTER_API_KEY: /^sk-or-v1-[A-Za-z0-9]{20,}$/,
  FIRECRAWL_API_KEY: /^fc-[A-Za-z0-9-]{10,}$/,
};

if (!existsSync(ARQUIVO)) {
  console.error(`Não encontrei ${ARQUIVO}. Copie o .env.example e preencha.`);
  process.exit(1);
}

const linhas = readFileSync(ARQUIVO, "utf8").split("\n");
const encontrados = new Map();

for (const linha of linhas) {
  const limpa = linha.trim();
  if (!limpa || limpa.startsWith("#")) continue;
  const igual = limpa.indexOf("=");
  if (igual < 1) continue;

  const nome = limpa.slice(0, igual).trim();
  const valor = limpa.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
  if (!valor) continue;

  if (nome.startsWith("VITE_")) continue; // essas são do navegador
  if (!PERMITIDAS.has(nome)) continue;
  encontrados.set(nome, valor);
}

if (encontrados.size === 0) {
  console.log("Nenhuma chave preenchida no .env.local. Cole os valores e rode de novo.");
  process.exit(0);
}

let invalidas = 0;
for (const [nome, valor] of encontrados) {
  const formato = FORMATOS[nome];
  if (formato && !formato.test(valor)) {
    console.error(`  ✗ ${nome}: formato inesperado (${valor.slice(0, 6)}…). Confira antes de publicar.`);
    invalidas += 1;
  }
}
if (invalidas > 0) {
  console.error("\nNada foi publicado. Corrija as chaves acima e rode de novo.");
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN ?? encontrados.get("SUPABASE_ACCESS_TOKEN");
const tokenArquivo = linhas
  .find((l) => l.trim().startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();
const acesso = process.env.SUPABASE_ACCESS_TOKEN || tokenArquivo || token;

if (!acesso) {
  console.error(
    "Falta o SUPABASE_ACCESS_TOKEN (token pessoal do Supabase).\n" +
      "Preencha no .env.local ou exporte no shell antes de rodar.",
  );
  process.exit(1);
}

const corpo = [...encontrados].map(([name, value]) => ({ name, value }));

const resposta = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: "POST",
  headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

if (!resposta.ok) {
  console.error(`Falhou (HTTP ${resposta.status}):`, (await resposta.text()).slice(0, 300));
  process.exit(1);
}

console.log(`Publicados ${corpo.length} segredo(s) nas Edge Functions:`);
for (const { name, value } of corpo) {
  console.log(`  ✓ ${name} (${value.slice(0, 8)}…${value.slice(-4)})`);
}
console.log("\nAs funções passam a usar os novos valores na próxima chamada.");
