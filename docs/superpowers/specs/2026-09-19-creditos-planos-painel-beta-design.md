# Crédito único, planos precificados e painel da beta

Data: 2026-09-19
Estado: aprovado, aguardando plano de implementação

## O problema

Três coisas quebradas, que se resolvem juntas porque mexem no mesmo lugar.

**O produto fala em dólar.** Configurações mostrava "Custo de IA US$ 4,31" e o custo do modelo
por geração. Isso é o preço de custo da plataforma exposto ao cliente — um número que ele não
paga, não controla e não sabe interpretar. Já corrigido (ver Feito).

**A quota não é crédito, são dois contadores.** `campaigns_limit` e `images_limit` são quotas
separadas. Isso não é uma moeda de plataforma, é um par de limites. E porque uma imagem conta
1 independentemente do modelo que a atendeu, o mesmo plano custa entre US$ 5,85 e US$ 23,25
conforme o cliente escolha rascunho ou alta — a margem anda sozinha num fator de 4.

**Os planos não têm preço.** Nem em real, nem no Stripe, nem no banco.

## Decisões

### Uma moeda só, com peso por qualidade

Uma quota de crédito substitui as duas. A tabela de peso vive no servidor e o cliente nunca a vê:

| Ação | Créditos | Custo real |
|---|---|---|
| Imagem rascunho | 1 | US$ 0,039 |
| Imagem padrão | 2 | US$ 0,077 |
| Imagem alta | 4 | US$ 0,155 |
| Abrir campanha (direções + copies) | 5 | ~US$ 0,002 |
| Reescrever texto | 0 | ~US$ 0,001 |
| Leitura da marca | 0 | ~US$ 0,003 |

Os pesos 1 / 2 / 4 fazem o custo por crédito ficar em US$ 0,0390 / 0,0385 / 0,0388 —
constante na prática. É o ponto inteiro do desenho: **com peso, um crédito custa sempre o
mesmo, e a margem para de depender da escolha do cliente.**

A tabela está adormecida hoje, porque a interface não deixa escolher qualidade e o servidor
sempre usa `padrao`. Ela acorda quando "aprovar e finalizar em alta" virar uma ação de 4
créditos em vez de 2 — cobrando o dobro no momento de maior intenção, na peça que vai rodar
com verba.

### Custo carregado por crédito

R$ 0,2145 de IA (US$ 0,039 a R$ 5,50) + 25% = **R$ 0,268**.

Os 25% não são infraestrutura: armazenamento e egress somam ~3% do custo de IA. São retentativas
e gerações que falham depois da chamada à API — o crédito volta para o cliente, o dólar não volta
para você.

### Planos

| Plano | Créditos | Imagens (padrão) | Marcas | Pessoas | Rotinas | Preço | R$/imagem |
|---|---|---|---|---|---|---|---|
| Beta | 400 | 200 | 1 | 2 | não | R$ 0 | — |
| Início | 200 | 100 | 1 | 3 | não | R$ 297 | R$ 2,97 |
| Growth | 550 | 275 | 3 | 8 | sim | R$ 697 | R$ 2,53 |
| Studio | 1.400 | 700 | 10 | 20 | sim | R$ 1.597 | R$ 2,28 |

Avulso: 150 créditos por R$ 197 (R$ 1,31/crédito) — mais caro que qualquer plano, de propósito.

O R$/imagem cai ao longo da régua (2,97 → 2,53 → 2,28). O degrau de entrada é o mais caro por
peça e tem que ser: é o que torna o upgrade uma decisão econômica em vez de um pedido.

### Margem

Stripe Brasil a 3,99% + R$ 0,39. "Pior caso" é o cliente queimar 100% da quota todo mês.

| Plano | Custo @100% | Stripe | Pior caso | A 65% de uso |
|---|---|---|---|---|
| Início | R$ 53,63 | R$ 12,24 | 77,8% | 84,1% |
| Growth | R$ 147,48 | R$ 28,20 | 74,8% | 82,2% |
| Studio | R$ 375,31 | R$ 64,11 | 72,5% | 80,7% |

Custo da beta: R$ 107 por tester por mês (400 créditos a R$ 0,268).

### Duas travas que sustentam esses números

**Crédito não acumula.** A diferença entre 74% e 82% é a folga de quem não usa a quota inteira.
Saldo que rola para o mês seguinte transfere essa folga para o cliente. Se houver pressão
comercial por acúmulo, limitar a 20% e só no anual.

**Gatilho de câmbio.** A OpenRouter cobra em dólar, a venda é em real. O Studio é o degrau que
aperta primeiro, por ter o maior volume de crédito sobre o menor preço por unidade:

| USD | Início | Growth | Studio |
|---|---|---|---|
| R$ 5,50 | 77,8% | 74,8% | 72,5% |
| R$ 6,30 | 75,2% | 71,7% | 69,1% |
| R$ 7,00 | 72,9% | 69,0% | 66,1% |

