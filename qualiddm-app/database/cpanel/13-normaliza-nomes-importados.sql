-- ===========================================================================
-- Como usar no cPanel:
--   1. phpMyAdmin > clique no banco `grpia_qualiddm` na coluna da esquerda
--      (no NOME DO BANCO, nao numa tabela dentro dele)
--   2. aba SQL ou Importar > este arquivo > Executar
--
-- Se o banco ativo for outro, a trava logo abaixo interrompe o script antes de
-- qualquer alteracao, com a mensagem dizendo o que fazer.
-- ===========================================================================
-- Normaliza os nomes importados de outras plataformas: conserta acento
-- quebrado e funde as linhas duplicadas que o acento quebrado criou.
--
-- ALTERA DADOS. Rode o 12-diagnostico-nomes-importados.sql antes e exporte o
-- banco (phpMyAdmin > Exportar) -- a fusao reponta chaves estrangeiras e
-- remove linhas, e nao ha desfazer sem o dump.
--
-- Requer MySQL 8.0+ ou MariaDB 10.0.5+ (usa REGEXP_REPLACE).
--
-- Idempotente: rodar duas vezes nao piora nada. A segunda passada nao encontra
-- mojibake nem gemeo e so reescreve o log.
--
-- ---------------------------------------------------------------------------
-- Como a fusao decide quem fica
--
-- A linha CORRIGIDA e sempre a canonica. Quando "CobranÃ§a- Isaac" vira
-- "Cobranca- Isaac" e ja existe uma linha com esse nome, quem sobrevive e a
-- que ja estava certa: a quebrada entrega as referencias e sai. Nenhuma
-- gravacao, avaliacao ou usuario fica orfao -- todas as FKs sao repontadas
-- antes.
--
-- Quando o repontamento esbarra num indice unico (ex.: a campanha "Chat" ja
-- existe no cliente de destino), a linha duplicada NAO e apagada: ela e
-- desativada e renomeada com sufixo "[duplicado #id]". Some da lista suspensa,
-- que filtra por ativo = 1, e continua auditavel. Apagar ali arrastaria junto
-- as campanhas em cascata.
-- ---------------------------------------------------------------------------
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Trava de banco errado.
--
-- Importar com o banco errado selecionado no phpMyAdmin foi o primeiro tropeco
-- real com estes arquivos, e o erro que aparece ("Tabela 'campanhas'
-- desconhecida em 'information_schema'") aponta para a tabela, nao para a
-- causa. Aqui a mensagem diz o que fazer.
--
-- A checagem e por tabela, nao por nome de banco: o nome muda entre producao e
-- homologacao, as tabelas nao.
--
-- Se o banco ativo for o proprio information_schema, o CREATE PROCEDURE abaixo
-- ja falha sozinho -- que tambem serve, porque interrompe antes de qualquer
-- alteracao. Nenhum caminho chega no primeiro UPDATE com o banco errado.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS qualiddm_exige_banco;

DELIMITER $$
CREATE PROCEDURE qualiddm_exige_banco()
BEGIN
  IF (SELECT COUNT(*)
        FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('clientes', 'campanhas', 'gravacoes', 'avaliacoes')) < 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Banco errado. No phpMyAdmin, clique no NOME DO BANCO (grpia_qualiddm) na coluna da esquerda e importe de novo.';
  END IF;
END$$
DELIMITER ;

CALL qualiddm_exige_banco();
DROP PROCEDURE qualiddm_exige_banco;

-- ---------------------------------------------------------------------------
-- Mapa manual: o que a maquina nao consegue adivinhar
--
-- "N?o informado" perdeu o caractere no proprio import -- o '?' nao guarda
-- qual letra estava ali. Nenhuma conversao devolve o "a-com-til", entao a
-- correspondencia entra a mao. Acrescente uma linha aqui para cada caso que o
-- diagnostico marcou como "revisar a mao" e rode o script de novo.
--
-- A tabela fica no banco de proposito: e a memoria do que ja foi decidido, e
-- serve para o proximo import da mesma origem.
--
-- utf8mb4_bin na tabela e proposital: aqui a comparacao precisa distinguir
-- "N?o" de "Nao", e a collation _ci do resto do banco trataria as duas como a
-- mesma chave.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qualiddm_nomes_manuais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alvo ENUM('clientes','campanhas') NOT NULL,
  nome_atual VARCHAR(160) NOT NULL,
  nome_correto VARCHAR(160) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nomes_manuais (alvo, nome_atual)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO qualiddm_nomes_manuais (alvo, nome_atual, nome_correto) VALUES
  ('clientes', 'N?o informado', 'Não informado');

-- ---------------------------------------------------------------------------
-- Log da execucao. Fica no banco depois do script -- e o comprovante do que
-- foi mexido, e a primeira coisa a ler se algo sair diferente do esperado.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS qualiddm_normalizacao_log;
CREATE TABLE qualiddm_normalizacao_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tabela VARCHAR(32) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  linha_id BIGINT UNSIGNED NULL,
  canonico_id BIGINT UNSIGNED NULL,
  nome_antes VARCHAR(200) NULL,
  nome_depois VARCHAR(200) NULL,
  detalhe VARCHAR(255) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP FUNCTION  IF EXISTS qualiddm_utf8_fix;
DROP FUNCTION  IF EXISTS qualiddm_slug;
DROP PROCEDURE IF EXISTS qualiddm_repontar;
DROP PROCEDURE IF EXISTS qualiddm_fix_coluna;
DROP PROCEDURE IF EXISTS qualiddm_funde_cliente;
DROP PROCEDURE IF EXISTS qualiddm_funde_campanha;
DROP PROCEDURE IF EXISTS qualiddm_normaliza;

DELIMITER $$

-- ---------------------------------------------------------------------------
-- Desfaz "UTF-8 lido como latin1". Devolve o proprio texto quando nao ha nada
-- a desfazer, e NULL quando desfazer perderia caractere.
--
-- Trabalha em TEXT, nao VARCHAR: duas das colunas alvo (users.campanhas_
-- importadas, users.cliente_nome_importado) sao TEXT, e um parametro VARCHAR
-- truncaria o valor silenciosamente na entrada.
--
-- O laco existe porque o import pode ter passado duas vezes pelo mesmo erro
-- ("CobranÃƒÂ§a"): cada volta desencapa uma camada. Tres e teto de seguranca.
-- ---------------------------------------------------------------------------
CREATE FUNCTION qualiddm_utf8_fix(p_texto TEXT CHARACTER SET utf8mb4)
RETURNS TEXT CHARACTER SET utf8mb4
DETERMINISTIC
NO SQL
BEGIN
  DECLARE v_atual   TEXT CHARACTER SET utf8mb4;
  DECLARE v_proximo TEXT CHARACTER SET utf8mb4;
  DECLARE v_bytes   BLOB;
  DECLARE v_passo   TINYINT DEFAULT 0;

  IF p_texto IS NULL THEN RETURN NULL; END IF;
  SET v_atual = p_texto;

  WHILE v_passo < 3 AND HEX(v_atual) REGEXP 'C383|C382|C3A2' DO
    -- O intermediario e BLOB, e isso e o ponto inteiro da funcao.
    --
    -- Guardar o resultado de CONVERT(... USING latin1) numa variavel de texto
    -- desfaz a conversao na hora da atribuicao: o MySQL reconverte a string
    -- latin1 para o charset da variavel e devolve exatamente os bytes de
    -- partida. A funcao rodaria sem erro e sem efeito. BLOB nao tem charset,
    -- entao os bytes ficam como estao.
    SET v_bytes = CONVERT(v_atual USING latin1);

    -- CONVERT troca por '?' tudo que nao cabe em latin1. Se apareceu um '?'
    -- que nao existia no original, a volta perderia informacao: aborta e
    -- devolve NULL, que o chamador trata como "revisar a mao".
    IF (LENGTH(v_bytes) - LENGTH(REPLACE(v_bytes, '?', '')))
     > (CHAR_LENGTH(v_atual) - CHAR_LENGTH(REPLACE(v_atual, '?', ''))) THEN
      RETURN NULL;
    END IF;

    -- Reinterpreta os bytes como UTF-8.
    SET v_proximo = CONVERT(v_bytes USING utf8mb4);

    -- Ida e volta exata ou nada. Conforme a versao, byte invalido faz o
    -- CONVERT devolver NULL, truncar no ponto ruim ou so avisar -- comparar os
    -- bytes de volta cobre os tres casos com uma regra so.
    --
    -- E o que salva um "NAO" legitimo (com til no A) de virar lixo: os bytes
    -- C3 4F nao formam UTF-8 valido, a volta nao bate, a linha fica intacta.
    IF v_proximo IS NULL
       OR v_proximo = ''
       OR HEX(CAST(v_proximo AS BINARY)) <> HEX(v_bytes) THEN
      RETURN NULL;
    END IF;

    SET v_atual = v_proximo;
    SET v_passo = v_passo + 1;
  END WHILE;

  RETURN v_atual;
END$$

-- ---------------------------------------------------------------------------
-- Mesmo slug que o app gera em JS (normalize NFD + remocao de diacritico),
-- escrito em SQL. Se os dois divergirem, o mesmo cliente ganha slugs
-- diferentes conforme quem o criou -- e o slug e chave de busca em
-- resolverClienteId, no upload.
-- ---------------------------------------------------------------------------
CREATE FUNCTION qualiddm_slug(p_nome VARCHAR(200) CHARACTER SET utf8mb4)
RETURNS VARCHAR(120) CHARACTER SET utf8mb4
DETERMINISTIC
NO SQL
BEGIN
  DECLARE v VARCHAR(300) CHARACTER SET utf8mb4;

  SET v = LOWER(TRIM(COALESCE(p_nome, '')));
  SET v = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(v, 'á','a'), 'à','a'), 'â','a'), 'ã','a'), 'ä','a');
  SET v = REPLACE(REPLACE(REPLACE(REPLACE(v, 'é','e'), 'è','e'), 'ê','e'), 'ë','e');
  SET v = REPLACE(REPLACE(REPLACE(REPLACE(v, 'í','i'), 'ì','i'), 'î','i'), 'ï','i');
  SET v = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(v, 'ó','o'), 'ò','o'), 'ô','o'), 'õ','o'), 'ö','o');
  SET v = REPLACE(REPLACE(REPLACE(REPLACE(v, 'ú','u'), 'ù','u'), 'û','u'), 'ü','u');
  SET v = REPLACE(REPLACE(v, 'ç','c'), 'ñ','n');
  SET v = REGEXP_REPLACE(v, '[^a-z0-9]+', '-');
  SET v = TRIM(BOTH '-' FROM v);

  RETURN LEFT(v, 110);
