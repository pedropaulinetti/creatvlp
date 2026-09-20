-- Bloqueio de conta.
--
-- O cadastro é aberto e continua sendo: quem entra já usa. O que faltava era o
-- outro lado — uma forma de tirar alguém de circulação sem apagar a conta, o
-- histórico ou o que ela já produziu.
--
-- Fica em profiles, não em workspaces, porque quem se bloqueia é a pessoa. Um
-- workspace com dois membros precisa poder perder um sem perder o outro.

do $$ begin
  create type public.access_status as enum ('ativo','bloqueado');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists access_status public.access_status not null default 'ativo',
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text not null default '',
  add column if not exists blocked_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_bloqueados_idx
  on public.profiles (access_status) where access_status = 'bloqueado';

-- --------------------------------------------------------------- aplicação
--
-- A política de update em profiles já trava platform_role com um `with check`
-- que compara o valor novo com o atual. access_status precisa da mesma trava,
-- senão qualquer pessoa se desbloqueia sozinha.

drop policy if exists "perfil próprio pode ser editado" on public.profiles;
create policy "perfil próprio pode ser editado" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and platform_role = (select p.platform_role from public.profiles p where p.id = auth.uid())
  and access_status = (select p.access_status from public.profiles p where p.id = auth.uid())
);

-- Só a administração da plataforma bloqueia e desbloqueia, e sempre pela função
-- abaixo — que exige motivo e deixa rastro.

create or replace function public.set_account_access(
  p_user uuid,
  p_status public.access_status,
  p_reason text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.profiles;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  if p_status = 'bloqueado' and length(trim(p_reason)) < 3 then
    raise exception 'Bloqueio exige motivo';
  end if;

  -- Sem isto, um administrador tira o próprio acesso e ninguém devolve.
  if p_user = auth.uid() and p_status = 'bloqueado' then
    raise exception 'Você não pode bloquear a própria conta';
  end if;

  update public.profiles
  set access_status  = p_status,
      blocked_at     = case when p_status = 'bloqueado' then now() else null end,
      blocked_reason = case when p_status = 'bloqueado' then trim(p_reason) else '' end,
      blocked_by     = case when p_status = 'bloqueado' then auth.uid() else null end
  where id = p_user
  returning * into v_perfil;

  if v_perfil.id is null then
    raise exception 'Conta inexistente';
  end if;

  insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null,
    auth.uid(),
    case when p_status = 'bloqueado' then 'conta_bloqueada' else 'conta_desbloqueada' end,
    'profile',
    p_user,
    jsonb_build_object('motivo', trim(p_reason))
  );

  return v_perfil;
end;
$$;

revoke all on function public.set_account_access(uuid, public.access_status, text) from public;
grant execute on function public.set_account_access(uuid, public.access_status, text) to authenticated;

-- ------------------------------------------------------------ painel: contas
--
-- Uma linha por pessoa, com tudo que a decisão exige: quem é, quanto queimou,
-- quando apareceu pela última vez e se o que ela gera presta.
--
-- Vem por RPC e não por consultas soltas no navegador porque metade destas
-- tabelas não é legível pelo cliente — e porque oito idas ao servidor para
-- montar uma tela é o que deixa o painel raso.

create or replace function public.admin_accounts()
returns table (
  user_id uuid,
  full_name text,
  email text,
  platform_role public.platform_role,
  access_status public.access_status,
  blocked_reason text,
  joined_at timestamptz,
  workspace_id uuid,
  workspace_name text,
  plan public.plan_key,
  images_limit int,
  images_used int,
  campaigns_used int,
  bonus_images int,
  period_end date,
  last_activity timestamptz,
  assets_total bigint,
  assets_approved bigint,
  assets_rejected bigint,
  failed_jobs_7d bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  return query
  select
    p.id, p.full_name, p.email, p.platform_role, p.access_status, p.blocked_reason, p.created_at,
    w.id, w.name, w.plan,
    coalesce(pl.images_limit, 0),
    coalesce(q.images_used, 0) + coalesce(q.images_reserved, 0),
    coalesce(q.campaigns_used, 0),
    coalesce(q.bonus_images, 0),
    q.period_end,
    act.ultima,
    coalesce(a.total, 0),
    coalesce(a.aprovados, 0),
    coalesce(a.rejeitados, 0),
    coalesce(j.falhas, 0)
  from public.profiles p
  -- A pessoa pode estar em mais de um workspace; para o painel vale o que ela
  -- comanda. Sem isto um convidado apareceria pendurado no workspace alheio.
  left join lateral (
    select ws.id, ws.name, ws.plan
    from public.workspace_members m
    join public.workspaces ws on ws.id = m.workspace_id
    where m.user_id = p.id
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, ws.created_at
    limit 1
  ) w on true
  left join public.usage_quotas q on q.workspace_id = w.id
  left join public.plans pl on pl.key = coalesce(q.plan, w.plan)
  left join lateral (
    select max(e.created_at) as ultima
    from public.ai_usage_events e where e.workspace_id = w.id
  ) act on true
  left join lateral (
    select count(*) as total,
           count(*) filter (where ca.status in ('aprovado','publicado')) as aprovados,
           count(*) filter (where ca.status = 'rejeitado') as rejeitados
    from public.creative_assets ca
    where ca.workspace_id = w.id and ca.deleted_at is null
  ) a on true
  left join lateral (
    select count(*) as falhas
    from public.ai_generation_jobs g
    where g.workspace_id = w.id and g.status = 'failed'
      and g.created_at >= now() - interval '7 days'
  ) j on true
  order by p.created_at;
end;
$$;

-- Os motivos de rejeição que a pessoa escreveu. Gravados desde sempre em
-- creative_assets.rejection_reason e até hoje nunca lidos por ninguém.
create or replace function public.admin_account_feedback(p_workspace uuid)
returns table (motivo text, criado_em timestamptz, formato text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  return query
  select ca.rejection_reason, ca.updated_at, ca.format
  from public.creative_assets ca
  where ca.workspace_id = p_workspace
    and ca.status = 'rejeitado'
    and length(trim(coalesce(ca.rejection_reason, ''))) > 0
  order by ca.updated_at desc
  limit 50;
end;
$$;

grant execute on function public.admin_accounts() to authenticated;
grant execute on function public.admin_account_feedback(uuid) to authenticated;
