# Foto de produto enviada à mão

## Problema

Produto sem foto não tem como ganhar uma.

A leitura do site traz foto quando o catálogo existe — do `/products.json` do
Shopify ou do JSON-LD da página. Fora disso, e para todo produto criado à mão,
o produto nasce sem imagem e não há nenhum lugar no app para enviar uma. Em
Minha Marca → Produtos o painel nem mostra a foto que veio do site.

Sem foto, `fotoDoProduto` em `pipeline.ts` devolve nulo e a peça inventa o
objeto — que é justamente o que não pode acontecer.

## O que muda

Um componente só, `src/components/FotoDoProduto.tsx`, que é a miniatura e o
botão de envio ao mesmo tempo. Usado no onboarding e em Minha Marca.

Três estados, todos no mesmo quadrado de 40×40, para a linha não pular de
altura entre produto com e sem foto:

| estado   | aparência                       | ação           |
| -------- | ------------------------------- | -------------- |
| com foto | miniatura                       | clicar troca   |
| sem foto | quadrado tracejado com `⊕`      | clicar envia   |
| enviando | mesmo quadrado, desabilitado    | nenhuma        |

### De onde vem a imagem exibida

Nesta ordem:

1. URL assinada de `imagePath` — a nossa cópia no Storage;
2. o arquivo recém-enviado (`URL.createObjectURL`), que cobre a janela entre o
   envio e a URL assinada chegar;
3. `imageUrl` — o endereço na origem, que só existe como prévia antes de gravar.

A nossa cópia vence a origem de propósito. Além de ser o certo depois de um
envio manual, corrige um defeito que já existia: a miniatura do onboarding só
usava o endereço de origem e sumia em silêncio se o CDN bloqueasse hotlink,
mesmo com a foto já guardada.

### Onboarding

`CartaoDeConfirmacao` troca a `MiniaturaDoProduto` — que só renderizava quando
havia `imageUrl` — pelo componente novo, que aparece sempre. O envio segue o
caminho já usado pelo logo: a página é quem tem `workspaceId`, então recebe um
`aoEnviarFotoDeProduto(indice, arquivo)` e grava `imagePath` no rascunho.
`salvarMarca` já persiste esse campo.

### Minha Marca

`ProductsSection` ganha o mesmo componente na linha do nome. O envio grava
`image_path` pela mutation `update` que já existe.

## Restrições

O bucket `product-assets` aceita PNG, JPG, WEBP e AVIF, até 10 MB — SVG não.
O `accept` do input e a validação vão com `allowSvg: false`.

O caminho é o canônico do projeto, o mesmo que a Edge Function usa:
`{workspace_id}/{brand_id}/produto/{uuid}.{ext}`.

## Fora de escopo

Remover a foto. Trocar cobre o caso, e a política de "envio de arquivo é
exceção no onboarding" fica menos arranhada com uma affordance só.

## Testes

Teste de componente para os três estados e para a precedência: com `imagePath`
e `imageUrl` juntos, mostra o assinado.
