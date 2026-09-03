-- As versões da mesma peça em formatos diferentes.
--
-- Cada formato é uma geração própria e vira uma linha própria em
-- creative_assets — é o que permite cobrar por desenho e não por recorte. Mas
-- para quem olha, o 4:5 e o 9:16 da mesma ideia são UMA peça em dois tamanhos,
-- não dois criativos soltos. Sem um vínculo explícito, o seletor de formato do
-- card não tem para onde ir e a biblioteca mostra a mesma ideia duas vezes.
--
-- Inferir por (direction_id, copy_id, template_key) não serve: quando a
-- quantidade pedida passa do número de copies, a mesma trinca se repete em
-- ideias diferentes.
alter table public.creative_assets
  add column if not exists grupo_id uuid;

create index if not exists creative_assets_grupo_idx
  on public.creative_assets (grupo_id) where deleted_at is null;
