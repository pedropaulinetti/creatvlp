-- CreatvOS · administração de plataforma e continuidade do portal de pesquisa.

-- Backfill: usuários criados antes do provisionamento automático.
do $$
declare
  v_user record;
  v_workspace uuid;
  v_name text;
begin
  for v_user in select id, email, raw_user_meta_data from auth.users loop
    v_name := coalesce(
      nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(v_user.email, 'pessoa'), '@', 1)
    );

    insert into public.profiles (id, full_name, email)
    values (v_user.id, v_name, v_user.email)
    on conflict (id) do update set email = excluded.email;

    select w.id into v_workspace
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id
    where m.user_id = v_user.id
    limit 1;

    if v_workspace is null then
      insert into public.workspaces (name, owner_id, created_by)
      values (left(v_name, 60) || ' · Workspace', v_user.id, v_user.id)
      returning id into v_workspace;

      insert into public.workspace_members (workspace_id, user_id, role, created_by)
      values (v_workspace, v_user.id, 'owner', v_user.id)
      on conflict do nothing;

      insert into public.usage_quotas (workspace_id, plan)
      values (v_workspace, 'beta')
      on conflict (workspace_id) do nothing;
    end if;
  end loop;
end $$;

-- Administradores de plataforma da beta.
update public.profiles
set platform_role = 'admin'
where lower(email) in ('pedro@startu.com.br','pedropaulinettid@gmail.com');

-- O portal da pesquisa passa a ser controlado por role no banco, não por e-mail fixo.
drop policy if exists "Administrador pode ler respostas" on public.research_responses;
create policy "Administrador pode ler respostas"
on public.research_responses
for select
to authenticated
using (public.is_platform_admin());

-- Admin de plataforma pode ajustar plano e conceder créditos manualmente.
drop policy if exists "admin de plataforma ajusta workspace" on public.workspaces;
create policy "admin de plataforma ajusta workspace" on public.workspaces
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "admin de plataforma ajusta quota" on public.usage_quotas;
create policy "admin de plataforma ajusta quota" on public.usage_quotas
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant update on table public.usage_quotas to authenticated;

-- Visão agregada de custo por modelo (apenas admin de plataforma).
create or replace function public.admin_cost_by_model(p_days int default 30)
returns table (model text, events bigint, tokens_in bigint, tokens_out bigint, images bigint, cost_usd numeric)
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
  select e.model,
         count(*)::bigint,
         sum(e.tokens_in)::bigint,
         sum(e.tokens_out)::bigint,
         sum(e.images)::bigint,
         sum(e.cost_usd)::numeric
  from public.ai_usage_events e
  where e.created_at >= now() - make_interval(days => p_days)
  group by e.model
  order by sum(e.cost_usd) desc;
end;
$$;

create or replace function public.admin_cost_by_workspace(p_days int default 30)
returns table (workspace_id uuid, workspace_name text, plan public.plan_key, events bigint, images bigint, cost_usd numeric)
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
  select w.id, w.name, w.plan,
         count(e.id)::bigint,
         coalesce(sum(e.images), 0)::bigint,
         coalesce(sum(e.cost_usd), 0)::numeric
  from public.workspaces w
  left join public.ai_usage_events e
    on e.workspace_id = w.id and e.created_at >= now() - make_interval(days => p_days)
  group by w.id, w.name, w.plan
  order by coalesce(sum(e.cost_usd), 0) desc;
end;
$$;

grant execute on function public.admin_cost_by_model(int) to authenticated;
grant execute on function public.admin_cost_by_workspace(int) to authenticated;
