-- CreatvOS · campanhas: conversa, briefing, direções, copies e criativos.

do $$ begin create type public.campaign_status as enum
  ('rascunho','em_briefing','briefing_confirmado','gerando','revisao','aprovada','arquivada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.creative_status as enum
  ('rascunho','gerando','revisao','aprovado','rejeitado','publicado','arquivado','falhou'); exception when duplicate_object then null; end $$;
do $$ begin create type public.direction_status as enum
  ('proposta','selecionada','aprovada','rejeitada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.message_role as enum ('user','assistant','system'); exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- folders
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  parent_id uuid references public.folders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint folders_not_self_parent check (parent_id is null or parent_id <> id)
);

create unique index if not exists folders_unique_name
  on public.folders (workspace_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at before update on public.folders
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  objective text not null default '',
  status public.campaign_status not null default 'rascunho',
  channel text,
  occasion_date date,
  origin text not null default 'conversa' check (origin in ('conversa','rotina','duplicada')),
  routine_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists campaigns_workspace_idx on public.campaigns (workspace_id, status) where deleted_at is null;
create index if not exists campaigns_brand_idx on public.campaigns (brand_id, created_at desc) where deleted_at is null;

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

-- --------------------------------------------------------- conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null default 'Nova campanha',
  status text not null default 'aberta' check (status in ('aberta','briefing','concluida','cancelada')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_workspace_idx on public.conversations (workspace_id, updated_at desc);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null default '',
  payload jsonb,
  model text,
  tokens_in int not null default 0 check (tokens_in >= 0),
  tokens_out int not null default 0 check (tokens_out >= 0),
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_idx on public.conversation_messages (conversation_id, created_at);

-- --------------------------------------------------------- campaign_briefs
create table if not exists public.campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version int not null default 1 check (version > 0),
  payload jsonb not null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, version)
);

drop trigger if exists campaign_briefs_set_updated_at on public.campaign_briefs;
create trigger campaign_briefs_set_updated_at before update on public.campaign_briefs
for each row execute function public.set_updated_at();

-- ----------------------------------------------------- creative_directions
create table if not exists public.creative_directions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  position int not null default 0,
  name text not null,
  hypothesis text not null default '',
  problem text not null default '',
  promise text not null default '',
  hook text not null default '',
  mechanism text not null default '',
  proof text not null default '',
  objection text not null default '',
  cta text not null default '',
  visual_prompt text not null default '',
  rationale text not null default '',
  status public.direction_status not null default 'proposta',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_directions_campaign_idx on public.creative_directions (campaign_id, position);

drop trigger if exists creative_directions_set_updated_at on public.creative_directions;
create trigger creative_directions_set_updated_at before update on public.creative_directions
for each row execute function public.set_updated_at();

create table if not exists public.creative_copies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  direction_id uuid not null references public.creative_directions(id) on delete cascade,
  variant_index int not null default 0 check (variant_index >= 0),
  headline text not null default '',
  subheadline text not null default '',
  body text not null default '',
  cta text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (direction_id, variant_index)
);

drop trigger if exists creative_copies_set_updated_at on public.creative_copies;
create trigger creative_copies_set_updated_at before update on public.creative_copies
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- templates
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  layout jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists templates_global_key on public.templates (key) where workspace_id is null;
create unique index if not exists templates_workspace_key on public.templates (workspace_id, key) where workspace_id is not null;

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before update on public.templates
for each row execute function public.set_updated_at();

-- -------------------------------------------------------- creative_assets
create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  direction_id uuid references public.creative_directions(id) on delete set null,
  copy_id uuid references public.creative_copies(id) on delete set null,
  folder_id uuid references public.folders(id) on delete set null,
  template_key text not null default 'produto-destaque',
  status public.creative_status not null default 'rascunho',
  format text not null default '4:5' check (format in ('1:1','4:5','9:16')),
  bucket text not null default 'creative-assets',
  base_path text,
  render_path text,
  composition jsonb not null default '{}'::jsonb,
  visual_prompt text not null default '',
  model text,
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  is_favorite boolean not null default false,
  rejection_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists creative_assets_workspace_idx on public.creative_assets (workspace_id, status, created_at desc) where deleted_at is null;
create index if not exists creative_assets_campaign_idx on public.creative_assets (campaign_id) where deleted_at is null;
create index if not exists creative_assets_folder_idx on public.creative_assets (folder_id) where deleted_at is null;