END$$

-- ---------------------------------------------------------------------------
-- Reponta toda FK que apontava para `p_de` em `p_tabela_ref` para `p_para`.
--
-- As tabelas nao entram numa lista fixa: sao lidas de KEY_COLUMN_USAGE. Uma
-- lista escrita a mao envelhece na proxima migration e deixa referencia orfa
-- sem ninguem perceber.
--
-- UPDATE IGNORE porque o destino pode ja ter a linha equivalente (indice
-- unico). Nesse caso a linha fica onde estava e `p_sobras` volta > 0 -- e o
-- chamador desativa a duplicata em vez de apagar.
-- ---------------------------------------------------------------------------
CREATE PROCEDURE qualiddm_repontar(
  IN  p_tabela_ref VARCHAR(64),
  IN  p_de         BIGINT UNSIGNED,
  IN  p_para       BIGINT UNSIGNED,
  OUT p_sobras     INT)
BEGIN
  DECLARE v_fim    TINYINT DEFAULT 0;
  DECLARE v_tabela VARCHAR(64);
  DECLARE v_coluna VARCHAR(64);

  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME, COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME = p_tabela_ref
     ORDER BY TABLE_NAME, COLUMN_NAME;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fim = 1;

  SET p_sobras = 0;

  OPEN cur;
  laco: LOOP
    FETCH cur INTO v_tabela, v_coluna;
    IF v_fim = 1 THEN LEAVE laco; END IF;

    SET @sql = CONCAT('UPDATE IGNORE `', v_tabela, '` SET `', v_coluna, '` = ', p_para,
                      ' WHERE `', v_coluna, '` = ', p_de);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

    SET @sobra = 0;
    SET @sql = CONCAT('SELECT COUNT(*) INTO @sobra FROM `', v_tabela,
                      '` WHERE `', v_coluna, '` = ', p_de);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

    IF @sobra > 0 THEN
      SET p_sobras = p_sobras + @sobra;
      INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, canonico_id, detalhe)
      VALUES (p_tabela_ref, 'referencia nao movida', p_de, p_para,
              CONCAT(v_tabela, '.', v_coluna, ': ', @sobra, ' linha(s) barradas por indice unico'));
    END IF;
  END LOOP;
  CLOSE cur;
