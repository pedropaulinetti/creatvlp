-- CreatvOS · rotinas, execuções, resultados e aprendizado.

do $$ begin create type public.routine_frequency as enum ('semanal','quinzenal','mensal','data_especifica'); exception when duplicate_object then null; end $$;
do $$ begin create type public.routine_status as enum ('ativa','pausada','erro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.run_status as enum ('pendente','executando','concluida','falhou','pulada'); exception when duplicate_object then null; end $$;

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  objective text not null default '',
  frequency public.routine_frequency not null default 'semanal',
  weekday int check (weekday is null or weekday between 0 and 6),
  day_of_month int check (day_of_month is null or day_of_month between 1 and 28),
  specific_date date,
  run_at time not null default '08:00',
  timezone text not null default 'America/Sao_Paulo',
  channel text not null default 'Meta Ads',
  formats text[] not null default '{4:5}',
  quantity int not null default 6 check (quantity between 1 and 30),
  recurring_offer text not null default '',
  instructions text not null default '',
  requires_approval boolean not null default true,
  auto_generate boolean not null default false,
  allow_image_generation boolean not null default false,
  status public.routine_status not null default 'ativa',
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint routines_frequency_fields check (
    (frequency = 'semanal' and weekday is not null)
    or (frequency = 'quinzenal' and weekday is not null)
    or (frequency = 'mensal' and day_of_month is not null)
    or (frequency = 'data_especifica' and specific_date is not null)
  ),
  -- Segurança: gerar imagem sozinha exige geração automática ligada.
  constraint routines_image_requires_auto check (allow_image_generation = false or auto_generate = true)
);

create index if not exists routines_workspace_idx on public.routines (workspace_id, status) where deleted_at is null;
create index if not exists routines_next_run_idx on public.routines (next_run_at) where deleted_at is null and status = 'ativa';

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at before update on public.routines
for each row execute function public.set_updated_at();

create table if not exists public.routine_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  status public.run_status not null default 'pendente',
  trigger text not null default 'cron' check (trigger in ('cron','manual')),
  idempotency_key text not null,
  error text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, idempotency_key)
);

create index if not exists routine_runs_routine_idx on public.routine_runs (routine_id, scheduled_for desc);

drop trigger if exists routine_runs_set_updated_at on public.routine_runs;
create trigger routine_runs_set_updated_at before update on public.routine_runs
for each row execute function public.set_updated_at();

-- Próxima execução: determinística, calculada no timezone da rotina.
create or replace function public.routine_next_run(
  p_frequency public.routine_frequency,
  p_weekday int,
  p_day_of_month int,
  p_specific_date date,
  p_run_at time,
  p_timezone text,
  p_from timestamptz default now()
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_local timestamp := p_from at time zone p_timezone;
  v_date date := v_local::date;
  v_candidate timestamp;
  v_delta int;
begin
  if p_frequency = 'data_especifica' then
    if p_specific_date is null then return null; end if;
    v_candidate := p_specific_date + p_run_at;
    if v_candidate <= v_local then return null; end if;
    return v_candidate at time zone p_timezone;
  end if;

  if p_frequency in ('semanal','quinzenal') then
    v_delta := (p_weekday - extract(dow from v_date)::int + 7) % 7;
    v_candidate := (v_date + v_delta) + p_run_at;
    if v_candidate <= v_local then
      v_candidate := v_candidate + interval '7 days';
    end if;
    if p_frequency = 'quinzenal' then
      -- alterna semanas pares a partir da época, mantendo o mesmo dia da semana
      if (extract(epoch from v_candidate::date)::bigint / 604800) % 2 = 1 then
        v_candidate := v_candidate + interval '7 days';
      end if;
    end if;
    return v_candidate at time zone p_timezone;
  end if;

  -- mensal
  v_candidate := date_trunc('month', v_date)::date + (p_day_of_month - 1) + p_run_at;
  if v_candidate <= v_local then
    v_candidate := (date_trunc('month', v_date) + interval '1 month')::date + (p_day_of_month - 1) + p_run_at;
  end if;
  return v_candidate at time zone p_timezone;
end;
$$;

create or replace function public.routines_sync_next_run()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ativa' and new.deleted_at is null then
    new.next_run_at := public.routine_next_run(
      new.frequency, new.weekday, new.day_of_month, new.specific_date,
      new.run_at, new.timezone, coalesce(new.last_run_at, now())
    );
  else
    new.next_run_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists routines_next_run on public.routines;
create trigger routines_next_run before insert or update of
  frequency, weekday, day_of_month, specific_date, run_at, timezone, status, last_run_at, deleted_at
on public.routines
for each row execute function public.routines_sync_next_run();

-- --------------------------------------------------- resultados manuais
create table if not exists public.performance_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_id uuid references public.creative_assets(id) on delete set null,
  winner_asset_id uuid references public.creative_assets(id) on delete set null,
  period_start date not null,
  period_end date not null,
  spend_cents bigint not null default 0 check (spend_cents >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  leads bigint not null default 0 check (leads >= 0),
  purchases bigint not null default 0 check (purchases >= 0),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (clicks <= impressions or impressions = 0)
);

create index if not exists performance_reports_campaign_idx on public.performance_reports (campaign_id, period_start desc);

drop trigger if exists performance_reports_set_updated_at on public.performance_reports;
create trigger performance_reports_set_updated_at before update on public.performance_reports
for each row execute function public.set_updated_at();

create table if not exists public.brand_learnings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  kind text not null check (kind in ('angulo','hook','formato','oferta','aprendizado','proximo_teste')),
  statement text not null check (length(trim(statement)) > 0),
  evidence jsonb not null default '{}'::jsonb,
  confidence text not null default 'sinal' check (confidence in ('sinal','tendencia','consistente')),
  sample_size int not null default 0 check (sample_size >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists brand_learnings_brand_idx on public.brand_learnings (brand_id, created_at desc);

select public.apply_workspace_rls('routines');
select public.apply_workspace_rls('routine_runs');
select public.apply_workspace_rls('performance_reports');
select public.apply_workspace_rls('brand_learnings');
