# Checklist de produção

## Pronto

- [x] Landing (`/`) e pesquisa (`/pesquisa`) funcionando, intocadas, tema escuro preservado
- [x] Respostas da pesquisa preservadas e acessíveis no `/admin`
- [x] Cadastro, login, logout, recuperação de senha e persistência de sessão
- [x] Perfil, workspace, membership e quota criados automaticamente no cadastro
- [x] Onboarding começa pelo site e cai numa confirmação única; sem site, a conversa com a IA cobre
- [x] Endereço aceito sem `https://`, com `www.`, com espaços ou em maiúsculas
- [x] Colar o endereço dispara a leitura automaticamente
- [x] Firecrawl como leitor de reserva, acionado só quando a página vem vazia
- [x] Paleta, tipografia e logo extraídas do CSS do site e importadas
- [x] Catálogo importado direto do Shopify (`/products.json`, sem autenticação)
- [x] Extração funciona sem chave de IA; só a leitura de texto depende do modelo
- [x] Minha marca editável, com completude e histórico de versões
- [x] Campanha criada por conversa, com briefing estruturado validado por Zod
- [x] Confirmação explícita antes de qualquer geração
- [x] 3 a 5 caminhos criativos com hipótese, hook, mecanismo, prova, objeção e copies
- [x] Imagem-base gerada só depois da seleção, com custo à vista
- [x] Composição determinística: texto, logo, preço e CTA aplicados pelo CreatvOS
- [x] Adaptação 4:5, 1:1 e 9:16 sem nova geração
- [x] Sete templates iniciais
- [x] Aprovar, rejeitar com motivo, editar copy, trocar template, regenerar, baixar PNG
- [x] Biblioteca com grade, lista, pastas, busca, filtros, favoritos, lote, ZIP e lixeira
- [x] Arquivos privados com URL assinada temporária
- [x] Rotinas com frequência, timezone, execução manual, histórico e proteção contra duplicidade
- [x] `auto_generate` desligado por padrão; imagem exige autorização explícita e saldo
- [x] Cron a cada 15 minutos, idempotente
- [x] Resultados manuais com métricas derivadas e linguagem honesta sobre amostra
- [x] Recomendação de próximo teste, gravada como aprendizado da marca
- [x] `/admin` protegido por role no banco, com jobs, custos, workspaces, auditoria e pesquisa
- [x] Quotas verificadas no servidor; reserva, confirmação e devolução de crédito
- [x] Idempotência nas operações caras
- [x] RLS em todas as 30 tabelas, com 13 testes de isolamento entre dois usuários reais
- [x] OpenRouter chamado exclusivamente em Edge Function
- [x] Nenhuma chave secreta no bundle
- [x] Build de produção passa
- [x] 154 testes unitários + 27 ponta a ponta (desktop e 375 px)
- [x] Sem erros de console nas telas do app
- [x] Redirect URLs do Auth corrigidas (antes só `/admin` era permitido)
- [x] Workspace órfão removido automaticamente quando o último membro sai
- [x] Chaves estrangeiras para `profiles`, que faltavam e quebravam duas telas
- [x] **SMTP próprio (Resend) e e-mails de autenticação.** `smtp.resend.com:465`
      enviando de `nao-responda@mail.creatv.com.br`. Cadastro e recuperação de senha
      mandam código de 6 dígitos válido por 10 minutos, sem link mágico. Os templates
      são versionados em `scripts/configure-auth-emails.mjs` (`npm run auth:emails`).

## Antes de abrir a beta

- [ ] **Configurar `OPENROUTER_API_KEY`** nos segredos da Edge Function.
      Sem ela nenhuma geração real acontece. Todo o resto já está publicado e testado.
- [ ] Rodar `npm run test:e2e` apontando para o projeto de produção
- [ ] Definir quem são os administradores de plataforma:
      `update public.profiles set platform_role = 'admin' where email = '...'`
- [ ] Revisar os limites dos planos em `public.plans` antes do primeiro cliente pagante
- [ ] Confirmar o fuso das rotinas com um cliente real antes de ligar `auto_generate`

## Deixado de fora de propósito

- **Cobrança com Stripe.** O domínio está preparado (planos, quotas, ledger,
  créditos), mas não há integração de pagamento — foi o combinado.
- **Integração com Meta Ads.** Existe uma área marcada como “em breve” em Rotinas,
  sem dado falso e sem simulação de conexão. Os resultados são registrados
  manualmente até ela existir.
- **E-mail transacional de produto via Resend.** A Resend já manda os códigos de
  autenticação, mas as notificações internas (rotina concluída, crédito acabando)
  continuam só dentro do app. A aplicação não depende de e-mail para operar.
- **Convite de membros por e-mail.** O modelo de dados suporta múltiplos membros;
  a tela de convite chega depois da beta.

## Limitações conhecidas

- O CLI do Supabase (2.115) recusa tokens `sbp_v0_`. Migrations, tipos e deploy de
  funções usam a Management API; os scripts em `scripts/` fazem isso.
- O teste de cadastro cobre a validação do formulário, não o envio real de e-mail:
  conferir um código de seis dígitos exige ler a caixa de entrada. A criação de
  conta de verdade é exercitada pelo teste de RLS.
- A geração de imagem é sequencializada por campanha em no máximo 5 caminhos por
  chamada, para caber no tempo de execução da Edge Function.