END$$

-- ---------------------------------------------------------------------------
-- Conserta o acento de UMA coluna de texto qualquer.
--
-- Existe como procedimento para que a lista de colunas fique explicita la
-- embaixo, uma CALL por coluna. Se o relatorio 5 do diagnostico apontar outra
-- coluna que valha a pena, basta acrescentar uma CALL -- nao e preciso mexer
-- na logica.
--
-- Checa a existencia da coluna antes: nem todo ambiente rodou o 08/09, e um
-- ALTER faltando nao pode derrubar a normalizacao inteira.
-- ---------------------------------------------------------------------------
CREATE PROCEDURE qualiddm_fix_coluna(
  IN p_tabela VARCHAR(64),
  IN p_coluna VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = p_tabela
                AND COLUMN_NAME = p_coluna) THEN

    SET @sql = CONCAT(
      'UPDATE `', p_tabela, '` SET `', p_coluna, '` = qualiddm_utf8_fix(`', p_coluna, '`) ',
      ' WHERE HEX(`', p_coluna, '`) REGEXP ''C383|C382|C3A2'' ',
      '   AND qualiddm_utf8_fix(`', p_coluna, '`) IS NOT NULL');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    SET @afetadas = ROW_COUNT();
    DEALLOCATE PREPARE stmt;

    IF @afetadas > 0 THEN
      INSERT INTO qualiddm_normalizacao_log (tabela, acao, detalhe)
      VALUES (p_tabela, 'coluna corrigida', CONCAT(p_coluna, ': ', @afetadas, ' linha(s)'));
    END IF;
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- Funde duas campanhas: `p_dup` entrega as referencias para `p_canon`.
-- ---------------------------------------------------------------------------
CREATE PROCEDURE qualiddm_funde_campanha(
  IN p_dup   BIGINT UNSIGNED,
  IN p_canon BIGINT UNSIGNED)
