create table if not exists public.research_responses (
  id uuid primary key,
  created_at timestamptz not null default now(),
  nome text not null,
  empresa text not null,
  telefone text not null,
  email text not null,
  origem text,
  respostas jsonb not null,
  status text not null default 'nova'
);

alter table public.research_responses enable row level security;

revoke all on table public.research_responses from anon, authenticated;
grant insert on table public.research_responses to anon, authenticated;

drop policy if exists "Pesquisa pública pode receber respostas" on public.research_responses;
create policy "Pesquisa pública pode receber respostas"
on public.research_responses
for insert
to anon, authenticated
with check (
  respostas ->> 'consentimento' = 'Sim, concordo'
);