A estes preços o câmbio não é ameaça de curto prazo — mesmo a R$ 7,00 nenhum plano cai de 66%.
Ainda assim, guardar o custo em dólar no banco em vez de constante no código, e alertar quando o
dólar passar de **R$ 6,30**, que é onde o Studio cruza os 70%.

### Durante a beta

Os planos entram no banco **ocultos**. `beta` segue o único atribuível e o Stripe fica fora do
caminho crítico — é a única peça que não existe no código, e não precisa existir agora.

## Feito

`src/pages/SettingsPage.tsx`:

- Card "Custo de IA" removido; a grade do plano passou a 3 colunas.
- A consulta parou de selecionar `cost_usd` e `model` — não chegam mais nem ao bundle. O modelo
  saiu junto porque `google/gemini-3-pro-image` é a mesma classe de vazamento: diz como a
  plataforma atendeu, não o que o cliente contratou.
- Cada linha do histórico fala crédito: `1 crédito`, `3 créditos`, `1 campanha`, `sem crédito`.
- `EVENT_LABEL` traduz slug interno para língua de produto (`regeneracao_copy` → "Novo texto").

`tsc --noEmit` limpo, 297 testes passando.

Sobra `src/lib/image-quality.ts`, que ainda carrega `costUsd` e `estimatedCost()` no cliente.
Hoje é código morto — a interface não deixa escolher qualidade e só o tipo `ImageQuality` é
importado. Some junto com `tests/image-quality.test.ts` na etapa 1.

## Etapa 1 — crédito único

### Banco

`plans`: `credits_limit int not null`, `price_brl_cents int not null default 0`,
`stripe_price_id text`, `is_public boolean not null default false`.
`campaigns_limit` e `images_limit` ficam durante a migração e caem no fim.

`plan_key`: `alter type public.plan_key add value 'inicio'` — o enum hoje é
`('beta','growth','studio')` e não tem o degrau de entrada. Precisa de migração própria, Postgres
não aceita `add value` e uso do valor novo na mesma transação.

`usage_quotas`: `credits_used`, `credits_reserved`, `bonus_credits`. Os seis campos antigos
(`campaigns_used`, `images_used`, `campaigns_reserved`, `images_reserved`, `bonus_images`,
`bonus_campaigns`) ficam para a migração e caem no fim.

Migração dos saldos vigentes, pela tabela de peso:

```sql
credits_used     = campaigns_used * 5     + images_used * 2
credits_reserved = campaigns_reserved * 5 + images_reserved * 2
bonus_credits    = bonus_campaigns * 5    + bonus_images * 2
```

### RPCs

`quota_available(p_workspace, p_kind)` → `quota_available(p_workspace)`. O `case` sobre
`p_kind` desaparece; o limite vem de `plans.credits_limit`.

`reserve_credits(p_workspace, p_kind, p_amount, p_job)` →
`reserve_credits(p_workspace, p_amount, p_job)`. O `if p_kind = 'imagem'` vira um único
`update ... set credits_reserved = credits_reserved + p_amount`.

**Preservar a trava que já existe.** A primeira linha de `reserve_credits` é
`perform public.ensure_quota_period(p_workspace)`, e é lá dentro que mora o
`select ... for update` na linha de `usage_quotas`. Como a função inteira roda numa transação,
a trava vale até o commit e uma segunda reserva simultânea fica esperando. Não há corrida hoje.

Fica registrado porque é fácil perder isso ao simplificar: quem for tirar o `p_kind` pode achar
que a chamada a `ensure_quota_period` é redundante — ela aparenta só garantir que a linha existe —
e removê-la. Aí a corrida nasce. A chamada fica, e o teste de concorrência abaixo existe para
provar que ficou.

`confirm_credits` e `refund_credits`: mesma simplificação.

`usage_ledger.kind`: o check hoje é `in ('campanha','imagem')`. Passa a aceitar as ações da
tabela de peso — `imagem`, `campanha`, `ajuste_admin` — mantendo o histórico legível por ação
mesmo com uma moeda só.

### Servidor

`supabase/functions/_shared/config.ts`: exportar `CREDIT_COST` (a tabela de peso) e
`creditsFor(action, quality, count)`.

`_shared/credits.ts`: `CreditKind` sai; as quatro funções perdem o parâmetro `kind`.

Chamadores em `pipeline.ts` (abertura de campanha e cada imagem), `regenerate-asset/index.ts`
e `run-routines/index.ts` passam a reservar o peso, não a unidade.

### Front

`src/lib/quotas.ts`: `QuotaSnapshot` e `PlanLimits` perdem os campos por tipo;
`CreditKind` sai de todas as assinaturas.

`SettingsPage`: as duas `UsageBar` viram uma, de crédito.

`CampaignPage`: o diálogo de confirmação passa a dizer quanto custa o pedido inteiro
("custa 24 créditos, você tem 276") em vez de contar peças.