BEGIN
  DECLARE v_sobras INT DEFAULT 0;
  DECLARE v_nome   VARCHAR(160) CHARACTER SET utf8mb4;

  SET v_nome = (SELECT nome FROM campanhas WHERE id = p_dup);
  CALL qualiddm_repontar('campanhas', p_dup, p_canon, v_sobras);

  IF v_sobras = 0 THEN
    DELETE FROM campanhas WHERE id = p_dup;
    INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, canonico_id, nome_antes)
    VALUES ('campanhas', 'duplicada removida', p_dup, p_canon, v_nome);
  ELSE
    UPDATE campanhas
       SET ativa = 0,
           nome = LEFT(CONCAT(nome, ' [duplicado #', id, ']'), 160)
     WHERE id = p_dup;
    INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, canonico_id, nome_antes, detalhe)
    VALUES ('campanhas', 'duplicada desativada', p_dup, p_canon, v_nome,
            'sobrou referencia barrada por indice unico');
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- Funde dois clientes.
--
-- As campanhas do cliente duplicado sao tratadas ANTES do repontamento
-- generico: se o cliente canonico ja tem campanha com o mesmo nome, o par
-- precisa virar um so, senao o indice (cliente_id, nome) barra a mudanca e a
-- campanha fica presa no cliente antigo.
--
-- O laco reconsulta a cada volta em vez de usar cursor: a fusao apaga linhas
-- de `campanhas`, e um cursor aberto sobre a tabela que esta sendo alterada e
-- terreno movedico. Cada volta ou funde um par ou termina, porque a campanha
-- fundida some ou muda de nome -- entao a consulta sempre encolhe.
-- ---------------------------------------------------------------------------
CREATE PROCEDURE qualiddm_funde_cliente(
  IN p_dup   BIGINT UNSIGNED,
  IN p_canon BIGINT UNSIGNED)
