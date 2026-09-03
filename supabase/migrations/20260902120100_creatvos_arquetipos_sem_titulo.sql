-- Arquétipos sem headline.
--
-- Os anteriores eram todos título + apoio + botão: mudavam o arranjo, não a
-- estrutura. Nestes dois a copy tem forma própria — a pergunta é o anúncio, ou
-- a troca de mensagens é. É o que faz a peça parecer outra coisa, e não o mesmo
-- anúncio com outra moldura.
insert into public.templates (workspace_id, key, name, description, layout, is_default) values
  (null,'enquete','Enquete',
   'Uma pergunta escrita à mão com respostas riscadas. Sem título nem imagem.',
   '{"arquetipo":"enquete","logo":{"x":9,"y":8,"size":8}}'::jsonb,false),
  (null,'conversa','Conversa',
   'Print de mensagens entre um cliente e a marca. Sem título nem imagem.',
   '{"arquetipo":"conversa","logo":{"x":7,"y":8,"size":8}}'::jsonb,false)
on conflict do nothing;
