#!/usr/bin/env node
/**
 * Gera src/lib/database.types.ts a partir do schema publicado.
 * Usa a Management API porque o CLI ainda recusa tokens `sbp_v0_`.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/gen-types.mjs
 */
import { writeFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.PROJECT_REF ?? "hqmhxoismhzcrytkqdpi";

if (!token) {
  console.error("Defina SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!response.ok) {
  console.error(`Falhou (HTTP ${response.status}):`, (await response.text()).slice(0, 300));
  process.exit(1);
}

const { types } = await response.json();
writeFileSync("src/lib/database.types.ts", types);
console.log(`src/lib/database.types.ts atualizado (${types.split("\n").length} linhas).`);
