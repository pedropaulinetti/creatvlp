grant select on table public.research_responses to authenticated;

drop policy if exists "Administrador pode ler respostas" on public.research_responses;

create policy "Administrador pode ler respostas"
on public.research_responses
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'pedropaulinettid@gmail.com'
);
