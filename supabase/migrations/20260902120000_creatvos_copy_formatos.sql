-- Copy com forma própria.
--
-- Enquanto a copy só sabia produzir título e apoio, todo arquétipo acabava
-- sendo o mesmo anúncio com outra moldura. A enquete é uma pergunta com
-- respostas riscadas; a conversa é um print de mensagens. Nenhuma das duas tem
-- headline — e é isso que faz a peça parecer outra coisa, não só outro layout.
alter table public.creative_copies
  add column if not exists formato text not null default 'titulo'
    check (formato in ('titulo','enquete','conversa')),
  add column if not exists pergunta text not null default '',
  add column if not exists opcoes jsonb not null default '[]'::jsonb,
  add column if not exists mensagens jsonb not null default '[]'::jsonb;
