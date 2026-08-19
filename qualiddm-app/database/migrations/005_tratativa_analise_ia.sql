-- ---------------------------------------------------------------------------
-- 005 — Tratativa da análise IA ("Marcar como tratado")
--
-- O PROBLEMA QUE ESTA MIGRATION RESOLVE: a tela "Resumo executivo" da análise
-- IA termina numa ação — "realizar feedback individual com o operador" — e o
-- gestor precisa registrar que aquilo foi feito. Não havia onde: análise IA vive
-- em `gravacoes` + `transcricoes`, e `avaliacoes.status_feedback` só existe para
-- a monitoria com formulário cadastrado. Sem estas colunas, o botão "Marcar como
-- tratado" seria decorativo e a mesma análise voltaria para a fila de
-- prioridades do dashboard todo dia.
--
-- Por que em `gravacoes` e não numa tabela nova: a tratativa é UM estado por
-- gravação (tratada ou não, por quem, quando), não um histórico com vários
-- registros. Tabela própria só se um dia houver reabertura e trilha de
-- tratativas — aí a coluna vira o "estado corrente" e a tabela guarda o
-- histórico, sem precisar migrar o que já está gravado aqui.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: banco no nível da 004.
--
-- Esta migration NÃO é idempotente no ALTER TABLE, pela mesma razão da 003 e da
-- 004: o MySQL 8 não aceita `ADD COLUMN IF NOT EXISTS`. Rodar duas vezes acusa
-- "Duplicate column name" — o erro é esperado e inofensivo, mas rode uma vez só.
--
-- NADA AQUI APAGA DADO: só ADD COLUMN, ADD KEY e ADD CONSTRAINT.
--
-- A aplicação tolera este schema AUSENTE: `obterTranscricao` consulta
-- `SHOW COLUMNS` antes de pedir as colunas novas e a rota de tratativa responde
-- 409 explicando que a migration 005 não foi aplicada. Um banco sem ela continua
-- abrindo as telas de análise IA — só sem o registro de tratativa.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Estado da tratativa por gravação
--
-- `tratada_em` é a fonte da verdade do estado: nulo = pendente, preenchido =
-- tratada. Um booleano separado abriria espaço para os dois discordarem.
--
-- `tratada_por_id` responde "quem fechou", que é o que a supervisão pergunta
-- quando o caso volta. ON DELETE SET NULL: desligar um usuário não pode apagar
-- o registro de que a tratativa aconteceu.
--
-- `tratativa_nota` guarda o que foi feito, em uma linha. VARCHAR(400) e não
-- TEXT: é anotação de fechamento, não relatório — o relatório é o feedback.
-- ===========================================================================

ALTER TABLE gravacoes
  ADD COLUMN tratada_em DATETIME NULL AFTER avaliacao_id,
  ADD COLUMN tratada_por_id BIGINT UNSIGNED NULL AFTER tratada_em,
  ADD COLUMN tratativa_nota VARCHAR(400) NULL AFTER tratada_por_id;

-- Índice pelo estado: a fila de prioridades do dashboard filtra por
-- "não tratada" e o painel de análises IA ordena por data de tratativa.
ALTER TABLE gravacoes
  ADD KEY idx_gravacoes_tratada (tratada_em);

ALTER TABLE gravacoes
  ADD CONSTRAINT fk_gravacoes_tratada_por
    FOREIGN KEY (tratada_por_id) REFERENCES users(id) ON DELETE SET NULL;
