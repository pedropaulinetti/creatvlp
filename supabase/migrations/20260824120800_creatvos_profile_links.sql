-- CreatvOS · chaves estrangeiras para profiles.
-- Sem elas o PostgREST não consegue embutir o perfil nas consultas
-- (`workspace_members?select=...,profile:profiles(...)` devolvia HTTP 400).
-- profiles.id já referencia auth.users(id), então o alvo continua o mesmo.

do $$ begin
  alter table public.workspace_members
    add constraint workspace_members_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.audit_logs
    add constraint audit_logs_actor_profile_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
exception when duplicate_object then null;
end $$;
