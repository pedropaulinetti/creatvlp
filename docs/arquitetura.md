# Arquitetura

## Princípio

Uma regra organiza quase tudo: **o que custa dinheiro ou envolve confiança roda
no servidor**. O navegador nunca fala com o OpenRouter, nunca decide quota e
nunca vê chave secreta. O que ele faz é conversar com o Supabase sob RLS e
chamar Edge Functions.

## Camadas

```
navegador                 Supabase                       OpenRouter
─────────                 ────────                       ──────────
React 19 + Vite    ──▶    Postgres (RLS)
TanStack Query     ──▶    Storage (privado, URL assinada)
                   ──▶    Edge Functions  ─────────────▶  modelos
                              │
                              └──▶ pg_cron a cada 15 min
```

## Estrutura

```
src/
  app/            router, shell (sidebar + inset), guardas, troca de marca
  components/ui/  primitivos: botão, campos, overlays, controles, estados
  features/
    auth/         sessão, perfil, tradução de erros
    workspace/    workspace ativo, marcas, quota, plano
    campaigns/    consultas, editor de briefing, cartão de caminho
    creatives/    composição, exportação, mutações, status
    performance/  registro de resultados e leitura
    notifications/
  lib/            supabase, schemas Zod, quotas, rotinas, permissões, métricas
  legacy/         landing e pesquisa em JSX, congeladas
  pages/          uma por rota
supabase/
  migrations/     14 migrations (4 originais da pesquisa + 10 novas)
  functions/
    _shared/      config, http, auth, openrouter, pipeline, prompts, storage…
    <10 funções>
```

## Isolamento visual entre app e landing

A landing legada tem 62 KB de CSS próprio, tema escuro, com regras globais em
`html` e `body`. O app novo é claro. Os dois convivem assim:

1. O Tailwind entra **sem preflight** (`@import "tailwindcss/utilities.css"`),
   então nada dele vaza para a landing.
2. O reset que o preflight faria está em `src/styles/app.css`, escopado por
   `html[data-surface="app"]`.
3. `main.tsx` marca `document.documentElement.dataset.surface` conforme a rota:
   `site` em `/` e `/pesquisa`, `app` no resto.
4. As páginas legadas são carregadas sob demanda, então o CSS delas só chega ao
   navegador quando alguém visita a landing.

Há testes ponta a ponta que verificam a cor de fundo dos dois mundos.

## Fluxo de uma campanha

```
conversa ──▶ campaign-chat ──▶ briefing (Zod) ──▶ confirmação do usuário
                                                        │
                                                        ▼
                                        generate-directions (modelo estratégico)
                                        3–5 caminhos + copies · 1 crédito de campanha
                                                        │
                              seleção do usuário + confirmação de custo
                                                        ▼
                                        generate-image (modelo de imagem)
                                        1 imagem-base por caminho
                                                        │
                                        composição determinística do CreatvOS
                                        4:5 · 1:1 · 9:16 sem nova geração
                                                        ▼
                                        revisão ──▶ biblioteca ──▶ resultados
                                                                       │
                                                        recommend-next-test
```

## Design system a partir de um link

A paleta de uma marca quase nunca está no HTML — está no CSS, muitas vezes atrás
de variáveis (`--brand: #B4623A`). Por isso qualquer ferramenta que devolva só
markdown ou texto limpo não consegue montar um design system.

`_shared/design-system.ts` faz o caminho completo, no servidor:

1. junta o CSS embutido, os atributos `style=` e até 12 folhas externas (até
   900 KB cada): em site grande a paleta mora justamente na folha maior;
2. resolve `var(--token)` antes de ler `font-family` e antes de ler cor;
3. converte `#hex`, `rgb()` e `hsl()` para um espaço comum, agrupa tons próximos
   (senão a paleta sai com doze azuis) e classifica por luminância e croma em
   primária, secundária, apoio, fundo e texto;
4. **paleta declarada vence paleta inferida.** Quem escreve `--colors-brand-core-P`
   está dizendo qual é a cor da marca; contar ocorrência no CSS compilado diz
   outra coisa — diz qual tom a *interface* repete mais, que costuma ser um tint
   claro. Entre cores declaradas em token decide o croma, não a contagem; cor sem
   token só entra com uso repetido, senão é azul de link do navegador. Variáveis
   internas de framework (`--tw-*`, anel de foco, sombra) são descartadas;
5. acha a logo por `<img>` que se identifica como tal, depois pelo primeiro SVG
   embutido em `data:` no topo da página (frameworks publicam o logo assim, sem
   nenhuma palavra que o identifique), depois por ícone do head e por fim pela
   imagem social;
6. **sendo o logo um SVG, as cores dele lideram a paleta.** É o único lugar do
   site onde só existe marca — sem cinza de borda, tint de botão ou cor de
   estado. Logo monocromático não tem cor a oferecer e não muda nada;
7. guarda as demais imagens como referência visual da marca (até 12), e a foto
   de cada produto do catálogo junto do produto. Antes as imagens eram extraídas
   e descartadas.

**Onde a imagem se esconde.** Ler só `src` deixa a maior parte para trás: sites
com carregamento preguiçoso guardam o endereço real num `data-src` e deixam um
placeholder no `src`; `srcset` traz a mesma foto em vários tamanhos, e a
referência quer a maior; banner de destaque costuma ser `background-image` no
próprio HTML; e a imagem principal aparece como `<link rel="preload" as="image">`.
Medido na Insider (Shopify): 30 imagens contra 6 lendo só `src`.

