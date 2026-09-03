#!/usr/bin/env node
/**
 * Semeia uma marca de demonstração no workspace de um usuário existente.
 * Não cria criativos falsos: peças só existem depois de uma geração real.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs voce@empresa.com.br
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!url || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email) {
  console.error("Uso: node scripts/seed.mjs voce@empresa.com.br");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id, full_name")
  .ilike("email", email)
  .maybeSingle();

if (profileError || !profile) {
  console.error(`Não encontrei um usuário com o e-mail ${email}. Cadastre-se no app primeiro.`);
  process.exit(1);
}

const { data: membership } = await admin
  .from("workspace_members")
  .select("workspace_id")
  .eq("user_id", profile.id)
  .limit(1)
  .maybeSingle();

if (!membership) {
  console.error("Esse usuário ainda não tem workspace.");
  process.exit(1);
}

const workspaceId = membership.workspace_id;

const { data: existing } = await admin
  .from("brands")
  .select("id")
  .eq("workspace_id", workspaceId)
  .ilike("name", "Minas Estate Coffee")
  .is("deleted_at", null)
  .maybeSingle();

if (existing) {
  console.log("A marca de demonstração já existe. Nada a fazer.");
  process.exit(0);
}

const { data: brand, error: brandError } = await admin
  .from("brands")
  .insert({
    workspace_id: workspaceId,
    name: "Minas Estate Coffee",
    description: "Torrefação de cafés especiais das montanhas de Minas, com assinatura mensal e curadoria de torra.",
    website: "https://minasestate.com.br",
    segment: "Alimentos e bebidas · café especial",
    voice_tone: "Próximo e informativo",
    voice_notes: "Fala em primeira pessoa do plural. Explica sem soar técnica demais. Evita superlativo.",
    recommended_words: ["origem", "torra", "frescor", "produtor", "safra"],
    forbidden_words: ["barato", "imperdível", "milagroso"],
    forbidden_promises: ["o melhor café do Brasil", "emagrece", "cura ansiedade"],
    differentiators: [
      "Origem rastreável até o produtor",
      "Torra semanal sob demanda",
      "Assinatura sem fidelidade",
    ],
    competitors: [
      { name: "Rede de cafeterias nacional", note: "forte em ponto físico e conveniência" },
      { name: "Marcas de supermercado", note: "preço baixo e distribuição ampla" },
    ],
    proofs: [
      { statement: "Mais de 2 mil assinantes recorrentes", source: "Base de clientes, ago/2026" },
      { statement: "Nota 4,9 em avaliações de entrega", source: "Pós-venda" },
    ],
    recurring_offers: [
      { name: "Frete grátis", detail: "acima de R$ 120" },
      { name: "Primeira assinatura", detail: "10% na primeira remessa" },
    ],
    colors: [
      { hex: "#8A6A42", role: "primaria", label: "Terra torrada" },
      { hex: "#F4F1EA", role: "fundo", label: "Papel" },
      { hex: "#171412", role: "texto", label: "Tinta" },
    ],
    typography: { headline: "Instrument Serif", body: "Inter" },
    channels: ["Meta Ads", "Instagram"],
    formats: ["4:5", "9:16"],
    cadence: "Semanal",
    completeness: 88,
    created_by: profile.id,
  })
  .select("id")
  .single();

if (brandError) {
  console.error("Falha ao criar a marca:", brandError.message);
  process.exit(1);
}

await admin.from("products").insert([
  {
    workspace_id: workspaceId,
    brand_id: brand.id,
    name: "Bourbon Amarelo · torra média",
    description: "Doçura de caramelo e corpo redondo. O mais pedido por quem está começando.",
    price_cents: 8990,
    highlights: ["Doce", "Equilibrado", "Coado ou espresso"],
    created_by: profile.id,
  },
  {
    workspace_id: workspaceId,
    brand_id: brand.id,
    name: "Catuaí Vermelho · torra clara",
    description: "Acidez cítrica e final limpo. Para quem já explora métodos filtrados.",
    price_cents: 9790,
    highlights: ["Cítrico", "Filtrados", "Safra limitada"],
    created_by: profile.id,
  },
  {
    workspace_id: workspaceId,
    brand_id: brand.id,
    name: "Assinatura mensal",
    description: "Uma remessa por mês, escolhida pela curadoria, sem fidelidade.",
    price_cents: 12900,
    highlights: ["Sem fidelidade", "Curadoria", "Frete incluso"],
    created_by: profile.id,
  },
]);

await admin.from("audiences").insert([
  {
    workspace_id: workspaceId,
    brand_id: brand.id,
    name: "Baristas caseiros",
    description: "Pessoas de 30 a 50 anos que fazem café em casa e já saíram do café de mercado.",
    pains: ["Não sabe qual grão escolher", "Café chega velho", "Torra inconsistente"],
    desires: ["Acertar na primeira compra", "Descobrir origens novas", "Rotina de café melhor"],
    objections: ["Preço acima do supermercado", "Medo de não gostar da torra"],
    is_primary: true,
    created_by: profile.id,
  },
  {
    workspace_id: workspaceId,
    brand_id: brand.id,
    name: "Presenteadores",
    description: "Compram para presentear em datas específicas, sem conhecer café a fundo.",
    pains: ["Não sabe o que agrada", "Prazo de entrega apertado"],
    desires: ["Presente que impressiona", "Embalagem bonita"],
    objections: ["E se a pessoa não gostar?"],
    created_by: profile.id,
  },
]);

await admin.from("routines").insert({
  workspace_id: workspaceId,
  brand_id: brand.id,
  name: "Promoções da semana",
  objective: "Vendas recorrentes",
  frequency: "semanal",
  weekday: 1,
  run_at: "08:00",
  timezone: "America/Sao_Paulo",
  channel: "Meta Ads",
  formats: ["9:16", "4:5"],
  quantity: 6,
  recurring_offer: "Frete grátis acima de R$ 120",
  instructions: "Priorizar os grãos em promoção da semana e manter o tom acolhedor.",
  requires_approval: true,
  // Desligada por segurança: nada é gerado sem autorização explícita.
  auto_generate: false,
  allow_image_generation: false,
  status: "pausada",
  created_by: profile.id,
});

await admin.from("folders").insert([
  { workspace_id: workspaceId, name: "Coleção Essencial", created_by: profile.id },
  { workspace_id: workspaceId, name: "Datas comemorativas", created_by: profile.id },
]);

console.log(`Marca de demonstração criada no workspace ${workspaceId}.`);
console.log("3 produtos, 2 públicos, 1 rotina pausada e 2 pastas.");
console.log("Nenhum criativo falso foi criado — gere pelo app para ver peças reais.");
