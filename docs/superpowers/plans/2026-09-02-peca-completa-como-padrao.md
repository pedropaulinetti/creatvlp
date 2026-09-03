# Peça completa como padrão — plano de implementação

> **Para agentes:** use `superpowers:executing-plans` (ou `superpowers:subagent-driven-development`) para executar. Os passos usam checkbox (`- [ ]`).

**Goal:** A peça publicável passa a ser uma imagem inteira desenhada pelo modelo — layout, texto e produto na mesma geração — em quantidade governada pelo briefing, com variedade vinda de um catálogo de referências reais de layout.

**Architecture:** Hoje o pipeline gera **uma fotografia sem texto por caminho** e monta o texto por cima em HTML (`buildComposition` + arquétipos React). Isso trava a saída em 3 peças por caminho e num punhado de layouts. O novo pipeline gera **uma peça inteira por unidade de quantidade**: cada peça escolhe caminho + copy + referência de layout, e sai do modelo pronta para publicar. A composição HTML continua no banco como o registro de texto que alimenta o prompt e a regeração, mas sai do fluxo visível. Créditos passam a ser 1 peça = 1 crédito.

**Tech Stack:** React 18 + Vite + TanStack Query (app), Supabase Edge Functions em Deno + Postgres + Storage (backend), OpenRouter (Gemini image models), Vitest (testes), Playwright (e2e).

**Decisões travadas com o usuário (02/09/2026):**
1. **1 peça = 1 crédito.** `brief.quantity` passa a ser o número de peças e o número de gerações.
2. **A composição HTML sai do fluxo de primeiro momento.** Os textos já aparecem na aba de Caminhos; o criativo é a peça desenhada. O código dos arquétipos fica no repositório, desligado — não é apagado nesta entrega.
3. **Variedade vem das referências reais** já reunidas em `Modelo de Criativos/` (55 e-commerce + 186 SaaS). Elas ainda **não** estão em bucket nenhum nem em tabela nenhuma: hoje só existem em disco. Este plano sobe e cataloga.

---

## Contexto: onde está quebrado hoje

| Sintoma relatado | Causa raiz | Arquivo |
| --- | --- | --- |
| "pergunta a quantidade e isso não desencadeia" | `brief.quantity` nunca é lido por nenhuma geração; `count` vem fixo do frontend | `src/pages/CampaignPage.tsx:65`, `supabase/functions/_shared/pipeline.ts` |
| "só gera 3, sempre" | `copiesPrompt(..., 3)` fixo + uma peça por copy + `TEMPLATES_DA_CAMPANHA` fixo com 3 chaves | `pipeline.ts:115`, `CampaignPage.tsx:98` |
| "sempre o mesmo formato, só troca o texto" | Arquitetura: imagem proibida de conter texto, texto entra por composição HTML de 8 arquétipos | `prompts.ts` (`imagePrompt`), `_shared/composition.ts`, `src/features/creatives/arquetipos.tsx` |

## Estrutura de arquivos

**Criar:**
- `supabase/migrations/20260902130000_creatvos_referencias_layout.sql` — bucket `layout-references` + tabela `layout_references`
- `supabase/functions/_shared/referencias.ts` — leitura e sorteio do catálogo de layout
- `supabase/functions/_shared/pecas.ts` — o plano de peças (quantidade → lista de peças a gerar)
- `scripts/seed-referencias.mjs` — sobe `Modelo de Criativos/**` para o bucket e popula a tabela
- `tests/pecas.test.ts`, `tests/referencias.test.ts`

**Modificar:**
- `supabase/functions/_shared/prompts.ts` — `pecaCompletaPrompt` passa a receber referência de layout e a proibir cópia de marca alheia
- `supabase/functions/_shared/pipeline.ts` — `runDirections` (count do briefing) e `runImages` (uma geração por peça)
- `supabase/functions/generate-image/index.ts` — corpo passa a `quantidade`, não `template_keys`
- `supabase/functions/generate-directions/index.ts` — `count` opcional, derivado do briefing
- `supabase/functions/run-routines/index.ts` — usar `routine.quantity` como número de peças
- `src/pages/CampaignPage.tsx` — diálogo com quantidade pré-preenchida do briefing, chunking, custo real
- `src/features/creatives/AssetCard.tsx` — peça desenhada como visual único; editar texto = regerar
- `src/features/creatives/export.ts` — download do PNG gerado, não do DOM
- `src/lib/image-quality.ts` — custo por peça
- `tests/prompts.test.ts`

