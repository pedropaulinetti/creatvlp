-- CreatvOS · buckets privados e políticas equivalentes às do banco.
-- Caminho canônico: {workspace_id}/{brand_id}/{resource_type}/{uuid}.{ext}

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.safe_uuid(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand-assets','brand-assets',false, 10485760,
    array['image/png','image/jpeg','image/webp','image/svg+xml','image/avif']),
  ('product-assets','product-assets',false, 10485760,
    array['image/png','image/jpeg','image/webp','image/avif']),
  ('creative-assets','creative-assets',false, 26214400,
    array['image/png','image/jpeg','image/webp']),
  ('campaign-exports','campaign-exports',false, 104857600,
    array['application/zip','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Gera as quatro políticas (select/insert/update/delete) para um bucket.
create or replace function public.apply_storage_rls(p_bucket text)
returns void
language plpgsql
as $$
declare
  v_prefix text := replace(p_bucket, '-', '_');
  v_guard text := format(
    'bucket_id = %L and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))',
    p_bucket);
begin
  execute format('drop policy if exists "%s_select" on storage.objects', v_prefix);
  execute format('create policy "%s_select" on storage.objects for select to authenticated using (%s)', v_prefix, v_guard);

  execute format('drop policy if exists "%s_insert" on storage.objects', v_prefix);
  execute format('create policy "%s_insert" on storage.objects for insert to authenticated with check (%s)', v_prefix, v_guard);

  execute format('drop policy if exists "%s_update" on storage.objects', v_prefix);
  execute format('create policy "%s_update" on storage.objects for update to authenticated using (%s) with check (%s)', v_prefix, v_guard, v_guard);

  execute format('drop policy if exists "%s_delete" on storage.objects', v_prefix);
  execute format('create policy "%s_delete" on storage.objects for delete to authenticated using (%s)', v_prefix, v_guard);
end;
$$;

select public.apply_storage_rls('brand-assets');
select public.apply_storage_rls('product-assets');
select public.apply_storage_rls('creative-assets');
select public.apply_storage_rls('campaign-exports');