BEGIN
  DECLARE v_sobras  INT DEFAULT 0;
  DECLARE v_ca_id   BIGINT UNSIGNED;
  DECLARE v_gemeo   BIGINT UNSIGNED;
  DECLARE v_nome    VARCHAR(160) CHARACTER SET utf8mb4;
  DECLARE v_voltas  INT DEFAULT 0;

  SET v_nome = (SELECT nome FROM clientes WHERE id = p_dup);

  laco: LOOP
    SET v_voltas = v_voltas + 1;
    IF v_voltas > 500 THEN LEAVE laco; END IF;

    SET v_ca_id = (SELECT d.id
                     FROM campanhas d
                     JOIN campanhas c ON c.cliente_id = p_canon AND c.nome = d.nome
                    WHERE d.cliente_id = p_dup
                    LIMIT 1);
    IF v_ca_id IS NULL THEN LEAVE laco; END IF;

    SET v_gemeo = (SELECT c.id
                     FROM campanhas d
                     JOIN campanhas c ON c.cliente_id = p_canon AND c.nome = d.nome
                    WHERE d.id = v_ca_id
                    LIMIT 1);
    IF v_gemeo IS NULL THEN LEAVE laco; END IF;

    CALL qualiddm_funde_campanha(v_ca_id, v_gemeo);
  END LOOP;

  CALL qualiddm_repontar('clientes', p_dup, p_canon, v_sobras);

  IF v_sobras = 0 THEN
    DELETE FROM clientes WHERE id = p_dup;
    INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, canonico_id, nome_antes)
    VALUES ('clientes', 'duplicado removido', p_dup, p_canon, v_nome);
  ELSE
    UPDATE clientes
       SET ativo = 0,
           nome = LEFT(CONCAT(nome, ' [duplicado #', id, ']'), 160),
           slug = LEFT(CONCAT(slug, '-dup-', id), 120)
     WHERE id = p_dup;
    INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, canonico_id, nome_antes, detalhe)
    VALUES ('clientes', 'duplicado desativado', p_dup, p_canon, v_nome,
            'sobrou referencia barrada por indice unico');
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- Passada principal.
--
-- Percorre por id crescente e reconsulta cada linha, em vez de cursor: a
-- passada apaga linhas de `clientes` e `campanhas` enquanto caminha, e um
-- cursor sobre a tabela em alteracao nao da garantia. Linha que sumiu no meio
-- do caminho volta NULL e e pulada.
--
-- Cuidado que vale registrar: `SELECT ... INTO variavel` que nao acha linha
-- dispara NOT FOUND e acionaria o handler do procedimento, encerrando o laco
-- no meio. Por isso toda busca opcional aqui e `SET x = (SELECT ...)`, que
-- devolve NULL sem levantar condicao.
-- ---------------------------------------------------------------------------
CREATE PROCEDURE qualiddm_normaliza()
BEGIN
  DECLARE v_id     BIGINT UNSIGNED;
  DECLARE v_prox   BIGINT UNSIGNED;
  DECLARE v_cli    BIGINT UNSIGNED;
  DECLARE v_nome   VARCHAR(160) CHARACTER SET utf8mb4;
  DECLARE v_novo   VARCHAR(200) CHARACTER SET utf8mb4;
  DECLARE v_manual VARCHAR(160) CHARACTER SET utf8mb4;
  DECLARE v_gemeo  BIGINT UNSIGNED;
  DECLARE v_slug   VARCHAR(120) CHARACTER SET utf8mb4;

  -- === clientes ============================================================
  SET v_id = 0;
  laco_cli: LOOP
    SET v_prox = (SELECT MIN(id) FROM clientes WHERE id > v_id);
    IF v_prox IS NULL THEN LEAVE laco_cli; END IF;
    SET v_id = v_prox;

    SET v_nome = (SELECT nome FROM clientes WHERE id = v_id);
    IF v_nome IS NOT NULL THEN
      -- Mapa manual primeiro: e a unica fonte para o que se perdeu no import.
      SET v_manual = (SELECT nome_correto
                        FROM qualiddm_nomes_manuais
                       WHERE alvo = 'clientes'
                         AND nome_atual = v_nome COLLATE utf8mb4_bin
                       LIMIT 1);

      SET v_novo = COALESCE(v_manual, qualiddm_utf8_fix(v_nome), v_nome);
      SET v_novo = TRIM(REGEXP_REPLACE(v_novo, '[[:space:]]+', ' '));

      -- Comparacao binaria de proposito: a collation do banco e
      -- utf8mb4_unicode_ci, que ignora acento, e sob ela "Cobranca" e
      -- "Cobranca-com-cedilha" sao iguais -- uma correcao que so acrescenta
      -- acento seria descartada aqui sem deixar rastro.
      IF v_novo COLLATE utf8mb4_bin <> v_nome THEN
        SET v_gemeo = (SELECT id FROM clientes WHERE nome = v_novo AND id <> v_id LIMIT 1);

        IF v_gemeo IS NOT NULL THEN
          -- O nome certo ja existe: esta linha e a duplicata.
          CALL qualiddm_funde_cliente(v_id, v_gemeo);
        ELSE
          SET v_slug = qualiddm_slug(v_novo);
          IF (SELECT COUNT(*) FROM clientes WHERE slug = v_slug AND id <> v_id) > 0 THEN
            SET v_slug = LEFT(CONCAT(v_slug, '-', v_id), 120);
          END IF;

          INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, nome_antes, nome_depois)
          VALUES ('clientes', 'nome corrigido', v_id, v_nome, v_novo);

          UPDATE clientes SET nome = v_novo, slug = v_slug WHERE id = v_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- === campanhas ===========================================================
  SET v_id = 0;
  laco_cam: LOOP
    SET v_prox = (SELECT MIN(id) FROM campanhas WHERE id > v_id);
    IF v_prox IS NULL THEN LEAVE laco_cam; END IF;
    SET v_id = v_prox;

    SET v_nome = (SELECT nome FROM campanhas WHERE id = v_id);
    SET v_cli  = (SELECT cliente_id FROM campanhas WHERE id = v_id);

    IF v_nome IS NOT NULL THEN
      SET v_manual = (SELECT nome_correto
                        FROM qualiddm_nomes_manuais
                       WHERE alvo = 'campanhas'
                         AND nome_atual = v_nome COLLATE utf8mb4_bin
                       LIMIT 1);

      SET v_novo = COALESCE(v_manual, qualiddm_utf8_fix(v_nome), v_nome);
      SET v_novo = TRIM(REGEXP_REPLACE(v_novo, '[[:space:]]+', ' '));

      -- Comparacao binaria de proposito: a collation do banco e
      -- utf8mb4_unicode_ci, que ignora acento, e sob ela "Cobranca" e
      -- "Cobranca-com-cedilha" sao iguais -- uma correcao que so acrescenta
      -- acento seria descartada aqui sem deixar rastro.
      IF v_novo COLLATE utf8mb4_bin <> v_nome THEN
        SET v_gemeo = (SELECT id
                         FROM campanhas
                        WHERE nome = v_novo
                          AND id <> v_id
                          AND (cliente_id = v_cli OR (cliente_id IS NULL AND v_cli IS NULL))
                        LIMIT 1);

        IF v_gemeo IS NOT NULL THEN
          CALL qualiddm_funde_campanha(v_id, v_gemeo);
        ELSE
          INSERT INTO qualiddm_normalizacao_log (tabela, acao, linha_id, nome_antes, nome_depois)
          VALUES ('campanhas', 'nome corrigido', v_id, v_nome, v_novo);

          UPDATE campanhas SET nome = v_novo WHERE id = v_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END$$

