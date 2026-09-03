-- Arquétipos de criativo.
--
-- Os sete templates originais diferiam só em coordenada: a mesma coluna de
-- texto em alturas diferentes, com a fotografia atrás. Nove peças pareciam três.
--
-- Estes cinco são formas diferentes de anunciar, tiradas das referências reais
-- separadas para o produto: o bloco de cor da Insider, o listicle de "5 sinais",
-- a manchete de jornal, o painel de números do Dr. Squatch e a headline com
-- palavra destacada. O campo "arquetipo" diz ao renderizador qual desenhar.
--
-- Idempotente, como as demais.

update public.templates set layout = layout || '{"arquetipo":"coluna"}'::jsonb
where workspace_id is null and not (layout ? 'arquetipo');

insert into public.templates (workspace_id, key, name, description, layout, is_default) values
  (null,'bloco-oferta','Bloco de oferta',
   'Fundo sólido, tipografia enorme, benefícios marcados e a foto num recorte.',
   '{"arquetipo":"bloco","logo":{"x":7,"y":7,"size":8}}'::jsonb,false),

  (null,'listicle','Lista numerada',
   'Título em cima e até cinco itens numerados sobre a fotografia.',
   '{"arquetipo":"listicle","logo":{"x":8,"y":8,"size":8}}'::jsonb,false),

  (null,'manchete','Manchete',
   'Faixa de notícia, manchete em cima e a fotografia embaixo com legenda.',
   '{"arquetipo":"manchete","logo":{"x":7,"y":90,"size":7}}'::jsonb,false),

  (null,'numeros','Números',
   'Foto de um lado, três números grandes do outro. Prova em vez de promessa.',
   '{"arquetipo":"numeros","logo":{"x":7,"y":90,"size":7}}'::jsonb,false),

  (null,'palavra-destaque','Palavra em destaque',
   'Fotografia inteira e headline centralizada com a palavra que importa em cor.',
   '{"arquetipo":"destaque","logo":{"x":6,"y":6,"size":8}}'::jsonb,false)
on conflict do nothing;
