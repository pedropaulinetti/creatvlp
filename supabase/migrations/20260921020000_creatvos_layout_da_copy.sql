-- CreatvOS · a escolha de layout passa a ser da copy.
--
-- O desenho da peça era sorteado por rodízio no servidor: variedade sim,
-- intenção não. Uma enquete pede título discreto, um número forte pede título
-- dominante, e quem sabe isso é quem escreveu o texto.
--
-- Quatro enums, não layout livre: o canvas continua desenhando a letra, então
-- a ortografia continua impossível de errar. O que o modelo ganha é a
-- estrutura, que é onde mora a criatividade que faltava.
--
-- Fica em jsonb para o vocabulário crescer sem migration nova. Valor
-- desconhecido cai no padrão, no schema e no canvas.

alter table public.creative_copies
  add column if not exists layout jsonb not null default '{}'::jsonb;

comment on column public.creative_copies.layout is
  'Escolhas de estrutura feitas por quem escreveu: arquetipo, escala, alinhamento, ancora.';
