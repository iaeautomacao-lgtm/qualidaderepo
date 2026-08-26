-- ===========================================================================
-- Como usar no cPanel:
--   1. phpMyAdmin > clique no banco `grpia_qualiddm` na coluna da esquerda
--      (no NOME DO BANCO, nao numa tabela dentro dele)
--   2. aba SQL ou Importar > este arquivo > Executar
--
-- Se o banco ativo for outro, o erro e este e nao tem a ver com o script:
--   #1109 - Tabela 'campanhas' desconhecida em 'information_schema'
-- Acontece quando o phpMyAdmin esta com o information_schema selecionado --
-- basta voltar ao banco certo e repetir. Este arquivo e somente leitura,
-- entao uma execucao interrompida no meio nao deixa nada pela metade.
-- ===========================================================================
-- Diagnostico dos nomes importados de outras plataformas.
--
-- SOMENTE LEITURA: nenhuma linha e alterada por este arquivo. Rode no
-- phpMyAdmin, confira os cinco relatorios e so depois aplique o
-- 13-normaliza-nomes-importados.sql.
--
-- O que este arquivo procura:
--   a) nome com acento quebrado ("CobranÃ§a") -- UTF-8 gravado por uma conexao
--      latin1, e por isso reversivel byte a byte;
--   b) nome com perda real ("N?o informado") -- o caractere ja morreu no
--      import e nenhuma conversao traz de volta: entra no mapa manual;
--   c) o par duplicado que cada correcao vai encontrar do outro lado.
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Como as tabelas estao declaradas
--
-- Se a collation ja for utf8mb4, o problema esta nos DADOS (byte duplo-
-- codificado), nao no schema -- e a correcao e por linha, nao por ALTER TABLE.
-- ---------------------------------------------------------------------------
SELECT TABLE_NAME AS tabela, TABLE_COLLATION AS collation_atual
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('clientes', 'campanhas', 'users')
 ORDER BY TABLE_NAME;

-- ---------------------------------------------------------------------------
-- 2. Clientes: nome atual -> nome proposto -> com quem vai colidir
--
-- `nome_proposto` e NULL quando a correcao automatica NAO e segura. Duas
-- guardas produzem esse NULL, e as duas sao intencionais:
--
--   - a marca de mojibake (bytes C383/C382/C3A2) nao existe na linha, entao
--     nao ha o que desfazer;
--   - a volta para latin1 introduziu '?' que nao estava no original, ou seja
--     algum caractere se perderia. Melhor nao mexer do que mexer errado.
--
-- Por que HEX() e nao REGEXP no proprio nome: a collation utf8mb4_unicode_ci
-- ignora acento, entao `nome REGEXP 'A-com-til'` casaria tambem com um 'A'
-- comum e o relatorio acusaria linha sadia. O HEX e ASCII puro e compara byte.
--
-- `id_do_gemeo` preenchido = a correcao vai esbarrar numa linha que ja existe
-- com o nome certo. Essa e a duplicata: as duas viram uma so no script 13.
-- ---------------------------------------------------------------------------
SELECT p.id,
       p.nome            AS nome_atual,
       p.nome_proposto,
       CASE WHEN p.nome_proposto IS NULL THEN 'revisar a mao' ELSE 'automatico' END AS correcao,
       g.id              AS id_do_gemeo,
       g.nome            AS nome_do_gemeo,
       p.ativo,
       (SELECT COUNT(*) FROM campanhas  x WHERE x.cliente_id = p.id) AS campanhas,
       (SELECT COUNT(*) FROM gravacoes  x WHERE x.cliente_id = p.id) AS gravacoes,
       (SELECT COUNT(*) FROM avaliacoes x WHERE x.cliente_id = p.id) AS avaliacoes,
       (SELECT COUNT(*) FROM users      x WHERE x.cliente_id = p.id) AS usuarios
  FROM (
    SELECT c.id, c.nome, c.ativo,
           CASE
             WHEN HEX(c.nome) NOT REGEXP 'C383|C382|C3A2' THEN NULL
             WHEN (CHAR_LENGTH(CONVERT(c.nome USING latin1))
                   - CHAR_LENGTH(REPLACE(CONVERT(c.nome USING latin1), '?', '')))
                > (CHAR_LENGTH(c.nome) - CHAR_LENGTH(REPLACE(c.nome, '?', ''))) THEN NULL
             ELSE CONVERT(BINARY(CONVERT(c.nome USING latin1)) USING utf8mb4)
           END AS nome_proposto
      FROM clientes c
  ) p
  LEFT JOIN clientes g
    ON g.nome = p.nome_proposto AND g.id <> p.id
 WHERE p.nome_proposto IS NOT NULL
    OR HEX(p.nome) REGEXP 'C383|C382|C3A2'
    OR p.nome LIKE '%?%'
    OR p.nome <> TRIM(p.nome)
    OR p.nome LIKE '%  %'
 ORDER BY p.nome;

