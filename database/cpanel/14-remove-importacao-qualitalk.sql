-- ===========================================================================
-- Remove a importacao historica do QualiTalk (as 1041 avaliacoes que ficaram
-- no usuario-fantasma "Monitoria IA"), para dar lugar a uma importacao nova
-- com o operador correto.
--
-- Como usar no cPanel:
--   1. phpMyAdmin > aba SQL ou Importar > este arquivo > Executar
--      (o USE abaixo cuida do banco; nao depende do que esta selecionado)
--
-- O QUE ESPERAR: entre este script e a reimportacao, a tela de Avaliacoes
-- fica VAZIA -- as 1041 sao tudo que ha de avaliacao IA no banco. O que sai
-- daqui so volta pelo 10-avaliacoes-ia-*.sql regenerado, ou pelo dump.
--
-- Rodar antes de ter a planilha nova foi decisao consciente: plataforma ainda
-- em teste, ninguem depende do historico. Em base com uso real, a ordem seria
-- a inversa -- planilha primeiro, remocao depois.
--
-- ALTERA DADOS. Exporte o banco antes (phpMyAdmin > Exportar).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Banco alvo, escrito aqui e nao herdado da tela. Ver 12/13 para o porque.
-- >>> Se o banco tiver outro nome, troque aqui. <<<
-- ---------------------------------------------------------------------------
USE `grpia_qualiddm`;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Trava: banco errado para antes de apagar qualquer coisa.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS qualiddm_exige_banco;

DELIMITER $$
CREATE PROCEDURE qualiddm_exige_banco()
BEGIN
  IF (SELECT COUNT(*)
        FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('avaliacoes', 'gravacoes', 'transcricoes')) < 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Banco errado. Confira a linha USE no topo deste arquivo.';
  END IF;
END$$
DELIMITER ;

CALL qualiddm_exige_banco();
DROP PROCEDURE qualiddm_exige_banco;

