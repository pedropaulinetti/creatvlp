create extension if not exists pgcrypto with schema extensions;

alter table public.research_responses
add column if not exists draft_token_hash text;

revoke insert, update on table public.research_responses from anon, authenticated;

drop policy if exists "Pesquisa pública pode receber respostas" on public.research_responses;
drop policy if exists "Pesquisa pública pode atualizar respostas em andamento" on public.research_responses;

create or replace function public.save_research_response(
  p_payload jsonb,
  p_draft_token text,
  p_complete boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_hash text;
  v_existing_hash text;
  v_existing_status text;
begin
  if length(coalesce(p_draft_token, '')) < 32 then
    raise exception 'Token da resposta inválido';
  end if;

  v_id := (p_payload ->> 'id')::uuid;
  v_hash := encode(digest(p_draft_token, 'sha256'), 'hex');

  if p_complete and coalesce(p_payload ->> 'consentimento', '') <> 'Sim, concordo' then
    raise exception 'Consentimento necessário para concluir';
  end if;

  select draft_token_hash, status
  into v_existing_hash, v_existing_status
  from public.research_responses
  where id = v_id;

  if found then
    if v_existing_hash is distinct from v_hash or v_existing_status <> 'em_andamento' then
      raise exception 'Resposta não pode ser alterada';
    end if;

    update public.research_responses
    set nome = coalesce(nullif(p_payload ->> 'nome', ''), 'Resposta em andamento'),
        empresa = coalesce(nullif(p_payload ->> 'marca', ''), 'Não informado'),
        telefone = coalesce(nullif(p_payload ->> 'telefone', ''), 'Não informado'),
        email = coalesce(nullif(p_payload ->> 'email', ''), 'Não informado'),
        origem = p_payload ->> 'origem',
        respostas = p_payload,
        status = case when p_complete then 'concluida' else 'em_andamento' end
    where id = v_id;
  else
    insert into public.research_responses (
      id, nome, empresa, telefone, email, origem, respostas, status, draft_token_hash
    ) values (
      v_id,
      coalesce(nullif(p_payload ->> 'nome', ''), 'Resposta em andamento'),
      coalesce(nullif(p_payload ->> 'marca', ''), 'Não informado'),
      coalesce(nullif(p_payload ->> 'telefone', ''), 'Não informado'),
      coalesce(nullif(p_payload ->> 'email', ''), 'Não informado'),
      p_payload ->> 'origem',
      p_payload,
      case when p_complete then 'concluida' else 'em_andamento' end,
      v_hash
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_research_response(jsonb, text, boolean) from public;
grant execute on function public.save_research_response(jsonb, text, boolean) to anon, authenticated;
