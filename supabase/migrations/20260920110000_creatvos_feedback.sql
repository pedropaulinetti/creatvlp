-- CreatvOS · caixa de sugestões da beta.
-- Quem está testando escreve de dentro do produto, e o admin lê no mesmo lugar
-- onde já acompanha jobs e custos. Idempotente, como as demais.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'sugestao' check (kind in ('sugestao','problema','elogio')),
  message text not null check (length(btrim(message)) between 3 and 4000),
  path text not null default '',
  context jsonb not null default '{}'::jsonb,
  status text not null default 'aberto' check (status in ('aberto','lido','resolvido')),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- PostgREST só embute o perfil do autor se existir FK para profiles.
do $$ begin
  alter table public.feedback
    add constraint feedback_author_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "enviar sugestão" on public.feedback;
create policy "enviar sugestão" on public.feedback
for insert to authenticated
with check (
  user_id = auth.uid()
  and (workspace_id is null or public.is_workspace_member(workspace_id))
);

drop policy if exists "ler sugestões" on public.feedback;
create policy "ler sugestões" on public.feedback
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "admin trata sugestão" on public.feedback;
create policy "admin trata sugestão" on public.feedback
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select, insert, update on table public.feedback to authenticated;
