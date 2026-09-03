-- A peça inteira desenhada pelo modelo.
--
-- Convive com a composição em HTML em vez de substituí-la: a gerada tem a
-- liberdade gráfica das referências (recorte, selo, seta) mas pode errar a
-- ortografia e não é editável; a composta é sempre correta e editável. Quem
-- publica escolhe, então as duas precisam existir lado a lado no mesmo criativo.
alter table public.creative_assets
  add column if not exists generated_path text;
