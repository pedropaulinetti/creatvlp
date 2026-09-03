# CreatvOS

Sistema brasileiro de produção e aprendizado criativo.

Transforma **marca + produto + objetivo** em estratégia, ângulos, copies, criativos,
aprovação, biblioteca e aprendizado. Não é um gerador de imagens: é uma mesa de
testes criativos para times pequenos de marketing, fundadores, ecommerces, marcas
de consumo, SaaS e negócios locais.

```
produto → ângulos → copies → criativos → resultado → próximo teste
```

## O que existe hoje

| Área | Rota | Estado |
| --- | --- | --- |
| Landing pública | `/` | no ar, tema escuro original |
| Pesquisa de descoberta | `/pesquisa` | no ar, intocada |
| Login, cadastro, recuperação | `/login`, `/cadastro`, `/recuperar-senha` | funcionando |
| Onboarding em 8 etapas | `/onboarding` | funcionando, com leitura de site |
| Início (conversa) | `/app` | funcionando |
| Campanhas | `/app/campanhas`, `/app/campanhas/:id` | funcionando |
| Rotinas | `/app/rotinas` | funcionando, cron a cada 15 min |
| Biblioteca | `/app/biblioteca` | funcionando, com exportação ZIP |
| Minha marca | `/app/marca` | funcionando |
| Configurações e consumo | `/app/configuracoes` | funcionando |
| Administração | `/admin` | protegida por role no banco |

