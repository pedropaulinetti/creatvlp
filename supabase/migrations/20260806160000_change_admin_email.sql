drop policy if exists "Administrador pode ler respostas" on public.research_responses;

create policy "Administrador pode ler respostas"
on public.research_responses
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'pedro@startu.com.br'
);
