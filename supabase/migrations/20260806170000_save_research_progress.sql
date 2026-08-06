grant insert, update on table public.research_responses to anon, authenticated;

drop policy if exists "Pesquisa pública pode receber respostas" on public.research_responses;
create policy "Pesquisa pública pode receber respostas"
on public.research_responses
for insert
to anon, authenticated
with check (
  status = 'em_andamento'
  or (
    status = 'concluida'
    and respostas ->> 'consentimento' = 'Sim, concordo'
  )
);

drop policy if exists "Pesquisa pública pode atualizar respostas em andamento" on public.research_responses;
create policy "Pesquisa pública pode atualizar respostas em andamento"
on public.research_responses
for update
to anon, authenticated
using (status = 'em_andamento')
with check (
  status = 'em_andamento'
  or (
    status = 'concluida'
    and respostas ->> 'consentimento' = 'Sim, concordo'
  )
);
