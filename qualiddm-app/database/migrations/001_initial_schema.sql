CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','quality_manager','reviewer','viewer') NOT NULL DEFAULT 'viewer',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY idx_user_sessions_user_id (user_id),
  KEY idx_user_sessions_expires_at (expires_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id BIGINT UNSIGNED NULL,
  name VARCHAR(140) NOT NULL,
  external_code VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_operators_wallet_id (wallet_id),
  UNIQUE KEY uq_operators_external_code (external_code),
  CONSTRAINT fk_operators_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checklist_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(140) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checklist_template_version (wallet_id, name, version),
  CONSTRAINT fk_checklist_templates_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checklist_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  label VARCHAR(180) NOT NULL,
  description TEXT NULL,
  weight DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  required TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checklist_item_position (template_id, position),
  CONSTRAINT fk_checklist_items_template
    FOREIGN KEY (template_id) REFERENCES checklist_templates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  rule_text TEXT NOT NULL,
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_business_rules_wallet_id (wallet_id),
  CONSTRAINT fk_business_rules_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  wallet_id BIGINT UNSIGNED NOT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  ai_confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('processing','approved','needs_review','rejected') NOT NULL DEFAULT 'processing',
  summary TEXT NULL,
  feedback_summary TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_public_id (public_id),
  KEY idx_reviews_created_at (created_at),
  KEY idx_reviews_wallet_created (wallet_id, created_at),
  KEY idx_reviews_operator_created (operator_id, created_at),
  KEY idx_reviews_status (status),
  CONSTRAINT fk_reviews_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  CONSTRAINT fk_reviews_operator FOREIGN KEY (operator_id) REFERENCES operators(id),
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_uploads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(255) NOT NULL,
  status ENUM('received','stored','analyzed','failed') NOT NULL DEFAULT 'received',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_review_uploads_review_id (review_id),
  CONSTRAINT fk_review_uploads_review
    FOREIGN KEY (review_id) REFERENCES reviews(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transcript_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  speaker ENUM('agent','client','system') NOT NULL,
  message_text TEXT NOT NULL,
  started_at_seconds INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transcript_position (review_id, position),
  FULLTEXT KEY ft_transcript_message_text (message_text),
  CONSTRAINT fk_transcript_messages_review
    FOREIGN KEY (review_id) REFERENCES reviews(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_checklist_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  item_label VARCHAR(180) NOT NULL,
  result ENUM('conforme','atencao','nao_conforme','nao_aplicavel') NOT NULL,
  evidence TEXT NULL,
  weight DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_checklist_position (review_id, position),
  CONSTRAINT fk_review_checklist_results_review
    FOREIGN KEY (review_id) REFERENCES reviews(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  insight_type ENUM('positive','improvement','risk','recommendation') NOT NULL,
  message_text TEXT NOT NULL,
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_insights_review_id (review_id),
  CONSTRAINT fk_ai_insights_review
    FOREIGN KEY (review_id) REFERENCES reviews(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user_created (user_id, created_at),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