-- ---------------------------------------------------------------------------
-- Inventario do que vai sair, tirado ANTES de apagar.
--
-- Esta tabela nao e burocracia: depois que as avaliacoes somem, nada mais
-- liga uma gravacao a importacao a nao ser a marca na transcricao dela -- e a
-- transcricao morre em cascata junto com a gravacao. Sem a lista guardada
-- primeiro, a segunda parte do script nao tem como saber o que remover.
--
-- Ela tambem fica como comprovante: e a unica lista dos codigos MIA-... que
-- existiam, util para conferir se a reimportacao trouxe todos de volta.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS qualiddm_remocao_qualitalk;
CREATE TABLE qualiddm_remocao_qualitalk (
  codigo VARCHAR(60) NULL,
  avaliacao_id BIGINT UNSIGNED NULL,
  gravacao_id BIGINT UNSIGNED NULL,
  origem_registro VARCHAR(20) NOT NULL,
  KEY idx_remocao_gravacao (gravacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. pela avaliacao: o caminho normal
INSERT INTO qualiddm_remocao_qualitalk (codigo, avaliacao_id, gravacao_id, origem_registro)
SELECT codigo, id, gravacao_id, 'avaliacao'
  FROM avaliacoes
 WHERE ia_modelo = 'qualitalk-importacao';

-- 2. pela transcricao: pega gravacao da importacao que tenha perdido a
--    avaliacao em alguma tentativa anterior. Sem isto, ela ficaria no banco
--    para sempre, invisivel e sem dono.
INSERT INTO qualiddm_remocao_qualitalk (codigo, avaliacao_id, gravacao_id, origem_registro)
SELECT NULL, NULL, t.gravacao_id, 'transcricao'
  FROM transcricoes t
 WHERE t.provedor = 'qualitalk'
   AND t.modelo = 'importacao-qualitalk'
   -- A derivada `ja` existe para materializar o resultado antes do INSERT:
   -- ler a mesma tabela em que se esta inserindo, direto, e terreno onde o
   -- MySQL ja recusou operacao parecida por motivo semelhante.
   AND t.gravacao_id NOT IN (
       SELECT g FROM (
         SELECT gravacao_id AS g
           FROM qualiddm_remocao_qualitalk
          WHERE gravacao_id IS NOT NULL
       ) ja
   );

-- Confira ANTES de deixar o resto rodar: o esperado e 1041 avaliacoes.
SELECT origem_registro,
       COUNT(*)                       AS linhas,
       COUNT(DISTINCT gravacao_id)    AS gravacoes
  FROM qualiddm_remocao_qualitalk
 GROUP BY origem_registro;

-- ---------------------------------------------------------------------------
-- Remocao.
--
-- Ordem obrigatoria, ditada pelas chaves estrangeiras:
--   avaliacoes primeiro -- apagar cada uma leva junto, em cascata,
--     avaliacao_respostas, avaliacao_edicoes, feedbacks, contestacoes e
--     justificativas. Foi por isso que a contagem dessas cinco foi conferida
--     antes: todas deram zero, entao nada de trabalho humano se perde aqui;
--   gravacoes depois -- apagar cada uma leva a transcricao em cascata e
--     apenas anula avaliacoes.gravacao_id das que sobrarem.
--
-- O que este script NAO apaga, de proposito:
--   - clientes e campanhas: sao compartilhados com dados reais de upload;
--   - formularios/secoes/criterios criados pela importacao: ficam orfaos mas
--     inofensivos, e a reimportacao os reaproveita por ON DUPLICATE KEY. Se
--     forem apagados aqui, qualquer ficha real que use a mesma regua vai
--     junto;
--   - os usuarios "Monitoria IA" e "Gemini": ver o bloco comentado no fim.
-- ---------------------------------------------------------------------------
START TRANSACTION;

DELETE a
  FROM avaliacoes a
  JOIN qualiddm_remocao_qualitalk r ON r.avaliacao_id = a.id;

DELETE g
  FROM gravacoes g
  JOIN qualiddm_remocao_qualitalk r ON r.gravacao_id = g.id;

-- Rede de seguranca: transcricao da importacao cuja gravacao ja nao existia.
DELETE FROM transcricoes
 WHERE provedor = 'qualitalk'
   AND modelo = 'importacao-qualitalk';

COMMIT;

-- ---------------------------------------------------------------------------
-- Conferencia. As tres primeiras tem de dar 0.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM avaliacoes
    WHERE ia_modelo = 'qualitalk-importacao')                      AS avaliacoes_restantes,
  (SELECT COUNT(*) FROM transcricoes
    WHERE provedor = 'qualitalk' AND modelo = 'importacao-qualitalk') AS transcricoes_restantes,
  (SELECT COUNT(*) FROM gravacoes g
     JOIN qualiddm_remocao_qualitalk r ON r.gravacao_id = g.id)    AS gravacoes_restantes,
  (SELECT COUNT(*) FROM qualiddm_remocao_qualitalk)                AS linhas_removidas,
  (SELECT COUNT(*) FROM avaliacoes)                               AS avaliacoes_no_banco;

-- ---------------------------------------------------------------------------
-- Usuarios da importacao.
--
-- Ficam de fora da remocao automatica por precaucao: "Gemini" pode estar
-- vinculado como avaliador em analises que nao vieram desta planilha, e as
-- FKs de users sao ON DELETE SET NULL -- apagar nao daria erro, apagaria o
-- vinculo em silencio.
--
-- Depois da reimportacao com o operador correto, "Monitoria IA" nao deve
-- sobrar em nenhuma avaliacao. Confira e desative -- desativar tira da lista
-- suspensa sem quebrar historico:
--
--   SELECT COUNT(*) FROM avaliacoes a JOIN users u ON u.id = a.avaliado_id
--    WHERE u.email = 'monitoria.ia@qualiddm.local';
--
--   UPDATE users SET active = 0 WHERE email = 'monitoria.ia@qualiddm.local';
-- ---------------------------------------------------------------------------