A geração real de texto e imagem depende da `OPENROUTER_API_KEY`
(veja [Configuração](#configuração)). Sem ela o app funciona inteiro, mas as
chamadas de IA devolvem um erro explicando o que falta.

## Stack

React 19 · Vite · TypeScript · React Router · Tailwind CSS v4 · Radix UI ·
Lucide · TanStack Query · React Hook Form · Zod · date-fns · Sonner ·
Supabase (Auth, Postgres, Storage, Edge Functions, Cron) ·
Vitest + Testing Library · Playwright · html-to-image · JSZip.

O código novo é TypeScript. A landing e a pesquisa continuam em JSX com o CSS
próprio delas, isoladas em `src/legacy/` — o Tailwind roda **sem preflight** e o
reset fica escopado por `html[data-surface="app"]`, então os dois mundos convivem
sem se afetar.

## Configuração

### 1. Variáveis do frontend

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Só essas duas vão para o navegador, e ambas são públicas por natureza.
**Nenhuma chave secreta entra no bundle** — há um teste que verifica isso.

### 2. Segredos das Edge Functions

Toda chamada ao OpenRouter acontece dentro de uma Edge Function. A chave nunca
passa pelo navegador, pelo banco, pelos logs ou por variáveis `VITE_*`.

Configure em **Supabase → Project Settings → Edge Functions → Secrets**:

| Segredo | Valor |
| --- | --- |
| `OPENROUTER_API_KEY` | **obrigatório** para gerar de verdade |
| `OPENROUTER_SITE_URL` | `https://www.creatv.com.br` |
| `OPENROUTER_APP_NAME` | `CreatvOS` |
| `OPENROUTER_FAST_MODEL` | `openai/gpt-5.6-luna` |
| `OPENROUTER_STRATEGY_MODEL` | `anthropic/claude-sonnet-5` |
| `OPENROUTER_STRATEGY_FALLBACK` | `anthropic/claude-sonnet-4.6` |
| `OPENROUTER_IMAGE_MODEL_RASCUNHO` | `google/gemini-2.5-flash-image` |
| `OPENROUTER_IMAGE_MODEL_PADRAO` | `google/gemini-3.1-flash-image` |
| `OPENROUTER_IMAGE_MODEL_ALTA` | `google/gemini-3-pro-image` |
| `OPENROUTER_IMAGE_QUALITY_DEFAULT` | `padrao` |
| `CRON_SECRET` | segredo compartilhado com o `pg_cron` |

Tudo menos a `OPENROUTER_API_KEY` já está configurado no projeto de beta.
Para adicionar a chave:

```bash
export SUPABASE_ACCESS_TOKEN=...   # token pessoal do Supabase
curl -X POST "https://api.supabase.com/v1/projects/<REF>/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"name":"OPENROUTER_API_KEY","value":"sk-or-v1-..."}]'
```

Detalhes de modelos e custo em [docs/custos-e-modelos.md](docs/custos-e-modelos.md).

### 3. Rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

### 4. Dados de demonstração (opcional)

Crie sua conta pelo app e depois:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed voce@empresa.com.br
```

Cria uma marca completa com produtos, públicos, uma rotina pausada e pastas.
**Não cria criativos falsos** — peças só existem depois de uma geração real.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | type-check + build de produção |
| `npm run typecheck` | só o type-check |
| `npm run check:functions` | type-check das Edge Functions (Deno) |
| `npm test` | testes unitários (154) |
| `npm run test:coverage` | cobertura |
| `npm run test:rls` | isolamento entre workspaces, contra o banco real |
| `npm run test:e2e` | fluxo crítico ponta a ponta (13 testes) |
| `npm run seed` | marca de demonstração |
| `npm run db:types` | regenera `src/lib/database.types.ts` |
| `npm run functions:deploy` | publica as Edge Functions |

Os testes que tocam o banco precisam de credenciais no ambiente:

```bash
export VITE_SUPABASE_URL=https://seu-projeto.supabase.co
export SUPABASE_ANON_KEY=eyJ...
export SUPABASE_SERVICE_ROLE_KEY=eyJ...
npm run test:rls
npm run test:e2e
```

O e2e sobe as **mesmas** Edge Functions de produção localmente com `FAKE_AI=true`
(`supabase/functions/_e2e/server.ts`). Nenhuma chamada paga acontece nos testes,
e o resto do caminho — auth, RLS, banco, Storage — é real. O servidor se recusa a
subir sem `FAKE_AI=true`.

## Como o produto funciona

1. **Onboarding começa pelo site.** A primeira tela pede só o endereço — e aceita
   do jeito que as pessoas escrevem: `suamarca.com.br`, `www.suamarca.com.br`,
   com espaços ou em maiúsculas. Colar o endereço já dispara a leitura, sem
   clicar em botão. A leitura roda no servidor, com proteção contra SSRF, e devolve:
   - **paleta** extraída do CSS do site (não do HTML: cor de marca vive em folha
     de estilo e em variáveis, e resolvemos `var(--token)`);
   - **tipografia** das declarações `font-family` e dos `@import` do Google Fonts;
   - **logo**, baixada e guardada no nosso Storage;
   - **catálogo completo**, quando a loja é Shopify — `/products.json` é público,
     então basta colar o endereço: nome, descrição, preço, moeda e imagem de cada
     produto, sem app, sem OAuth, sem chave.

   Com isso a pessoa cai direto numa tela de **revisão**, com tudo preenchido e
   editável, e conclui em um clique. Quem não tem site (ou cujo site rendeu pouco)
   segue pelo caminho de 8 etapas.

   Nada disso depende de IA: paleta, fonte, logo e catálogo são leitura pura. O
   modelo rápido só interpreta texto (descrição, segmento, tom); se ele estiver
   indisponível, o onboarding segue com tudo que foi extraído e avisa o que faltou.

   Medido contra 8 sites brasileiros reais (Shopify, VTEX, Next.js, SaaS):
   8 de 8 renderam paleta, tipografia e logo — por isso não usamos um serviço
   externo de scraping. A busca fica atrás de uma função só, então trocar por um
   renderizador com JavaScript, se algum cliente precisar, é pontual.
2. **Conversa** interpreta o pedido, consulta a memória da marca e faz no máximo
   três perguntas. Vira um briefing estruturado, validado com Zod.
3. **Confirmação explícita** do briefing. Só depois dela o sistema gera de 3 a 5
   caminhos criativos com copies — ainda sem imagem, sem crédito de imagem.
4. **Seleção dos caminhos** que merecem virar imagem. Antes de gerar, a interface
   mostra quantos créditos serão consumidos, o custo estimado, o que é mantido e
   o que é criado.
5. **Geração**: uma imagem-base por caminho. O modelo desenha só a cena — headline,
   subheadline, preço, CTA, logo e identidade são compostos pelo CreatvOS de forma
   determinística. Isso garante texto correto e adaptação barata de formato:
   4:5, 1:1 e 9:16 saem da mesma imagem, **sem nova geração**.
6. **Revisão**: aprovar, rejeitar com motivo, editar copy, trocar template, ajustar
   contraste, regenerar só a imagem ou só a copy, baixar PNG.
7. **Biblioteca** guarda tudo com origem, ângulo, copy, prompt, modelo, custo,
   formato e status. Arquivos privados, acessados por URL assinada temporária.
8. **Rotinas** repetem o trabalho no ritmo combinado. Por segurança nascem com a
   geração automática desligada: preparam o briefing e avisam.
9. **Resultados** são registrados manualmente na beta. Com amostra pequena o
   sistema fala em “sinal observado”, nunca em causalidade.

## Segurança

- RLS ativa em todas as 30 tabelas de usuário, com funções `security definer`
  para verificar membership sem recursão.
- 13 testes automatizados provam o isolamento entre dois workspaces reais:
  leitura, escrita, atualização, exclusão, Storage, quota, consumo de IA,
  escalonamento de privilégio, respostas da pesquisa e limpeza de workspace órfão.
- `/admin` exige `platform_role = 'admin'` no banco. O bloqueio na interface é
  só conveniência.
- Créditos são reservados, confirmados e devolvidos por funções SQL que só o
  service role executa. O frontend nunca decide quota.
- Operações caras usam chave de idempotência.
- Leitura de URL bloqueia localhost, faixas privadas, IPv6 interno, metadados de
  cloud e redirecionamentos para a rede interna.
- Prompts completos não aparecem nos logs nem no `/admin` por padrão.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Deploy](docs/deploy.md)
- [Custos e modelos](docs/custos-e-modelos.md)
- [Checklist de produção](docs/checklist-producao.md)
