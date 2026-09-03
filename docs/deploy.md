# Deploy

## Onde cada coisa roda

| Parte | Onde |
| --- | --- |
| Frontend | Vercel (projeto `creatvlp`, domínio `creatv.com.br`) |
| Banco, Auth, Storage | Supabase |
| Edge Functions | Supabase |
| Agendamento | `pg_cron` + `pg_net` dentro do Supabase |

## 1. Migrations

São 14 arquivos idempotentes (as 4 originais da pesquisa continuam lá) em `supabase/migrations/`, seguros para reaplicar.

Com um token no formato antigo (`sbp_` + 40 caracteres):

```bash
supabase link --project-ref <REF>
supabase db push
```

O CLI 2.115 ainda recusa tokens no formato novo (`sbp_v0_`) com
`LegacyInvalidAccessTokenError`. Nesse caso, aplique pela Management API:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_v0_...
for f in supabase/migrations/*.sql; do
  python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' "$f" \
  | curl -s -X POST "https://api.supabase.com/v1/projects/<REF>/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" --data-binary @- > /dev/null \
  && echo "aplicada $(basename $f)"
done
```

A API recusa escrever em `supabase_migrations.schema_migrations`. Se você aplicar
por ela, rode depois `supabase migration repair --status applied <versão>` para o
CLI ficar em dia — ou simplesmente deixe como está: as migrations são idempotentes.

## 2. Buckets

Criados pela migration `20260824120500_creatvos_storage.sql`: `brand-assets`,
`product-assets`, `creative-assets` e `campaign-exports`, todos **privados**, com
limite de tamanho e lista de MIME types. As políticas do Storage espelham as do
banco: o primeiro segmento do caminho é o `workspace_id`, e só membro daquele
workspace lê ou escreve.

## 2b. Rodando os testes ponta a ponta

O servidor local de funções lê `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` — sem o prefixo `VITE_`. Tendo as três no
`.env.local`:

```bash
set -a && . ./.env.local && set +a
npm run test:e2e
```

Faltando qualquer uma, as funções respondem `Supabase não configurado na Edge
Function` e o teste falha sem explicar a causa.

## 3. Edge Functions

```bash
export SUPABASE_ACCESS_TOKEN=...
export PROJECT_REF=<REF>
npm run functions:deploy              # todas
npm run functions:deploy generate-image   # uma só
```

`run-routines` sobe com `verify_jwt = false` porque é chamada pelo cron; ela
valida o `CRON_SECRET` ou o service role por conta própria. Todas as outras
exigem JWT de usuário.

## 4. Segredos

```bash
curl -X POST "https://api.supabase.com/v1/projects/<REF>/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"name":"OPENROUTER_API_KEY","value":"sk-or-v1-..."}]'
```

A lista completa está no README. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente.

## 5. Cron

A migration `20260824120700_creatvos_cron.sql` agenda `creatvos-run-routines` a
cada 15 minutos. Ela depende de dois segredos no Vault:

```sql
select vault.create_secret('https://<REF>.supabase.co/functions/v1', 'creatvos_functions_url', '');
select vault.create_secret('<CRON_SECRET>', 'creatvos_cron_secret', '');
```

Sem eles a função registra um aviso e não faz nada — o agendamento nunca dispara
uma chamada sem credencial. Para conferir:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
```

## 6. Autenticação

No painel do Supabase, em Authentication → URL Configuration:

- **Site URL**: `https://www.creatv.com.br`
- **Redirect URLs**: `https://www.creatv.com.br/**`, `https://creatv.com.br/**` e
  `http://localhost:5173/**` para desenvolvimento.

Sem os curingas os links de recuperação de senha e de confirmação de e-mail
falham silenciosamente.

> **Antes de abrir a beta:** o projeto usa o SMTP embutido do Supabase, limitado a
> poucos e-mails por hora. Configure um SMTP próprio (Resend, por exemplo) em
> Authentication → SMTP Settings, ou cadastro e recuperação vão falhar assim que
> mais de duas pessoas entrarem na mesma hora.

## 7. Frontend

O `vercel.json` já reescreve tudo que não é arquivo para `index.html`, o que faz
o React Router funcionar em rota profunda.

Variáveis no Vercel (Production e Preview):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

```bash
npm run build      # type-check + build
vercel --prod
```

## 8. Verificação pós-deploy

```bash
# 1. sem autenticação deve dar 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://<REF>.supabase.co/functions/v1/campaign-chat" -d '{}'

# 2. nenhum segredo no bundle
npm run build && grep -ri "openrouter\|service_role\|sk-or-v1" dist/ && echo VAZOU || echo limpo

# 3. isolamento entre workspaces
npm run test:rls

# 4. fluxo crítico
npm run test:e2e
```

## Rollback

- **Frontend**: promover o deploy anterior no Vercel.
- **Edge Function**: republicar a versão anterior com `npm run functions:deploy <slug>`.
- **Banco**: as migrations não têm `down`. Reverter exige uma migration nova,
  escrita para o caso. Nenhuma delas apaga dado de usuário.
