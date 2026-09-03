-- CreatvOS · jobs de IA, consumo, créditos, notificações e auditoria.

do $$ begin create type public.job_status as enum ('queued','processing','completed','failed','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  asset_id uuid references public.creative_assets(id) on delete set null,
  routine_run_id uuid references public.routine_runs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('chat','briefing','direcoes','copies','imagem','regeneracao','recomendacao','analise_marca')),
  status public.job_status not null default 'queued',
  idempotency_key text not null,
  model text,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts > 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12,6) not null default 0 check (actual_cost_usd >= 0),
  credits_reserved int not null default 0 check (credits_reserved >= 0),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists ai_jobs_workspace_idx on public.ai_generation_jobs (workspace_id, status, created_at desc);
create index if not exists ai_jobs_stuck_idx on public.ai_generation_jobs (status, started_at) where status = 'processing';

drop trigger if exists ai_jobs_set_updated_at on public.ai_generation_jobs;
create trigger ai_jobs_set_updated_at before update on public.ai_generation_jobs
for each row execute function public.set_updated_at();

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.ai_generation_jobs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  model text not null,
  tokens_in int not null default 0 check (tokens_in >= 0),
  tokens_out int not null default 0 check (tokens_out >= 0),
  images int not null default 0 check (images >= 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  latency_ms int not null default 0 check (latency_ms >= 0),
  status text not null default 'ok' check (status in ('ok','erro','rate_limit','timeout')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_workspace_idx on public.ai_usage_events (workspace_id, created_at desc);
create index if not exists ai_usage_model_idx on public.ai_usage_events (model, created_at desc);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.ai_generation_jobs(id) on delete set null,
  kind text not null check (kind in ('campanha','imagem')),
  delta int not null,
  reason text not null check (reason in ('reserva','confirmacao','devolucao','ajuste_admin','renovacao')),
  reference_id uuid,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_workspace_idx on public.usage_ledger (workspace_id, created_at desc);

-- ------------------------------------------------------- ciclo de créditos
create or replace function public.ensure_quota_period(p_workspace uuid)
returns public.usage_quotas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quota public.usage_quotas;
  v_plan public.plan_key;
begin
  select plan into v_plan from public.workspaces where id = p_workspace;
  if v_plan is null then
    raise exception 'Workspace inexistente';
  end if;

  insert into public.usage_quotas (workspace_id, plan)
  values (p_workspace, v_plan)
  on conflict (workspace_id) do nothing;

  select * into v_quota from public.usage_quotas where workspace_id = p_workspace for update;

  if current_date > v_quota.period_end then
    update public.usage_quotas
    set period_start = date_trunc('month', now())::date,
        period_end = (date_trunc('month', now()) + interval '1 month - 1 day')::date,
        campaigns_used = 0,
        images_used = 0,
        campaigns_reserved = 0,
        images_reserved = 0,
        plan = v_plan
    where workspace_id = p_workspace
    returning * into v_quota;

    insert into public.usage_ledger (workspace_id, kind, delta, reason, note)
    values (p_workspace, 'imagem', 0, 'renovacao', 'Novo ciclo mensal');
  elsif v_quota.plan is distinct from v_plan then
    update public.usage_quotas set plan = v_plan where workspace_id = p_workspace returning * into v_quota;
  end if;

  return v_quota;
end;
$$;

create or replace function public.quota_available(p_workspace uuid, p_kind text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quota public.usage_quotas;
  v_limit int;
begin
  v_quota := public.ensure_quota_period(p_workspace);
  select case when p_kind = 'imagem' then p.images_limit else p.campaigns_limit end
  into v_limit
  from public.plans p where p.key = v_quota.plan;

  if p_kind = 'imagem' then
    return v_limit + v_quota.bonus_images - v_quota.images_used - v_quota.images_reserved;
  end if;
  return v_limit + v_quota.bonus_campaigns - v_quota.campaigns_used - v_quota.campaigns_reserved;
end;
$$;

create or replace function public.reserve_credits(
  p_workspace uuid, p_kind text, p_amount int, p_job uuid default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available int;
begin
  if p_amount <= 0 then raise exception 'Quantidade inválida'; end if;
  perform public.ensure_quota_period(p_workspace);
  v_available := public.quota_available(p_workspace, p_kind);

  if v_available < p_amount then
    raise exception 'QUOTA_EXCEDIDA: restam % de % solicitados (%)', v_available, p_amount, p_kind
      using errcode = 'check_violation';
  end if;

  if p_kind = 'imagem' then
    update public.usage_quotas set images_reserved = images_reserved + p_amount where workspace_id = p_workspace;
  else
    update public.usage_quotas set campaigns_reserved = campaigns_reserved + p_amount where workspace_id = p_workspace;
  end if;

  insert into public.usage_ledger (workspace_id, job_id, kind, delta, reason)
  values (p_workspace, p_job, p_kind, -p_amount, 'reserva');

  return v_available - p_amount;
end;
$$;

create or replace function public.confirm_credits(
  p_workspace uuid, p_kind text, p_amount int, p_job uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_amount <= 0 then raise exception 'Quantidade inválida'; end if;
  if p_kind = 'imagem' then
    update public.usage_quotas
    set images_reserved = greatest(0, images_reserved - p_amount),
        images_used = images_used + p_amount
    where workspace_id = p_workspace;
  else
    update public.usage_quotas
    set campaigns_reserved = greatest(0, campaigns_reserved - p_amount),
        campaigns_used = campaigns_used + p_amount
    where workspace_id = p_workspace;
  end if;

  insert into public.usage_ledger (workspace_id, job_id, kind, delta, reason)
  values (p_workspace, p_job, p_kind, 0, 'confirmacao');
end;
$$;

create or replace function public.refund_credits(
  p_workspace uuid, p_kind text, p_amount int, p_job uuid default null, p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_amount <= 0 then return; end if;
  if p_kind = 'imagem' then
    update public.usage_quotas set images_reserved = greatest(0, images_reserved - p_amount) where workspace_id = p_workspace;
  else
    update public.usage_quotas set campaigns_reserved = greatest(0, campaigns_reserved - p_amount) where workspace_id = p_workspace;
  end if;

  insert into public.usage_ledger (workspace_id, job_id, kind, delta, reason, note)
  values (p_workspace, p_job, p_kind, p_amount, 'devolucao', p_note);
end;
$$;

-- Créditos são movimentados apenas pelo servidor (Edge Functions / service role).
revoke all on function public.ensure_quota_period(uuid) from public, anon, authenticated;
revoke all on function public.reserve_credits(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.confirm_credits(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, text, int, uuid, text) from public, anon, authenticated;
revoke all on function public.quota_available(uuid, text) from public, anon;
grant execute on function public.quota_available(uuid, text) to authenticated;

-- ---------------------------------------------------------- notificações
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'campanha_pronta','criativos_aguardando','rotina_executada','rotina_erro',
    'geracao_falhou','limite_proximo','limite_atingido','marca_atualizada'
  )),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ------------------------------------------------------------- auditoria
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- -------------------------------------------------------------------- RLS
-- Jobs, consumo e ledger: leitura para o workspace, escrita só no servidor.
alter table public.ai_generation_jobs enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "jobs visíveis" on public.ai_generation_jobs;
create policy "jobs visíveis" on public.ai_generation_jobs
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

drop policy if exists "consumo visível" on public.ai_usage_events;
create policy "consumo visível" on public.ai_usage_events
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

drop policy if exists "ledger visível" on public.usage_ledger;
create policy "ledger visível" on public.usage_ledger
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

drop policy if exists "notificações próprias" on public.notifications;
create policy "notificações próprias" on public.notifications
for select to authenticated
using (user_id = auth.uid() or (user_id is null and public.is_workspace_member(workspace_id)));

drop policy if exists "marcar notificação como lida" on public.notifications;
create policy "marcar notificação como lida" on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "auditoria para administradores" on public.audit_logs;
create policy "auditoria para administradores" on public.audit_logs
for select to authenticated
using (public.is_platform_admin() or (workspace_id is not null and public.is_workspace_admin(workspace_id)));

grant select on table public.ai_generation_jobs to authenticated;
grant select on table public.ai_usage_events to authenticated;
grant select on table public.usage_ledger to authenticated;
grant select, update on table public.notifications to authenticated;
grant select on table public.audit_logs to authenticated;
