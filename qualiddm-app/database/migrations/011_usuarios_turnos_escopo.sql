-- 011 - Usuarios, turnos e escopo por campanha
--
-- Complementa a gestao de usuarios com os campos existentes na planilha
-- usuarios_20260820.xlsx e cria a tabela de acesso por campanha. Pode ser
-- executado mais de uma vez: cada coluna/indice so e criado se estiver ausente.

DROP PROCEDURE IF EXISTS qualiddm_add_column_if_missing;
DROP PROCEDURE IF EXISTS qualiddm_add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE qualiddm_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
       AND COLUMN_NAME = p_column_name
  ) THEN
    SET @qualiddm_sql = p_ddl;
    PREPARE qualiddm_stmt FROM @qualiddm_sql;
    EXECUTE qualiddm_stmt;
    DEALLOCATE PREPARE qualiddm_stmt;
  END IF;
END$$

CREATE PROCEDURE qualiddm_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
       AND INDEX_NAME = p_index_name
  ) THEN
    SET @qualiddm_sql = p_ddl;
    PREPARE qualiddm_stmt FROM @qualiddm_sql;
    EXECUTE qualiddm_stmt;
    DEALLOCATE PREPARE qualiddm_stmt;
  END IF;
END$$

DELIMITER ;

CALL qualiddm_add_column_if_missing('users', 'login', 'ALTER TABLE users ADD COLUMN login VARCHAR(120) NULL AFTER supervisor_id');
CALL qualiddm_add_column_if_missing('users', 'cpf', 'ALTER TABLE users ADD COLUMN cpf VARCHAR(20) NULL AFTER login');
CALL qualiddm_add_column_if_missing('users', 'matricula', 'ALTER TABLE users ADD COLUMN matricula VARCHAR(80) NULL AFTER cpf');
CALL qualiddm_add_column_if_missing('users', 'data_inicio_produto', 'ALTER TABLE users ADD COLUMN data_inicio_produto DATE NULL AFTER external_code');
CALL qualiddm_add_column_if_missing('users', 'hierarquia_vigencia', 'ALTER TABLE users ADD COLUMN hierarquia_vigencia DATE NULL AFTER data_inicio_produto');
CALL qualiddm_add_column_if_missing('users', 'hierarquia_motivo', 'ALTER TABLE users ADD COLUMN hierarquia_motivo VARCHAR(255) NULL AFTER hierarquia_vigencia');

CALL qualiddm_add_index_if_missing('users', 'idx_users_turno', 'ALTER TABLE users ADD KEY idx_users_turno (turno_id)');
CALL qualiddm_add_index_if_missing('users', 'idx_users_login', 'ALTER TABLE users ADD KEY idx_users_login (login)');
CALL qualiddm_add_index_if_missing('users', 'idx_users_cpf', 'ALTER TABLE users ADD KEY idx_users_cpf (cpf)');
CALL qualiddm_add_index_if_missing('users', 'idx_users_matricula', 'ALTER TABLE users ADD KEY idx_users_matricula (matricula)');

DROP PROCEDURE qualiddm_add_column_if_missing;
DROP PROCEDURE qualiddm_add_index_if_missing;

CREATE TABLE IF NOT EXISTS user_campanhas (
  user_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, campanha_id),
  KEY idx_user_campanhas_campanha (campanha_id),
  CONSTRAINT fk_user_campanhas_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_campanhas_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
