# Custos e modelos

Slugs validados na API oficial do OpenRouter (`/api/v1/models`) em 24/08/2026.

## Texto

| Uso | Modelo | Entrada | Saída |
| --- | --- | --- | --- |
| Conversa, briefing, extração, resumo | `openai/gpt-5.6-luna` | US$ 0,20/M | US$ 1,20/M |
| Estratégia, ângulos, hooks, copies, recomendações | `anthropic/claude-sonnet-5` | US$ 2,00/M | US$ 10,00/M |
| Fallback da estratégia | `anthropic/claude-sonnet-4.6` | US$ 3,00/M | US$ 15,00/M |

O modelo rápido cuida do que é mecânico. O estratégico só entra onde a qualidade
do argumento muda o resultado.

## Imagem

**O `bytedance-seed/seedream-4.5` pedido na especificação não existe no catálogo
do OpenRouter** — nenhum modelo Seedream está disponível lá. A verificação foi
feita contra a API oficial, como a própria especificação manda.

No lugar, três níveis selecionáveis a cada geração. Todos aceitam imagem de
entrada, necessária para referências de produto e identidade.

| Nível | Modelo | Custo por imagem | Quando usar |
| --- | --- | --- | --- |
| Rascunho | `google/gemini-2.5-flash-image` | ~US$ 0,039 | varrer muitos ângulos rápido |
| Padrão | `google/gemini-3.1-flash-image` | ~US$ 0,077 | maior parte dos testes |
| Alta | `google/gemini-3-pro-image` | ~US$ 0,155 | a peça que vai rodar com verba |

Uma imagem do Gemini custa 1.290 tokens de saída; o custo acima é esse número
multiplicado pelo preço por token do modelo. O valor exibido na interface é uma
**estimativa**: o custo real vem no campo `usage.cost` da resposta e é gravado em
`ai_usage_events`.

O nível é escolhido na hora de gerar e na hora de regenerar, com o preço à vista.
Trocar formato, texto, template ou contraste **não gera imagem nova** e portanto
não custa nada.

## Custo por plano, no pior caso

Considerando o teto de imagens do ciclo e nenhum uso de rascunho:

| Plano | Imagens/mês | Rascunho | Padrão | Alta |
| --- | --- | --- | --- | --- |
| Beta | 40 | US$ 1,56 | US$ 3,08 | US$ 6,20 |
| Growth | 150 | US$ 5,85 | US$ 11,55 | US$ 23,25 |
| Studio | 400 | US$ 15,60 | US$ 30,80 | US$ 62,00 |

O texto pesa pouco perto disso: uma campanha completa (conversa + 4 caminhos com
3 copies cada) fica na casa de poucos centavos de dólar.

## Onde os slugs vivem

Todos em `supabase/functions/_shared/config.ts`, lidos de variáveis de ambiente.
Nenhum slug aparece espalhado pelo código. Para trocar de modelo basta atualizar
o segredo correspondente — não é preciso publicar de novo.

## Como o custo é registrado

Cada chamada grava em `ai_usage_events`: modelo realmente usado, tokens de
entrada e saída, imagens, custo real devolvido pela API, latência e status.
O `/admin` agrega por modelo e por cliente através de
`admin_cost_by_model` e `admin_cost_by_workspace`, que só admin de plataforma
consegue executar.