**Não tocar (ficam desligados, não apagados):** `src/features/creatives/arquetipos.tsx`, `src/features/creatives/CreativeCanvas.tsx`, `src/features/creatives/composicao.ts`, `supabase/functions/_shared/composition.ts`.

---

## Task 1: Catálogo de referências de layout (banco + storage)

**Files:**
- Create: `supabase/migrations/20260902130000_creatvos_referencias_layout.sql`

- [ ] **Passo 1: escrever a migração**

```sql
-- Referências reais de layout de anúncio.
--
-- A variedade da peça não vem de descrever forma em palavras — cinco formas
-- escritas no prompt entregam cinco peças parecidas. Vem de mostrar ao modelo
-- um anúncio real e pedir a ESTRUTURA dele, nunca a marca dele.
--
-- Bucket global: a referência não pertence a workspace nenhum, é acervo do
-- CreatvOS. Leitura só pelo service role, que assina a URL na hora de gerar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('layout-references','layout-references',false, 10485760,
    array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.layout_references (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  segmento text not null check (segmento in ('ecommerce','saas')),
  origem text not null default '',
  storage_path text not null,
  -- O que o modelo precisa entender da estrutura, em português e sem citar a
  -- marca da referência. Preenchido no seed; editável depois.
  estrutura text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists layout_references_segmento on public.layout_references (segmento) where ativo;

alter table public.layout_references enable row level security;
-- Ninguém lê pelo cliente: só as Edge Functions, pelo service role.
```

- [ ] **Passo 2: aplicar e conferir**

Rodar: `npx supabase db push`
Esperado: migração aplicada sem erro; `select count(*) from public.layout_references;` retorna 0.

- [ ] **Passo 3: regenerar os tipos**

Rodar: `npm run db:types`
Esperado: `src/lib/database.types.ts` ganha `layout_references`.

- [ ] **Passo 4: commit**

```bash
git add supabase/migrations/20260902130000_creatvos_referencias_layout.sql src/lib/database.types.ts
git commit -m "feat: catalogo de referencias de layout"
```

---

## Task 2: Seed das referências

**Files:**
- Create: `scripts/seed-referencias.mjs`

- [ ] **Passo 1: escrever o script**

Regras do script:
- Lê `Modelo de Criativos/Ecommerce/*.{png,jpg,jpeg,webp}` → `segmento: "ecommerce"`, `origem: ""`.
- Lê `Modelo de Criativos/SAAS/<Marca>/*.{png,jpg,...}` → `segmento: "saas"`, `origem: "<Marca>"`.
- Ignora `.mp4`, `.DS_Store` e qualquer arquivo acima de 10 MB (limite do bucket).
- `key` = `<segmento>-<slug da origem ou "geral">-<índice>`, estável entre execuções.
- `storage_path` = `<segmento>/<key>.<ext>`.
- Faz upsert no storage (`upsert: true`) e `on conflict (key) do update` na tabela — rodar duas vezes não duplica.
- Usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`, como `scripts/seed.mjs` já faz.
- Imprime ao final: quantas por segmento.

- [ ] **Passo 2: registrar o comando**

Em `package.json`, adicionar em `scripts`:
```json
"seed:referencias": "node scripts/seed-referencias.mjs"
```

- [ ] **Passo 3: rodar**

Rodar: `npm run seed:referencias`
Esperado: `ecommerce: 55 · saas: 186` (ou próximo — arquivos acima do limite são pulados e listados).

- [ ] **Passo 4: commit**

```bash
git add scripts/seed-referencias.mjs package.json
git commit -m "feat: seed das referencias de layout"
```

> **Nota de risco a checar com o usuário depois do seed:** as referências são anúncios de marcas reais. O prompt da Task 4 proíbe explicitamente copiar logotipo, nome, texto ou produto da referência — só a estrutura. Vale conferir 3 ou 4 peças geradas antes de liberar para clientes.

---

## Task 3: Leitura e sorteio do catálogo

**Files:**
- Create: `supabase/functions/_shared/referencias.ts`
- Test: `tests/referencias.test.ts`

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { distribuirReferencias } from "../supabase/functions/_shared/referencias.ts";

const catalogo = [
  { key: "a", storage_path: "a.png", estrutura: "A" },
  { key: "b", storage_path: "b.png", estrutura: "B" },
  { key: "c", storage_path: "c.png", estrutura: "C" },
];

describe("distribuirReferencias", () => {
  it("não repete referência enquanto houver catálogo", () => {
    const escolhidas = distribuirReferencias(catalogo, 3);
    expect(new Set(escolhidas.map((item) => item.key)).size).toBe(3);
  });

  it("volta a circular quando a quantidade passa do catálogo", () => {
    const escolhidas = distribuirReferencias(catalogo, 5);
    expect(escolhidas).toHaveLength(5);
    expect(new Set(escolhidas.slice(0, 3).map((item) => item.key)).size).toBe(3);
  });

  it("sem catálogo, devolve lista vazia sem quebrar", () => {
    expect(distribuirReferencias([], 4)).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/referencias.test.ts`
