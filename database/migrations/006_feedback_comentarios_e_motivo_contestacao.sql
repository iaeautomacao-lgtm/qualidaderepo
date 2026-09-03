-- ---------------------------------------------------------------------------
-- 006 — Histórico de comentários do supervisor + motivo por item contestado
--
-- O PROBLEMA QUE ESTA MIGRATION RESOLVE: duas telas pedem informação que não
-- tem onde morar.
--
-- 1. A aba "Histórico" da tela de Feedback é um histórico de comentários do
--    supervisor sobre a monitoria — várias linhas ao longo do tempo. A tabela
--    `feedbacks` não serve: ela tem `UNIQUE KEY uq_feedbacks_avaliacao`, é UM
--    registro por avaliação (o feedback formal, com status e prazo). Um segundo
--    comentário sobrescreveria o primeiro. `audit_logs` também não serve: é
--    trilha de auditoria escrita pelo sistema, não conversa entre pessoas —
--    misturar as duas coisas faria a auditoria deixar de ser confiável como
--    registro do que o sistema fez.
--
-- 2. A tela de contestação por item ("Motivo da Contestação" + "Justificativa")
--    grava um motivo POR ITEM. `contestacao_itens` só tem `argumento`, e
--    `contestacoes.motivo` é um campo do pedido inteiro. Sem a coluna, contestar
--    3 critérios com motivos diferentes perderia 2 deles.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: banco no nível da 005.
--
-- O `ADD COLUMN` do item 2 NÃO é idempotente (o MySQL 8 não aceita
-- `ADD COLUMN IF NOT EXISTS`): rodar duas vezes acusa "Duplicate column name".
-- O erro é inofensivo, mas rode uma vez só. O `CREATE TABLE IF NOT EXISTS` do
-- item 1 pode repetir sem efeito.
--
-- NADA AQUI APAGA DADO: só CREATE TABLE e ADD COLUMN.
--
-- A aplicação tolera este schema AUSENTE. Sem a 006:
--   * a aba "Histórico" mostra um aviso explicando que falta a migration, e a
--     caixa de novo comentário fica desabilitada;
--   * a contestação continua sendo aberta, com o motivo de cada item indo para
--     o campo `motivo` do pedido (`contestacoes.motivo`), que já existe.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Comentários do supervisor sobre a monitoria
--
-- Linha por comentário, sem UNIQUE: é histórico, e o valor dele está justamente
-- em ter várias entradas em sequência.
--
-- `autor_id` com ON DELETE SET NULL pelo mesmo motivo da 005: desligar um
-- usuário não pode apagar o registro de que o comentário foi feito. A tela
-- mostra "Usuário removido" quando o nome vem nulo.
--
-- Sem `updated_at` de propósito: comentário de histórico não se edita. Corrigir
-- é escrever outro — assim a leitura de quem chega depois continua fiel ao que
-- foi dito na hora.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS feedback_comentarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  autor_id BIGINT UNSIGNED NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- A tela sempre lê "os comentários desta avaliação, do mais novo para o mais
  -- velho": o índice composto atende a cláusula e a ordenação de uma vez.
  KEY idx_feedback_comentarios_avaliacao (avaliacao_id, created_at),
  CONSTRAINT fk_feedback_comentarios_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_comentarios_autor
    FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 2. Motivo por item contestado
--
-- VARCHAR(60) e não ENUM: a lista de motivos é vocabulário da operação
-- ("Evidência insuficiente", "Critério não aplicável ao contato"...), e mudar
-- ENUM em produção exige ALTER TABLE. A aplicação valida contra a lista fechada
-- `MOTIVOS_CONTESTACAO` antes de gravar, então o banco não precisa da trava.
-- ===========================================================================

ALTER TABLE contestacao_itens
  ADD COLUMN motivo VARCHAR(60) NULL AFTER argumento;
