-- Quais referências visuais entram na peça.
--
-- `referenciasDeEstilo` pega três com `limit(3)` e nenhuma ordenação: quais
-- três é o que o Postgres devolver, e muda sem aviso. Como elas definem luz e
-- clima da geração, isso é a diferença entre a peça sair com a cara da marca
-- ou com a cara de um banner promocional que estava no rodapé do site.
--
-- Com posição, a escolha passa a ser de quem cuida da marca.
alter table public.brand_assets
  add column if not exists position int not null default 0;

create index if not exists brand_assets_ordem
  on public.brand_assets (brand_id, kind, position) where deleted_at is null;
