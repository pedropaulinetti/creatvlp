-- Mais de uma foto por produto, e a fonte da marca como arquivo.
--
-- `products.image_path` guardava uma foto só. Um produto tem frente, verso,
-- embalagem e uso — e a peça fica melhor quando o modelo vê mais de um ângulo
-- do mesmo objeto. A coluna continua existindo e passa a significar "a foto
-- principal": é ela que vai primeiro para a geração, e o resto acompanha.
--
-- Manter a coluna, em vez de migrar tudo para a tabela nova, evita reescrever
-- `fotoDoProduto` e todo o onboarding de uma vez — e deixa claro qual foto
-- manda quando o teto de quatro referências do provedor obriga a escolher.

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  bucket text not null default 'product-assets',
  /** Ordem de exibição e de envio ao modelo. A principal é a de posição 0. */
  position int not null default 0,
  label text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, position) where deleted_at is null;

create unique index if not exists product_images_unicas
  on public.product_images (product_id, storage_path) where deleted_at is null;

-- As fotos que já existem viram a posição 0, sem duplicar quem já foi migrado.
insert into public.product_images (workspace_id, product_id, storage_path, position)
select p.workspace_id, p.id, p.image_path, 0
from public.products p
where p.image_path is not null
  and p.deleted_at is null
  and not exists (
    select 1 from public.product_images i
    where i.product_id = p.id and i.storage_path = p.image_path and i.deleted_at is null
  );

alter table public.product_images enable row level security;

drop policy if exists "imagens do produto" on public.product_images;
create policy "imagens do produto" on public.product_images
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on table public.product_images to authenticated;

-- ---------------------------------------------------------------- tipografia
--
-- O arquivo da fonte não é usado pelo modelo de imagem — ele desenha as letras,
-- não renderiza um .woff2. O que vai para o prompt é o NOME da família, e é
-- justamente por isso que guardar o arquivo vale: dele se lê o nome exato, em
-- vez de depender de alguém digitar "Poppins" sem errar.
--
-- Guardado junto do resto da identidade, no bucket da marca.
alter table public.brand_assets
  drop constraint if exists brand_assets_kind_check;

alter table public.brand_assets
  add constraint brand_assets_kind_check
  check (kind in ('logo','logo_variacao','referencia','exemplo_aprovado','exemplo_rejeitado','fonte'));

-- Fonte é arquivo binário, não imagem: o bucket precisa aceitar o tipo.
update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/svg+xml','image/avif',
  'font/woff','font/woff2','font/ttf','font/otf',
  'application/font-woff','application/x-font-ttf','application/x-font-opentype',
  'application/octet-stream'
]
where id = 'brand-assets';
