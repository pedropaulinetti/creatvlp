-- CreatvOS · marca: memória de marca, versões, ativos, produtos e públicos.

-- Gerador de políticas padrão para tabelas com workspace_id.
create or replace function public.apply_workspace_rls(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists "ws_select" on public.%I', p_table);
  execute format(
    'create policy "ws_select" on public.%I for select to authenticated
       using (public.is_workspace_member(workspace_id) or public.is_platform_admin())', p_table);

  execute format('drop policy if exists "ws_insert" on public.%I', p_table);
  execute format(
    'create policy "ws_insert" on public.%I for insert to authenticated
       with check (public.is_workspace_member(workspace_id))', p_table);

  execute format('drop policy if exists "ws_update" on public.%I', p_table);
  execute format(
    'create policy "ws_update" on public.%I for update to authenticated
       using (public.is_workspace_member(workspace_id))
       with check (public.is_workspace_member(workspace_id))', p_table);

  execute format('drop policy if exists "ws_delete" on public.%I', p_table);
  execute format(
    'create policy "ws_delete" on public.%I for delete to authenticated
       using (public.is_workspace_admin(workspace_id))', p_table);

  execute format('grant select, insert, update, delete on table public.%I to authenticated', p_table);
end;
$$;

-- ----------------------------------------------------------------- brands
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  website text,
  segment text,
  voice_tone text not null default '',
  voice_notes text not null default '',
  recommended_words text[] not null default '{}',
  forbidden_words text[] not null default '{}',
  forbidden_promises text[] not null default '{}',
  differentiators text[] not null default '{}',
  competitors jsonb not null default '[]'::jsonb,
  proofs jsonb not null default '[]'::jsonb,
  recurring_offers jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  channels text[] not null default '{}',
  formats text[] not null default '{}',
  cadence text,
  logo_path text,
  completeness int not null default 0 check (completeness between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists brands_workspace_idx on public.brands (workspace_id) where deleted_at is null;

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at before update on public.brands
for each row execute function public.set_updated_at();

create table if not exists public.brand_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  snapshot jsonb not null,
  change_summary text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists brand_versions_brand_idx on public.brand_versions (brand_id, created_at desc);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('logo','logo_variacao','referencia','exemplo_aprovado','exemplo_rejeitado')),
  storage_path text not null,
  bucket text not null default 'brand-assets',
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  label text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);

create index if not exists brand_assets_brand_idx on public.brand_assets (brand_id, kind) where deleted_at is null;

-- --------------------------------------------------------------- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  price_cents bigint check (price_cents is null or price_cents >= 0),
  currency text not null default 'BRL',
  url text,
  highlights text[] not null default '{}',
  image_path text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists products_brand_idx on public.products (brand_id) where deleted_at is null;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- audiences
create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  pains text[] not null default '{}',
  desires text[] not null default '{}',
  objections text[] not null default '{}',
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audiences_brand_idx on public.audiences (brand_id);

drop trigger if exists audiences_set_updated_at on public.audiences;
create trigger audiences_set_updated_at before update on public.audiences
for each row execute function public.set_updated_at();

-- ------------------------------------------------- histórico automático
create or replace function public.record_brand_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_jsonb(old) - 'updated_at' is distinct from to_jsonb(new) - 'updated_at' then
    insert into public.brand_versions (workspace_id, brand_id, snapshot, change_summary, created_by)
    values (old.workspace_id, old.id, to_jsonb(old), 'Alteração na memória de marca', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists brands_record_version on public.brands;
create trigger brands_record_version before update on public.brands
for each row execute function public.record_brand_version();

select public.apply_workspace_rls('brands');
select public.apply_workspace_rls('brand_versions');
select public.apply_workspace_rls('brand_assets');
select public.apply_workspace_rls('products');
select public.apply_workspace_rls('audiences');
