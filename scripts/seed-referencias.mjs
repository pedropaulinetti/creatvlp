#!/usr/bin/env node
/**
 * Sobe o acervo de referências de layout para o bucket global e cataloga.
 *
 * As imagens são anúncios reais reunidos à mão em `Modelo de Criativos/`.
 * O que elas dão ao modelo é a arquitetura da peça — a proporção do texto, o
 * tipo de recorte, onde fica o botão. Nunca a marca: o prompt proíbe copiar
 * logotipo, nome, cor ou produto da referência.
 *
 * Idempotente: `key` é derivada do caminho, o upload usa upsert e a linha faz
 * on-conflict. Rodar duas vezes não duplica nada.
 *
 *   npm run seed:referencias
 *   npm run seed:referencias -- "/outro/caminho/Modelo de Criativos"
 */
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const raiz = process.argv[2] ?? path.join(process.cwd(), "Modelo de Criativos");

/** O bucket recusa acima disso, e o modelo não ganha nada com mais. */
const MAX_BYTES = 10 * 1024 * 1024;

const TIPO = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** As pastas de primeiro nível dizem o segmento. O resto é ruído do Finder. */
const SEGMENTOS = { Ecommerce: "ecommerce", SAAS: "saas" };

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const slug = (valor) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Todos os arquivos de imagem sob um diretório, com a marca de origem. */
async function varrer(diretorio, origem = "") {
  const entradas = await readdir(diretorio, { withFileTypes: true }).catch(() => []);
  const achados = [];

  for (const entrada of entradas) {
    if (entrada.name.startsWith(".")) continue;
    const completo = path.join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      // Um nível abaixo do segmento, a pasta é o nome da marca de origem.
      achados.push(...(await varrer(completo, origem || entrada.name)));
      continue;
    }

    const extensao = path.extname(entrada.name).toLowerCase();
    if (!TIPO[extensao]) continue;
    achados.push({ completo, origem, extensao });
  }

  return achados;
}

const resumo = { ecommerce: 0, saas: 0 };
const pulados = [];

for (const [pasta, segmento] of Object.entries(SEGMENTOS)) {
  const arquivos = await varrer(path.join(raiz, pasta));

  for (const [indice, arquivo] of arquivos.entries()) {
    const { size } = await stat(arquivo.completo);
    if (size > MAX_BYTES) {
      pulados.push(`${path.basename(arquivo.completo)} (${(size / 1048576).toFixed(1)} MB)`);
      continue;
    }

    const key = `${segmento}-${slug(arquivo.origem || "geral")}-${String(indice).padStart(3, "0")}`;
    const storagePath = `${segmento}/${key}${arquivo.extensao}`;

    const { error: uploadError } = await admin.storage
      .from("layout-references")
      .upload(storagePath, await readFile(arquivo.completo), {
        contentType: TIPO[arquivo.extensao],
        upsert: true,
      });

    if (uploadError) {
      pulados.push(`${key}: ${uploadError.message}`);
      continue;
    }

    const { error: rowError } = await admin
      .from("layout_references")
      .upsert(
        {
          key,
          segmento,
          origem: arquivo.origem,
          storage_path: storagePath,
          // A estrutura em palavras é opcional: a imagem já vai anexada ao
          // prompt. Fica em branco até alguém descrever uma que valha a pena.
          estrutura: "",
          ativo: true,
        },
        { onConflict: "key" },
      );

    if (rowError) {
      pulados.push(`${key}: ${rowError.message}`);
      continue;
    }

    resumo[segmento] += 1;
  }
}

console.log(`ecommerce: ${resumo.ecommerce} · saas: ${resumo.saas}`);
if (pulados.length) {
  console.log(`\nPulados (${pulados.length}):`);
  for (const item of pulados) console.log(`  - ${item}`);
}
