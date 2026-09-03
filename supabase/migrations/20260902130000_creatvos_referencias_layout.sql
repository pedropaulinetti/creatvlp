-- Referências reais de layout de anúncio.
--
-- A variedade da peça não vem de descrever forma em palavras: cinco formas
-- escritas no prompt entregam cinco peças parecidas, porque o modelo lê
-- "bloco de cor com selo" e desenha sempre o mesmo bloco. Vem de mostrar um
-- anúncio real e pedir a ESTRUTURA dele — nunca a marca dele.
--
-- Bucket global, sem prefixo de workspace: a referência é acervo do CreatvOS,
-- não pertence a cliente nenhum. Só o service role lê, e assina a URL no
-- momento de gerar. Por isso a tabela liga RLS e não cria política alguma.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('layout-references','layout-references',false, 10485760,
    array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.layout_references (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  segmento text not null check (segmento in ('ecommerce','saas')),
  -- A marca de onde veio a referência. Guardada para auditoria, nunca enviada
  -- ao modelo: o que se copia é a arquitetura, não a identidade.
  origem text not null default '',
  storage_path text not null,
  -- O que o modelo precisa entender da estrutura, em português e sem citar a
  -- marca da referência. Preenchido no seed; editável depois.
  estrutura text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists layout_references_segmento
  on public.layout_references (segmento) where ativo;

alter table public.layout_references enable row level security;

-- O acervo é catálogo, não dado de cliente: quem está logado pode ver para
-- escolher o layout antes de gerar. Escrever, só o service role.
drop policy if exists "acervo visível" on public.layout_references;
create policy "acervo visível" on public.layout_references
  for select to authenticated
  using (ativo);

grant select on table public.layout_references to authenticated;

-- E a miniatura precisa ser buscável pelo app na hora de escolher.
drop policy if exists "layout_references leitura" on storage.objects;
create policy "layout_references leitura" on storage.objects
  for select to authenticated
  using (bucket_id = 'layout-references');
