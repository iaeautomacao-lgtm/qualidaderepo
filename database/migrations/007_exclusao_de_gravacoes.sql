-- ---------------------------------------------------------------------------
-- 007 — Exclusão de gravação e da análise IA
--
-- O PROBLEMA QUE ESTA MIGRATION RESOLVE: a tela Avaliações lista duas coisas
-- diferentes lado a lado — a monitoria com formulário (código QA-…, linha em
-- `avaliacoes`) e a análise livre da IA (código MIA-…, que é uma linha em
-- `gravacoes` + `transcricoes`, sem ficha).
--
-- O botão de excluir do cartão funciona para a primeira: `avaliacoes` já tem
-- `excluida_em`, `excluida_por_id` e `exclusao_motivo` desde a 003, e o relatório
-- "Fichas Excluídas" lê essas colunas. Para a análise IA não havia onde
-- registrar a exclusão — e é por isso que o botão não fazia nada nesses cartões.
--
-- As três colunas aqui são as MESMAS da 003, agora em `gravacoes`. Repetir o
-- padrão em vez de inventar outro: quem já sabe ler ficha excluída sabe ler
-- gravação excluída.
--
-- POR QUE NÃO APAGAR A LINHA: `gravacoes` guarda o arquivo enviado (hash,
-- caminho no disco, quem enviou). Apagar levaria a transcrição junto por
-- CASCADE e deixaria o arquivo órfão no disco, sem registro de que existiu.
-- Exclusão marcada mantém a trilha e é reversível com um UPDATE.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: banco no nível da 006.
--
-- NÃO é idempotente (o MySQL 8 não aceita `ADD COLUMN IF NOT EXISTS`): rodar
-- duas vezes acusa "Duplicate column name". O erro é inofensivo, mas rode uma
-- vez só.
--
-- NADA AQUI APAGA DADO: só ADD COLUMN, ADD KEY e ADD CONSTRAINT.
--
-- A aplicação tolera este schema AUSENTE: excluir monitoria com formulário
-- continua funcionando (aquilo vive na 003), e excluir análise IA responde 409
-- explicando que falta a 007, em vez de fingir que apagou.
-- ---------------------------------------------------------------------------

ALTER TABLE gravacoes
  ADD COLUMN excluida_em DATETIME NULL AFTER updated_at,
  ADD COLUMN excluida_por_id BIGINT UNSIGNED NULL AFTER excluida_em,
  ADD COLUMN exclusao_motivo VARCHAR(400) NULL AFTER excluida_por_id;

-- Toda listagem de gravação passa a filtrar `excluida_em IS NULL`; o índice
-- evita varredura na fila de transcrições, que é a tabela que mais cresce.
ALTER TABLE gravacoes
  ADD KEY idx_gravacoes_excluida (excluida_em);

ALTER TABLE gravacoes
  ADD CONSTRAINT fk_gravacoes_excluida_por
    FOREIGN KEY (excluida_por_id) REFERENCES users(id) ON DELETE SET NULL;
