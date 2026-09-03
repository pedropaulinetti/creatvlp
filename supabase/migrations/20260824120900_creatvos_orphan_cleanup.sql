-- CreatvOS · workspace sem membro é inalcançável.
-- profiles cascateia de auth.users, e workspace_members cascateia de profiles,
-- mas workspaces só tinha owner_id com ON DELETE SET NULL. Resultado: apagar o
-- último membro deixava workspace, marcas, campanhas e criativos órfãos —
-- invisíveis para todo mundo e ocupando espaço.

create or replace function public.drop_empty_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.workspaces w
  where w.id = old.workspace_id
    and not exists (
      select 1 from public.workspace_members m where m.workspace_id = w.id
    );
  return old;
end;
$$;

drop trigger if exists workspace_members_drop_empty on public.workspace_members;
create trigger workspace_members_drop_empty
after delete on public.workspace_members
for each row execute function public.drop_empty_workspace();

-- Limpa o que já ficou para trás.
delete from public.workspaces w
where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id);