drop trigger if exists creative_assets_set_updated_at on public.creative_assets;
create trigger creative_assets_set_updated_at before update on public.creative_assets
for each row execute function public.set_updated_at();

create table if not exists public.creative_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.creative_assets(id) on delete cascade,
  format text not null check (format in ('1:1','4:5','9:16')),
  bucket text not null default 'creative-assets',
  render_path text,
  composition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, format)
);

drop trigger if exists creative_variants_set_updated_at on public.creative_variants;
create trigger creative_variants_set_updated_at before update on public.creative_variants
for each row execute function public.set_updated_at();

-- --------------------------------------------------------- templates seed
insert into public.templates (workspace_id, key, name, description, layout, is_default) values
  (null,'produto-destaque','Produto em destaque','Produto grande, headline curta e CTA sólido.','{"headline":{"x":6,"y":62,"size":7.5,"weight":600,"align":"left"},"sub":{"x":6,"y":74,"size":3.6},"cta":{"x":6,"y":86,"style":"solid"},"logo":{"x":6,"y":6,"size":8},"scrim":"bottom"}'::jsonb,true),
  (null,'beneficio-principal','Benefício principal','Uma promessa só, tipografia grande.','{"headline":{"x":8,"y":30,"size":9,"weight":600,"align":"left"},"sub":{"x":8,"y":50,"size":3.8},"cta":{"x":8,"y":82,"style":"outline"},"logo":{"x":8,"y":8,"size":8},"scrim":"left"}'::jsonb,false),
  (null,'prova-social','Prova social','Depoimento em destaque com selo de credibilidade.','{"headline":{"x":8,"y":24,"size":6,"weight":500,"align":"left","quote":true},"sub":{"x":8,"y":62,"size":3.4},"cta":{"x":8,"y":84,"style":"solid"},"logo":{"x":8,"y":8,"size":7},"scrim":"full"}'::jsonb,false),
  (null,'comparacao','Comparação','Antes e depois, dois blocos.','{"headline":{"x":6,"y":8,"size":6,"weight":600,"align":"center"},"split":true,"sub":{"x":6,"y":78,"size":3.4},"cta":{"x":6,"y":88,"style":"solid"},"logo":{"x":6,"y":92,"size":6},"scrim":"none"}'::jsonb,false),
  (null,'oferta','Oferta','Preço e condição em evidência.','{"headline":{"x":6,"y":56,"size":7,"weight":600,"align":"left"},"price":{"x":6,"y":70,"size":11,"weight":700},"sub":{"x":6,"y":80,"size":3.4},"cta":{"x":6,"y":88,"style":"solid"},"logo":{"x":6,"y":6,"size":8},"scrim":"bottom"}'::jsonb,false),
  (null,'editorial','Editorial','Imagem limpa, texto discreto no rodapé.','{"headline":{"x":8,"y":80,"size":5,"weight":400,"align":"left"},"sub":{"x":8,"y":88,"size":3.2},"cta":{"x":8,"y":93,"style":"link"},"logo":{"x":8,"y":8,"size":7},"scrim":"bottom-soft"}'::jsonb,false),
  (null,'story-cta','Story com CTA','Vertical, CTA fixo na base segura.','{"headline":{"x":8,"y":58,"size":8,"weight":600,"align":"left"},"sub":{"x":8,"y":72,"size":3.6},"cta":{"x":8,"y":84,"style":"solid","full":true},"logo":{"x":8,"y":10,"size":8},"scrim":"bottom"}'::jsonb,false)
on conflict do nothing;

alter table public.templates enable row level security;
drop policy if exists "templates visíveis" on public.templates;
create policy "templates visíveis" on public.templates
for select to authenticated
using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists "templates do workspace" on public.templates;
create policy "templates do workspace" on public.templates
for all to authenticated
using (workspace_id is not null and public.is_workspace_admin(workspace_id))
with check (workspace_id is not null and public.is_workspace_admin(workspace_id));

grant select, insert, update, delete on table public.templates to authenticated;

select public.apply_workspace_rls('folders');
select public.apply_workspace_rls('campaigns');
select public.apply_workspace_rls('conversations');
select public.apply_workspace_rls('conversation_messages');
select public.apply_workspace_rls('campaign_briefs');
select public.apply_workspace_rls('creative_directions');
select public.apply_workspace_rls('creative_copies');
select public.apply_workspace_rls('creative_assets');
select public.apply_workspace_rls('creative_variants');