-- ---------------------------------------------------------------------------
-- 3. Campanhas: mesmo relatorio
--
-- A unicidade de campanha e (cliente_id, nome), nao o nome sozinho -- dois
-- clientes tem uma campanha "Chat" cada e isso e legitimo. Por isso o gemeo
-- so conta como duplicata dentro do mesmo cliente.
-- ---------------------------------------------------------------------------
SELECT p.id,
       p.cliente_id,
       p.nome            AS nome_atual,
       p.nome_proposto,
       g.id              AS id_do_gemeo,
       p.ativa,
       (SELECT COUNT(*) FROM gravacoes  x WHERE x.campanha_id = p.id) AS gravacoes,
       (SELECT COUNT(*) FROM avaliacoes x WHERE x.campanha_id = p.id) AS avaliacoes
  FROM (
    SELECT ca.id, ca.cliente_id, ca.nome, ca.ativa,
           CASE
             WHEN HEX(ca.nome) NOT REGEXP 'C383|C382|C3A2' THEN NULL
             WHEN (CHAR_LENGTH(CONVERT(ca.nome USING latin1))
                   - CHAR_LENGTH(REPLACE(CONVERT(ca.nome USING latin1), '?', '')))
                > (CHAR_LENGTH(ca.nome) - CHAR_LENGTH(REPLACE(ca.nome, '?', ''))) THEN NULL
             ELSE CONVERT(BINARY(CONVERT(ca.nome USING latin1)) USING utf8mb4)
           END AS nome_proposto
      FROM campanhas ca
  ) p
  LEFT JOIN campanhas g
    ON g.nome = p.nome_proposto
   AND g.id <> p.id
   AND (g.cliente_id = p.cliente_id OR (g.cliente_id IS NULL AND p.cliente_id IS NULL))
 WHERE p.nome_proposto IS NOT NULL
    OR HEX(p.nome) REGEXP 'C383|C382|C3A2'
    OR p.nome LIKE '%?%'
    OR p.nome <> TRIM(p.nome)
    OR p.nome LIKE '%  %'
 ORDER BY p.cliente_id, p.nome;

-- ---------------------------------------------------------------------------
-- 4. Duplicata sem mojibake: so espaco sobrando
--
-- "Empresarial - Cobranca" e "Empresarial  -  Cobranca" passam pelo indice
-- unico como nomes diferentes, e viram duas linhas na lista suspensa. Aqui
-- eles aparecem agrupados pela forma com espaco normalizado.
-- ---------------------------------------------------------------------------
SELECT TRIM(REGEXP_REPLACE(nome, '[[:space:]]+', ' ')) AS nome_normalizado,
       COUNT(*)                                        AS linhas,
       GROUP_CONCAT(id ORDER BY id)                    AS ids,
       GROUP_CONCAT(CONCAT('[', nome, ']') ORDER BY id SEPARATOR ' | ') AS variantes
  FROM clientes
 GROUP BY nome_normalizado
HAVING COUNT(*) > 1
 ORDER BY nome_normalizado;

-- ---------------------------------------------------------------------------
-- 5. Onde mais existe mojibake no banco
--
-- Varre toda coluna de texto curta (<= 255) do schema procurando a marca. E
-- so um mapa: o script 13 corrige a lista curada (clientes, campanhas, nomes
-- de usuario). Se algo importante aparecer aqui e ficar de fora, incluir a
-- coluna e uma linha no script 13 -- varrer texto longo/JSON as cegas nao
-- vale o risco de reescrever transcricao ou evidencia.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS qualiddm_varre_mojibake;

DELIMITER $$
CREATE PROCEDURE qualiddm_varre_mojibake()
BEGIN
  DECLARE v_fim TINYINT DEFAULT 0;
  DECLARE v_tabela VARCHAR(64);
  DECLARE v_coluna VARCHAR(64);

  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME, COLUMN_NAME
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND DATA_TYPE IN ('char', 'varchar')
       AND CHARACTER_MAXIMUM_LENGTH <= 255
     ORDER BY TABLE_NAME, COLUMN_NAME;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fim = 1;

  DROP TEMPORARY TABLE IF EXISTS qualiddm_mojibake_encontrado;
  CREATE TEMPORARY TABLE qualiddm_mojibake_encontrado (
    tabela VARCHAR(64),
    coluna VARCHAR(64),
    linhas INT,
    exemplo VARCHAR(255)
  );

  OPEN cur;
  laco: LOOP
    FETCH cur INTO v_tabela, v_coluna;
    IF v_fim = 1 THEN LEAVE laco; END IF;

    SET @sql = CONCAT(
      'INSERT INTO qualiddm_mojibake_encontrado ',
      'SELECT ', QUOTE(v_tabela), ', ', QUOTE(v_coluna), ', COUNT(*), MAX(`', v_coluna, '`) ',
      '  FROM `', v_tabela, '` ',
      ' WHERE HEX(`', v_coluna, '`) REGEXP ''C383|C382|C3A2'' ',
      'HAVING COUNT(*) > 0');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;

  SELECT * FROM qualiddm_mojibake_encontrado ORDER BY linhas DESC, tabela, coluna;
  DROP TEMPORARY TABLE qualiddm_mojibake_encontrado;
END$$
DELIMITER ;

CALL qualiddm_varre_mojibake();
DROP PROCEDURE qualiddm_varre_mojibake;
