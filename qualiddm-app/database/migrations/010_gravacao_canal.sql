-- ---------------------------------------------------------------------------
-- 010 — Canal informado no upload (chat ou ligação)
--
-- O PROBLEMA QUE ESTA MIGRATION RESOLVE: o sistema precisa saber se o
-- atendimento avaliado foi por CHAT ou por LIGAÇÃO — é o que separa as duas
-- colunas de desempenho em Operações, Campanhas e Avaliados.
--
-- Até aqui esse canal era DEDUZIDO, em duas etapas:
--   1. `campanhas.canal`, quando a gravação tinha campanha vinculada;
--   2. quando não tinha, um palpite pelo `mime_type`: áudio virava telefone,
--      qualquer outra coisa virava chat.
--
-- O palpite acerta nos casos comuns e erra em silêncio nos outros — um PDF com
-- transcrição de ligação era contado como chat, e ninguém tinha como perceber.
-- Pior: o erro entra na média por canal, que é justamente o número que a
-- operação usa para comparar as duas frentes.
--
-- Com esta coluna quem envia o arquivo DECLARA o canal na tela de upload, e a
-- dedução volta a ser o que deveria ser: último recurso, para o que já está no
-- banco sem declaração.
--
-- Ordem de precedência depois desta migration:
--   1. `gravacoes.canal`   -> o que a pessoa informou no upload
--   2. `campanhas.canal`   -> o cadastro da campanha
--   3. `mime_type`         -> palpite, só para registro antigo
--
-- NULL é o default de propósito: gravação antiga não tem declaração, e gravar
-- 'chat' em todas elas inventaria informação que ninguém deu. Elas continuam
-- caindo na dedução, que é o comportamento que já tinham.
--
-- Só 'chat' e 'telefone': são os dois canais que a operação monitora e os dois
-- que a tela oferece. `campanhas.canal` tem mais valores (email, whatsapp,
-- offline, outro) porque é cadastro comercial; aqui é o que se avalia.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: banco no nível da 009.
--
-- NÃO é idempotente (o MySQL 8 não aceita `ADD COLUMN IF NOT EXISTS`): rodar
-- duas vezes acusa "Duplicate column name" — erro inofensivo, mas rode uma vez só.
--
-- NADA AQUI APAGA DADO: só ADD COLUMN e ADD KEY.
--
-- A aplicação tolera este schema AUSENTE: a tela de upload continua oferecendo a
-- escolha, o arquivo é aceito, e o canal volta a ser deduzido como antes.
-- ---------------------------------------------------------------------------

ALTER TABLE gravacoes
  ADD COLUMN canal ENUM('chat','telefone') NULL AFTER origem;

-- A quebra por canal é uma agregação por canal + período; o índice composto
-- atende as duas colunas do filtro de uma vez.
ALTER TABLE gravacoes
  ADD KEY idx_gravacoes_canal (canal, created_at);