Medido em quatro sites reais. Sem o passo 4, o roxo do Nubank (`#8D0DE3`, declarado
em `--colors-brand-core-P`) perdia para os próprios tons claros, e o cinza do
Tailwind entrava como cor de marca da Natura. Sem os passos 5 e 6, o vibiz.com.br
— Next.js sem tokens, com o logo embutido em `data:` — devolvia o `slate-700` do
Tailwind como cor primária, enquanto o verde da marca estava dentro do logo.

**Não é só a home.** `_shared/crawl.ts` escolhe até três páginas internas do mesmo
site, por palavra no caminho — produtos, planos, serviços, sobre. A home diz o que
a marca é; o que ela vende costuma estar nas outras. Cada uma entra com imagens,
logo (quando a home não tinha) e texto para o modelo.

**Quando renderizar.** O Firecrawl entra em duas situações, não uma: HTML que
chega vazio, e HTML com texto mas **sem nenhuma imagem** — em site feito como
aplicação as fotos entram por JavaScript. Medido no leavo.ai, renderizar levou de
1 para 6 imagens, de 3 para 5 planos e revelou o menu real, que mudou quais
páginas internas valia ler.

A leitura anuncia cada etapa assim que ela termina (`_shared/stream.ts`, SSE), e
o onboarding mostra o achado na hora. Quem não pede stream recebe o mesmo JSON
de sempre, inteiro, no fim — os dois modos saem do mesmo código.

`_shared/shopify.ts` complementa: toda loja Shopify publica `/products.json` sem
autenticação. Detectada a plataforma, o catálogo entra estruturado — com preço,
moeda lida do próprio HTML e imagens — em vez de ser adivinhado a partir do texto.

Nenhuma dessas etapas usa IA. O modelo entra só para interpretar texto, e sua
ausência não impede o onboarding.

**Por que não um serviço externo de scraping.** Ferramentas como o Firecrawl
resolvem a *busca* — renderizam JavaScript e driblam anti-bot — mas devolvem
markdown, HTML e screenshot, não CSS nem estilos computados. Ou seja: não
enxergam `--brand: #B4623A`, que é justamente o dado que interessa. Medindo o
buscador direto contra 8 sites brasileiros reais (Shopify, VTEX, Next.js e SaaS),
os 8 renderam paleta, tipografia e logo. `fetchPublicPage` é a única porta de
entrada, então trocar por um renderizador com JavaScript é uma mudança de uma
função só, se um cliente com SPA pesada aparecer.

## Por que a composição é determinística

Pedir headline, logo, preço ou CTA para um modelo de imagem produz texto errado,
logo deformado e inconsistência de marca. O CreatvOS pede ao modelo **só a cena**
— o prompt inclui um reforço negativo explícito contra qualquer texto — e desenha
por cima:

- `supabase/functions/_shared/composition.ts` monta o JSON no servidor;
- `src/features/creatives/CreativeCanvas.tsx` renderiza esse JSON em tamanho real
  (1080 px de largura) e reduz por `transform` só para a tela;
- a exportação usa o mesmo nó, sem escala, então o PNG é exatamente o que se vê.

Consequência prática: trocar texto, template, contraste ou formato **não gasta
crédito**.

## Créditos

Quatro funções SQL, executáveis apenas pelo service role:

| Função | Quando |
| --- | --- |
| `ensure_quota_period` | vira o ciclo mensal e zera o consumo |
| `reserve_credits` | antes de gastar; lança `QUOTA_EXCEDIDA` se não houver saldo |
| `confirm_credits` | quando a geração entrega |
| `refund_credits` | em falha definitiva |

Cada movimento vira uma linha em `usage_ledger`. O consumo real de IA vai para
`ai_usage_events`, que o cliente só consegue ler.

## Jobs e idempotência

`ai_generation_jobs` tem `unique (workspace_id, idempotency_key)`. Repetir a mesma
chave devolve o resultado anterior em vez de gerar de novo. Job em `processing`
recusa nova chamada; job travado há mais de 10 minutos pode ser retentado ou
cancelado pelo `/admin`, com devolução de crédito.

As rotinas usam `unique (routine_id, idempotency_key)` em `routine_runs` — se o
cron disparar duas vezes na mesma janela, a segunda execução é ignorada pelo banco.

## Onde a lógica vive uma vez só

`supabase/functions/_shared/pipeline.ts` concentra a geração de caminhos e de
imagens. A Edge Function chamada pelo app e o cron das rotinas usam o mesmo
código — as funções `generate-directions` e `generate-image` são apenas validação
de entrada, autenticação e chamada do pipeline.

## Banco

30 tabelas, todas com RLS. As de workspace usam o mesmo conjunto de políticas,
gerado por `public.apply_workspace_rls(<tabela>)`:

- leitura: membro do workspace ou admin de plataforma;
- escrita e atualização: membro;
- exclusão: admin do workspace.

Funções `security definer` (`is_workspace_member`, `is_workspace_admin`,
`is_platform_admin`) consultam membership sem disparar RLS, evitando recursão.

Soft delete em campanhas, pastas, marcas, produtos e criativos. Arquivos ficam no
Storage; o banco guarda só o caminho.

Workspace sem membro é inalcançável por qualquer política, então um gatilho o
remove quando o último membro sai — junto com marcas, campanhas e criativos.
Sem isso, apagar uma conta deixava dados órfãos ocupando espaço para sempre.