Esperado: FAIL — módulo não encontrado.

- [ ] **Passo 3: implementar**

`referencias.ts` exporta:
- `type ReferenciaDeLayout = { key: string; storage_path: string; estrutura: string }`
- `carregarReferencias(admin, segmento)` — lê `layout_references` ativas do segmento; se o segmento não tiver nenhuma, cai para o outro; devolve `[]` se a tabela estiver vazia.
- `distribuirReferencias(catalogo, quantidade)` — embaralha uma vez e percorre em ciclo, garantindo que só repete depois de esgotar.
- `assinarReferencia(admin, storage_path)` — `createSignedUrl` no bucket `layout-references`, 15 minutos.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run tests/referencias.test.ts`
Esperado: PASS (3 testes).

- [ ] **Passo 5: checar tipos do Deno**

Rodar: `npm run check:functions`
Esperado: sem erro.

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/_shared/referencias.ts tests/referencias.test.ts
git commit -m "feat: sorteio de referencias de layout"
```

---

## Task 4: O prompt da peça aprende a seguir uma referência

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts` (`pecaCompletaPrompt`)
- Test: `tests/prompts.test.ts`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `tests/prompts.test.ts`:

```ts
import { pecaCompletaPrompt } from "../supabase/functions/_shared/prompts.ts";

