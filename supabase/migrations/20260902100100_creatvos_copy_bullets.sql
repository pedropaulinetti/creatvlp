-- Itens curtos da copy — benefícios, sinais ou números.
--
-- São eles que preenchem os arquétipos de lista e de prova. Ficam na copy, e não
-- na composição, porque são conteúdo escrito: quem regenera a copy regenera os
-- itens junto.
alter table public.creative_copies
  add column if not exists bullets text[] not null default '{}';
