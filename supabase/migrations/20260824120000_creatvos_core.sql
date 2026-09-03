-- CreatvOS · núcleo: identidade, workspaces, membership, planos e quotas.
-- Idempotente: pode ser reaplicada com segurança.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums
do $$ begin create type public.member_role as enum ('owner','admin','member'); exception when duplicate_object then null; end $$;
do $$ begin create type public.platform_role as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.plan_key as enum ('beta','growth','studio'); exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- utilidades
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  platform_role public.platform_role not null default 'user',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ plans
create table if not exists public.plans (
  key public.plan_key primary key,
  name text not null,
  brands_limit int not null check (brands_limit >= 0),
  members_limit int not null check (members_limit >= 0),
  campaigns_limit int not null check (campaigns_limit >= 0),
  images_limit int not null check (images_limit >= 0),
  auto_routines boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans (key, name, brands_limit, members_limit, campaigns_limit, images_limit, auto_routines, features) values
  ('beta','Beta',1,2,4,40,false,'["Rotinas","Biblioteca","Suporte assistido"]'::jsonb),
  ('growth','Growth',3,5,15,150,true,'["Rotinas automáticas","Biblioteca","Suporte assistido"]'::jsonb),
  ('studio','Studio',10,15,40,400,true,'["Rotinas automáticas","Biblioteca","Suporte assistido","Múltiplas marcas"]'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  brands_limit = excluded.brands_limit,
  members_limit = excluded.members_limit,
  campaigns_limit = excluded.campaigns_limit,
  images_limit = excluded.images_limit,
  auto_routines = excluded.auto_routines,
  features = excluded.features;

-- ------------------------------------------------------------- workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  plan public.plan_key not null default 'beta',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- ------------------------------------------------------ funções de acesso
-- SECURITY DEFINER: consultam membership sem disparar RLS (evita recursão).
create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(p_workspace uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = p_workspace and m.user_id = auth.uid();
$$;

create or replace function public.is_workspace_admin(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.platform_role = 'admin'
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- ----------------------------------------------------------------- quotas
create table if not exists public.usage_quotas (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan public.plan_key not null default 'beta',
  period_start date not null default date_trunc('month', now())::date,
  period_end date not null default (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  campaigns_used int not null default 0 check (campaigns_used >= 0),
  images_used int not null default 0 check (images_used >= 0),
  campaigns_reserved int not null default 0 check (campaigns_reserved >= 0),
  images_reserved int not null default 0 check (images_reserved >= 0),
  bonus_images int not null default 0 check (bonus_images >= 0),
  bonus_campaigns int not null default 0 check (bonus_campaigns >= 0),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

drop trigger if exists usage_quotas_set_updated_at on public.usage_quotas;
create trigger usage_quotas_set_updated_at before update on public.usage_quotas
for each row execute function public.set_updated_at();

-- --------------------------------------------- provisionamento no cadastro
create or replace function public.provision_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_workspace uuid;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'pessoa'), '@', 1)
  );

  insert into public.profiles (id, full_name, email)
  values (new.id, v_name, new.email)
  on conflict (id) do update set email = excluded.email;

  select w.id into v_workspace
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where m.user_id = new.id
  limit 1;

  if v_workspace is null then
    insert into public.workspaces (name, owner_id, created_by)
    values (left(v_name, 60) || ' · Workspace', new.id, new.id)
    returning id into v_workspace;

    insert into public.workspace_members (workspace_id, user_id, role, created_by)
    values (v_workspace, new.id, 'owner', new.id)
    on conflict do nothing;

    insert into public.usage_quotas (workspace_id, plan)
    values (v_workspace, 'beta')
    on conflict (workspace_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.provision_new_user();

-- -------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.usage_quotas enable row level security;
alter table public.plans enable row level security;

drop policy if exists "perfil próprio é visível" on public.profiles;
create policy "perfil próprio é visível" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

drop policy if exists "perfil próprio pode ser editado" on public.profiles;
create policy "perfil próprio pode ser editado" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and platform_role = (select p.platform_role from public.profiles p where p.id = auth.uid()));

drop policy if exists "workspaces do usuário" on public.workspaces;
create policy "workspaces do usuário" on public.workspaces
for select to authenticated
using (public.is_workspace_member(id) or public.is_platform_admin());

drop policy if exists "admin do workspace edita" on public.workspaces;
create policy "admin do workspace edita" on public.workspaces
for update to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id) and plan = (select w.plan from public.workspaces w where w.id = workspaces.id));

drop policy if exists "membros visíveis para o workspace" on public.workspace_members;
create policy "membros visíveis para o workspace" on public.workspace_members
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

drop policy if exists "admin gerencia membros" on public.workspace_members;
create policy "admin gerencia membros" on public.workspace_members
for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "quota visível para o workspace" on public.usage_quotas;
create policy "quota visível para o workspace" on public.usage_quotas
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

drop policy if exists "planos são públicos para autenticados" on public.plans;
create policy "planos são públicos para autenticados" on public.plans
for select to authenticated using (true);

grant select on table public.plans to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select on table public.usage_quotas to authenticated;