const peca = {
  headline: "Seu merino passou por um banho químico",
  subheadline: "O nosso não",
  cta: "Comprar agora",
  price: "",
  bullets: ["94% recomendam"],
  palette: { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" },
  typography: { headline: "Inter", body: "Inter" },
  format: "4:5",
};

describe("pecaCompletaPrompt", () => {
  it("descreve a estrutura da referência quando ela existe", () => {
    const prompt = pecaCompletaPrompt({ ...peca, estrutura: "Bloco de cor com selo redondo" }, brand);
    expect(prompt).toContain("Bloco de cor com selo redondo");
  });

  it("proíbe copiar a marca da referência", () => {
    const prompt = pecaCompletaPrompt({ ...peca, estrutura: "qualquer" }, brand);
    expect(prompt.toLowerCase()).toContain("nunca copie");
  });

  it("sem referência, ainda entrega um prompt utilizável", () => {
    const prompt = pecaCompletaPrompt({ ...peca, estrutura: "" }, brand);
    expect(prompt).toContain(peca.headline);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/prompts.test.ts`
Esperado: FAIL — `estrutura` não existe no tipo, `arquetipo` ainda é obrigatório.

- [ ] **Passo 3: implementar**

Em `pecaCompletaPrompt`:
- Trocar o campo `arquetipo: string` por `estrutura: string`. O map `FORMA` deixa de ser a fonte da forma e vira **fallback** quando `estrutura` vier vazia (sorteando uma das cinco em vez de cair sempre em `destaque`).
- Quando `estrutura` existir, a primeira linha depois do enunciado passa a ser:
  `"A imagem de referência anexada mostra a ESTRUTURA a seguir: ${estrutura}. Reproduza a estrutura — a disposição dos blocos, a proporção do texto, o tipo de recorte e o lugar do botão."`
- Acrescentar, logo em seguida, a proibição:
  `"NUNCA copie da referência o logotipo, o nome da marca, o texto, o produto, as cores ou qualquer selo. A referência dá só a arquitetura visual; a marca, o produto, a paleta e o texto são os desta peça."`
- Manter intactas as regras já medidas que valem ouro: cor de acento obrigatória, texto exato sem inventar, produto sem letra sobre ele.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run tests/prompts.test.ts`
Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/_shared/prompts.ts tests/prompts.test.ts
git commit -m "feat: peca segue a estrutura de uma referencia real"
```

---

## Task 5: O plano de peças — a quantidade vira uma lista

**Files:**
- Create: `supabase/functions/_shared/pecas.ts`
- Test: `tests/pecas.test.ts`

A função pura que resolve o problema #1 e #2: dada a quantidade, os caminhos escolhidos, as copies de cada um, os formatos e o catálogo, devolve **exatamente N peças**, cada uma com caminho, copy, formato e referência próprios.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { planejarPecas } from "../supabase/functions/_shared/pecas.ts";

const caminhos = [
  { id: "d1", copies: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
  { id: "d2", copies: [{ id: "c4" }, { id: "c5" }, { id: "c6" }] },
];
const referencias = [
  { key: "r1", storage_path: "r1.png", estrutura: "R1" },
  { key: "r2", storage_path: "r2.png", estrutura: "R2" },
];

describe("planejarPecas", () => {
  it("entrega exatamente a quantidade pedida", () => {
    expect(planejarPecas({ quantidade: 7, caminhos, formatos: ["4:5"], referencias })).toHaveLength(7);
  });

  it("distribui os caminhos por igual antes de repetir", () => {
    const pecas = planejarPecas({ quantidade: 4, caminhos, formatos: ["4:5"], referencias });
    expect(pecas.filter((p) => p.directionId === "d1")).toHaveLength(2);
    expect(pecas.filter((p) => p.directionId === "d2")).toHaveLength(2);
  });

  it("gira as copies dentro do caminho, sem repetir enquanto houver", () => {
    const pecas = planejarPecas({ quantidade: 6, caminhos, formatos: ["4:5"], referencias });
    const doD1 = pecas.filter((p) => p.directionId === "d1").map((p) => p.copyId);
    expect(new Set(doD1).size).toBe(3);
  });

  it("gira os formatos pedidos", () => {
    const pecas = planejarPecas({ quantidade: 4, caminhos, formatos: ["4:5", "9:16"], referencias });
    expect(new Set(pecas.map((p) => p.formato))).toEqual(new Set(["4:5", "9:16"]));
  });

  it("caminho sem copy nenhuma ainda rende peça, usando o hook", () => {
    const pecas = planejarPecas({
      quantidade: 2,
      caminhos: [{ id: "d3", copies: [] }],
      formatos: ["4:5"],
      referencias,
    });
    expect(pecas).toHaveLength(2);
    expect(pecas[0].copyId).toBeNull();
  });

  it("sem caminho nenhum, devolve lista vazia", () => {
    expect(planejarPecas({ quantidade: 5, caminhos: [], formatos: ["4:5"], referencias })).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/pecas.test.ts`
Esperado: FAIL — módulo não encontrado.

- [ ] **Passo 3: implementar**

`pecas.ts` exporta `planejarPecas({ quantidade, caminhos, formatos, referencias })` devolvendo
`Array<{ directionId: string; copyId: string | null; formato: string; referencia: ReferenciaDeLayout | null }>`.
Regra: percorre `quantidade` em round-robin sobre caminhos; dentro de cada caminho avança a copy própria; formato e referência avançam pelo índice global. Sem referências, `referencia` é `null` e o prompt usa o fallback.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run tests/pecas.test.ts`
Esperado: PASS (6 testes).

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/_shared/pecas.ts tests/pecas.test.ts
git commit -m "feat: plano de pecas a partir da quantidade"
```

---

## Task 6: `runImages` gera uma peça inteira por unidade

**Files:**
- Modify: `supabase/functions/_shared/pipeline.ts` (`runImages`)

Esta é a mudança de arquitetura. Substitui "uma foto por caminho + três composições" por "uma geração completa por peça".

- [ ] **Passo 1: trocar a assinatura**

`runImages` passa a receber `quantidade: number` no lugar de `templateKeys: string[]` e `copyVariant: number`. `formats` continua.

- [ ] **Passo 2: montar o plano antes de reservar crédito**

```
1. carrega os caminhos escolhidos e as copies de cada um (uma query, agrupada por direction_id)
2. carrega o catálogo: carregarReferencias(admin, segmentoDaMarca)
3. pecas = planejarPecas({ quantidade, caminhos, formatos, referencias })
4. se pecas.length === 0 → errors.invalid("Nenhum caminho criativo válido foi encontrado.")
5. reserveCredits(admin, workspaceId, "imagem", pecas.length, job.id)
```

O `segmentoDaMarca` sai de `brand.segment`: contém "software"/"saas"/"app"/"plataforma" → `saas`; senão `ecommerce`.

- [ ] **Passo 3: gerar cada peça**

Para cada item do plano, em `Promise.allSettled`:
- referências enviadas ao modelo, nesta ordem e no teto de 4: foto do produto (se houver) → referência de layout assinada (se houver) → até 2 referências de estilo da marca.
- `prompt: pecaCompletaPrompt({ ...textoDaCopy, estrutura, palette, typography, format }, brand)`
- upload em `resourceType: "peca"`
- insert em `creative_assets` com **`generated_path` preenchido**, `base_path: null`, `template_key` = `referencia?.key ?? "peca-livre"`, `format`, `direction_id`, `copy_id`, `visual_prompt`, `cost_usd` da própria geração.
- `composition` continua sendo gravada via `buildComposition` — é o registro de texto que a regeração usa. Não é mais renderizada.

- [ ] **Passo 4: créditos e falhas**

`confirmCredits` pelo número de peças **geradas**, `refundCredits` pelas que falharam. Sem `creative_variants` — formato agora é peça própria, não variante.

- [ ] **Passo 5: teto por chamada**

Constante local `MAX_PECAS_POR_CHAMADA = 10`. Acima disso, `errors.invalid(...)`. O motivo é o teto de 150 s da Edge Function: 30 gerações numa chamada só não cabem. O frontend fatia (Task 8).

- [ ] **Passo 6: checar tipos**

Rodar: `npm run check:functions && npm run typecheck`
Esperado: sem erro.

- [ ] **Passo 7: commit**

```bash
git add supabase/functions/_shared/pipeline.ts
git commit -m "feat: uma peca inteira por unidade de quantidade"
```

---

## Task 7: As funções expõem a quantidade

**Files:**
- Modify: `supabase/functions/generate-image/index.ts`
- Modify: `supabase/functions/generate-directions/index.ts`
- Modify: `supabase/functions/run-routines/index.ts`

- [ ] **Passo 1: `generate-image`**

No `bodySchema`: remover `template_keys`, `template_key` e `copy_variant`; acrescentar `quantidade: z.number().int().min(1).max(10)`. `direction_ids` continua `.min(1).max(5)`. Chave de idempotência passa a incluir `quantidade` e um `lote` (índice do fatiamento) para que duas chamadas seguidas não colidam.

- [ ] **Passo 2: `generate-directions`**

`count` vira `.optional()`. Quando ausente, `runDirections` lê o briefing e usa `Math.min(5, Math.max(3, brief.quantity))`. É aqui que a quantidade finalmente muda o número de hipóteses.

- [ ] **Passo 3: `run-routines`**

Trocar `templateKeys: [...]` fixo por `quantidade: Math.min(routine.quantity, 10)`, e conferir crédito contra esse número em vez de `ids.length`.

- [ ] **Passo 4: checar tipos**

Rodar: `npm run check:functions`
Esperado: sem erro.

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/generate-image/index.ts supabase/functions/generate-directions/index.ts supabase/functions/run-routines/index.ts
git commit -m "feat: quantidade do briefing governa caminhos e pecas"
```

---

## Task 8: O diálogo de geração passa a falar a verdade

**Files:**
- Modify: `src/pages/CampaignPage.tsx`

- [ ] **Passo 1: apagar o hardcode**

Remover `TEMPLATES_DA_CAMPANHA` e o `count: 4` de `generateDirections` (a função passa a chamar sem `count`).

- [ ] **Passo 2: estado de quantidade**

`const [quantidade, setQuantidade] = React.useState(1)`, semeado do briefing assim que `data.brief.payload.quantity` existir. Campo numérico no diálogo, `min 1 max 30`, com a nota de onde veio: "vindo do briefing".

- [ ] **Passo 3: fatiar a chamada**

`generateImages` divide `quantidade` em lotes de 10 e chama `generate-image` em sequência, somando os resultados e mostrando "gerando 11 de 18" enquanto roda. Cabeçalho `x-idempotency-key` distinto por lote.

- [ ] **Passo 4: consertar o resumo de custo**

- "Créditos consumidos" = `quantidade` (não `selected.length`)
- "Peças entregues" = `quantidade`
- "Custo estimado" = `estimatedCost(quality, quantidade)`
- `canAfford(quota, plan, "imagem", quantidade)`
- Apagar a `Hint` que diz "Só o primeiro formato gera imagem" — deixou de ser verdade. No lugar: "Cada peça é uma geração completa. Os formatos escolhidos se revezam entre as peças."
- Atualizar o `EmptyState` da aba Criativos pelo mesmo motivo.

- [ ] **Passo 5: conferir**

Rodar: `npm run typecheck && npm run test`
Esperado: sem erro; suíte verde.

- [ ] **Passo 6: commit**

```bash
git add src/pages/CampaignPage.tsx
git commit -m "feat: diagolo de geracao usa a quantidade do briefing"
```

---

## Task 9: O card mostra a peça, e editar significa regerar

**Files:**
- Modify: `src/features/creatives/AssetCard.tsx`
- Modify: `src/features/creatives/export.ts`

- [ ] **Passo 1: visual único**

O card renderiza `generatedUrl` como `<img>`. Remover o alternador "Composição / Desenhada" e o `CreativeCanvas` do card e do diálogo. Enquanto `generated_path` for nulo (criativos antigos), continuar caindo no `CreativeCanvas` — sem isso, campanha antiga vira card vazio.

- [ ] **Passo 2: editar = regerar**

No diálogo de edição, os campos de texto continuam (headline, apoio, CTA). O botão deixa de ser "Salvar" e passa a ser **"Regerar com este texto"**: salva a composição e chama `regenerate-asset` com `mode: "peca"`. Avisar no próprio botão que consome 1 crédito.

- [ ] **Passo 3: download**

`downloadNode` continua valendo só para o caso antigo. Para peça gerada, baixar o arquivo da URL assinada direto — sem `html-to-image`.

- [ ] **Passo 4: conferir**

Rodar: `npm run typecheck && npm run test`
Esperado: sem erro; suíte verde. `tests/creative-canvas.test.tsx` e `tests/arquetipos.test.tsx` continuam passando — o componente não foi apagado.

- [ ] **Passo 5: commit**

```bash
git add src/features/creatives/AssetCard.tsx src/features/creatives/export.ts
git commit -m "feat: card mostra a peca desenhada e editar regera"
```

---

## Task 10: Verificação de ponta a ponta

- [ ] **Passo 1: suíte completa**

Rodar: `npm run test && npm run typecheck && npm run check:functions`
Esperado: tudo verde.

- [ ] **Passo 2: e2e**

Rodar: `npm run test:e2e`
Esperado: `e2e/fluxo-critico.spec.ts` passa. Se ele afirmar "3 peças por caminho", atualizar a expectativa para a quantidade do briefing.

- [ ] **Passo 3: prova real, com dinheiro**

Com `FAKE_AI` desligado, num workspace de teste: conversa → briefing com `quantity: 6` → caminhos → gerar.
Esperado: 6 peças, 6 créditos, **6 layouts diferentes**. Conferir peça a peça que nenhuma traz logotipo ou nome de marca vindo da referência.

- [ ] **Passo 4: commit final**

```bash
git commit --allow-empty -m "chore: peca completa como padrao verificada"
```

---

## O que este plano deliberadamente não faz

- **Não apaga** `arquetipos.tsx`, `CreativeCanvas.tsx`, `composicao.ts` nem `_shared/composition.ts`. Ficam desligados do fluxo. Apagar é uma entrega separada, depois de a peça desenhada provar que aguenta produção.
- **Não migra criativos antigos.** Quem tem `base_path` e composição continua renderizando pelo caminho velho.
- **Não mexe nos limites dos planos.** Com 1 peça = 1 crédito, o consumo por campanha triplica em relação a hoje. Revisar `plans.images_limit` é decisão comercial e precisa de uma passada própria.
- **Não usa os 18 vídeos** de `Modelo de Criativos/SAAS`. Referência de vídeo pede outro pipeline.
