-- CreatvOS · agendamento das rotinas.
-- O cron chama a Edge Function `run-routines` a cada 15 minutos. A função é
-- idempotente: a chave única de routine_runs impede execução duplicada.
--
-- Pré-requisito: os segredos `creatvos_functions_url` e `creatvos_cron_secret`
-- precisam existir no Vault. Veja docs/deploy.md.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_run_routines()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'creatvos_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'creatvos_cron_secret';

  if v_url is null or v_secret is null then
    raise notice 'CreatvOS: segredos do cron ausentes; execução ignorada';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/run-routines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.trigger_run_routines() from public, anon, authenticated;

-- Reagenda de forma idempotente.
do $$
begin
  perform cron.unschedule('creatvos-run-routines');
exception when others then
  null;
end $$;

select cron.schedule('creatvos-run-routines', '*/15 * * * *', $$select public.trigger_run_routines()$$);