DELIMITER ;

START TRANSACTION;

CALL qualiddm_normaliza();

-- Nomes de pessoa e os campos de texto que a importacao gravou.
--
-- Lista curada, nao varredura. Coluna de texto longo (transcricao, resumo,
-- evidencia) fica de fora de proposito: o ganho e cosmetico e o risco de
-- reescrever prova de monitoria nao e.
CALL qualiddm_fix_coluna('users', 'name');
CALL qualiddm_fix_coluna('users', 'cliente_nome_importado');
CALL qualiddm_fix_coluna('users', 'campanhas_importadas');
CALL qualiddm_fix_coluna('users', 'superior_nome_importado');
CALL qualiddm_fix_coluna('users', 'turno_nome_importado');

-- Nome de formulario aparece no cabecalho da ficha ("FORMULARIO EDUCACIONAL |
-- RECEPTIVO"), entao o acento quebrado ali e visivel em toda monitoria daquela
-- regua -- e nao so numa lista suspensa.
CALL qualiddm_fix_coluna('formularios', 'nome');
CALL qualiddm_fix_coluna('formulario_categorias', 'nome');
CALL qualiddm_fix_coluna('formulario_criterios', 'nome');
CALL qualiddm_fix_coluna('formulario_secoes', 'nome');

COMMIT;

-- ---------------------------------------------------------------------------
-- O que foi feito. Confira antes de dar por encerrado -- em especial as linhas
-- "duplicado desativado" e "referencia nao movida", que sao as que sobraram
-- para tratamento manual.
-- ---------------------------------------------------------------------------
SELECT * FROM qualiddm_normalizacao_log ORDER BY id;

-- O que ainda tem acento quebrado depois da passada. Vazio = terminou. Cada
-- linha que sobrar precisa de uma entrada em qualiddm_nomes_manuais.
SELECT 'clientes' AS tabela, id, nome FROM clientes
 WHERE HEX(nome) REGEXP 'C383|C382|C3A2' OR nome LIKE '%?%'
UNION ALL
SELECT 'campanhas', id, nome FROM campanhas
 WHERE HEX(nome) REGEXP 'C383|C382|C3A2' OR nome LIKE '%?%';

DROP PROCEDURE qualiddm_normaliza;
DROP PROCEDURE qualiddm_funde_cliente;
DROP PROCEDURE qualiddm_funde_campanha;
DROP PROCEDURE qualiddm_fix_coluna;
DROP PROCEDURE qualiddm_repontar;
DROP FUNCTION  qualiddm_slug;
DROP FUNCTION  qualiddm_utf8_fix;
