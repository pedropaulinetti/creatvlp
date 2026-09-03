# Custos e modelos

Slugs validados na API oficial do OpenRouter (`/api/v1/models`) em 24/08/2026.

## Texto

| Uso | Modelo | Entrada | Saída |
| --- | --- | --- | --- |
| Conversa, briefing, extração, resumo | `openai/gpt-5.6-luna` | US$ 0,20/M | US$ 1,20/M |
| Estratégia, ângulos, hooks, copies, recomendações | `qwen/qwen3-235b-a22b-2507` | US$ 0,087/M | US$ 0,35/M |
| Fallback da estratégia | `deepseek/deepseek-v3.2` | US$ 0,27/M | US$ 0,40/M |

O modelo rápido cuida do que é mecânico. O estratégico só entra onde a qualidade
do argumento muda o resultado.

### Como o modelo estratégico foi escolhido (02/09/2026)

Sete candidatos, rodando os **prompts reais** do CreatvOS numa marca real, medidos
por custo, latência, JSON válido em quatro rodadas, headlines distintas entre
rodadas e invenção de fato fora do contexto:

| Modelo | Custo/chamada | JSON | Distintas | Nota |
| --- | --- | --- | --- | --- |
| `qwen/qwen3-235b-a22b-2507` | US$ 0,000119 | 4/4 | 9/9 | escolhido |
| `deepseek/deepseek-v3.2` | US$ 0,000178 | 4/4 | 9/9 | fallback |
| `google/gemini-2.5-flash` | US$ 0,000874 | 4/4 | 9/9 | repete o nome do SKU em toda headline |
| `anthropic/claude-sonnet-5` | US$ 0,005086 | 4/4 | 9/9 | melhor português, 43× o preço |
| `qwen/qwen3.7-flash` | US$ 0,000397 | **0/4** | — | o mais barato, e devolve JSON inválido |
| `z-ai/glm-5.3-flash` | US$ 0,001041 | **0/1** | — | JSON inválido em 103 segundos |

Nenhum dos quatro que passaram inventou dado que não estivesse no contexto.
O Sonnet escreve o português mais natural, mas a distância é pequena e o preço é
43 vezes maior. Barato que quebra a geração não é barato — por isso o mais barato
de todos ficou de fora.

Antes desta medição, o **fallback custava mais que o modelo principal**
(`claude-sonnet-4.6`, US$ 3/15, substituindo o Sonnet 5, US$ 2/10): cair para ele
encarecia a falha. Hoje o fallback é de outro fornecedor, o que também protege de
indisponibilidade da casa — coisa que trocar Sonnet por Sonnet não fazia.

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