`image-quality.ts` e seu teste são removidos.

## Etapa 2 — planos no banco, ocultos

Semear os quatro planos com crédito, preço e `is_public = false`. A interface do cliente não
ganha tela de preço nenhuma nesta etapa — só o admin enxerga.

`credit_cost_usd` (US$ 0,039) e `usd_brl_rate` (5,50) viram configuração no banco, não constante
no código, para o gatilho de câmbio ter onde ler e o admin ter onde alertar.

## Etapa 3 — aba Beta no admin

Sétima aba em `src/pages/AdminPage.tsx`. As seis existentes (Visão geral, Workspaces, Jobs,
Custos, Auditoria, Pesquisa) são de infraestrutura e não respondem "como vai minha beta?".

### Faixa de saúde

Testers ativos (gerou algo nos últimos 7 dias) sobre o total · taxa de aprovação
(`aprovado ÷ (aprovado + rejeitado)` em `creative_assets.status`) · créditos queimados contra
concedidos · custo real da beta em US$ — aqui pode, é tela de admin · jobs falhados na semana.

### Tabela

Uma linha por workspace: quem é (nome e e-mail do owner), quando entrou, última atividade, barra
de crédito, campanhas, peças geradas / aprovadas / rejeitadas, falhas, e o botão Ajustar que já
existe hoje na aba Workspaces.

Ordenada por **última atividade, mais antiga primeiro**. Não é a ordem bonita; é a ordem em que
o topo da tela é a pessoa para quem você precisa ligar.

Cada linha recebe um badge por conta própria:

- **Sumiu** — entrou há mais de 3 dias e nunca gerou nada. O onboarding quebrou nele.
- **Esfriou** — gerou antes, nada nos últimos 7 dias.
- **No limite** — passou de 80% do crédito.
- **Falhando** — 2 ou mais jobs falhados na semana.

### Painel lateral

Ao clicar na linha: linha do tempo do que o tester fez, **os motivos de rejeição em texto puro**
(`creative_assets.rejection_reason`, hoje gravado e nunca lido — é o feedback mais honesto que a
beta vai produzir), a resposta dele em `research_responses` se houver, e conceder crédito ali
mesmo, gravando `usage_ledger` com `reason = 'ajuste_admin'`.

### RPCs

`admin_beta_overview()` e `admin_beta_testers()`, `security definer` com guarda
`is_platform_admin()`, no padrão de `admin_cost_by_model` / `admin_cost_by_workspace`. Uma ida ao
servidor cada, em vez do leque de oito queries que a aba Visão geral faz hoje.

### beta_invites

```sql
create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  origem text not null default '',
  nota text not null default '',
  convidado_em timestamptz not null default now(),
  aceito_em timestamptz,
  workspace_id uuid references public.workspaces(id) on delete set null,
  convidado_por uuid references auth.users(id) on delete set null
);
```

Sem ela não existe como separar "convidei" de "entrou": o workspace só nasce no signup, e quem
foi convidado e nunca apareceu é invisível. Numa beta fechada essa é a perda mais importante de
medir. `aceito_em` e `workspace_id` são preenchidos no signup, casando por e-mail.

Leitura e escrita restritas a `is_platform_admin()`.

## Etapa 4 — Stripe

Fora de escopo até a beta fechar. Quando entrar: Checkout por `stripe_price_id`, webhook de
`checkout.session.completed` e `invoice.paid` movendo `workspaces.plan`, e `is_public = true`
nos três planos pagos.

## Testes

**Peso e custo** — `creditsFor` para cada ação e qualidade; que 1/2/4 mantêm o custo por crédito
dentro de 2% entre os três níveis, que é a invariante de onde a margem vem.

**Migração de saldo** — workspace com uso e reserva nos dois tipos chega ao total certo pela
fórmula; workspace zerado continua zerado.

**Reserva** — reserva além do limite falha com `QUOTA_EXCEDIDA`; reserva no limite exato passa;
devolução em falha definitiva repõe o valor exato; **duas reservas simultâneas não passam do
limite** — regressão sobre a trava de `ensure_quota_period`, que hoje passa e precisa continuar
passando.

**Sinais do painel** — cada badge a partir de dados montados: tester de 4 dias sem geração é
Sumiu; com geração há 8 dias é Esfriou; a 81% do crédito é No limite.

**RLS** — `beta_invites` e as duas RPCs novas recusam quem não é admin de plataforma.

## O que este spec assume e não sabe

Dólar a R$ 5,50 e utilização média de 65%. O segundo é chute — a beta existe em boa parte para
medi-lo, e é a variável que decide se a margem real é 74% ou 82%.

Margem de 74% só vale mais que margem de 58% se a conversão não cair junto mais que ~20%. Esse
número ninguém tem ainda. O preço é a primeira coisa a testar quando a beta virar pago.
