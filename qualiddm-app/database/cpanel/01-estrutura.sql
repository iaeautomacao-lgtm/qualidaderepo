-- ===========================================================================
-- QualiDDM — ESTRUTURA (parte 1 de 2)
--
-- Como usar no cPanel:
--   1. phpMyAdmin > selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   3. depois execute `02-dados.sql` da mesma forma
--
-- ATENÇÃO: os DROP TABLE abaixo APAGAM as tabelas do QualiDDM se já existirem.
-- Num banco novo isso não faz nada. Num banco que já tem dado de produção,
-- APAGA TUDO. Só execute se tiver certeza de que o banco está vazio ou de que
-- o dado atual pode ser descartado.
--
-- Requer MySQL 8.0.16+ ou MariaDB 10.2+ (por causa da restrição CHECK na
-- tabela formulario_criterios). Se o servidor for mais antigo e acusar erro
-- nessa linha, remova apenas o bloco CONSTRAINT ck_criterio_peso_ou_eliminatoria
-- — a regra passa a valer só na aplicação.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS contestacoes;
DROP TABLE IF EXISTS feedbacks;
DROP TABLE IF EXISTS avaliacao_respostas;
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS formulario_criterios;
DROP TABLE IF EXISTS formulario_secoes;
DROP TABLE IF EXISTS formulario_campanhas;
DROP TABLE IF EXISTS formularios;
DROP TABLE IF EXISTS campanhas;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Pessoas e acesso
-- ---------------------------------------------------------------------------

-- Uma tabela só para todo mundo: administrador, monitor, supervisor e operador
-- avaliado. Separar em tabelas diferentes obrigaria a duplicar login, e o
-- mesmo profissional às vezes acumula papéis.
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL,
  -- Formato: pbkdf2$iteracoes$salt$hash. Nunca guarde senha em texto puro.
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrador','monitor','supervisor','operador','viewer')
    NOT NULL DEFAULT 'viewer',
  external_code VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guarda o HASH do token, nunca o token. Se esta tabela vazar, ninguém
-- consegue se passar por usuário com o conteúdo dela.
CREATE TABLE user_sessions (
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trilha de auditoria. A tabela existe desde o início mas ainda não é
-- alimentada pela aplicação — está na lista de pendências de segurança.
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(80) NULL,
  entidade_id VARCHAR(40) NULL,
  detalhe TEXT NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_acao_data (acao, created_at),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Clientes e campanhas
-- ---------------------------------------------------------------------------

CREATE TABLE clientes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  contrato VARCHAR(40) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_slug (slug),
  UNIQUE KEY uq_clientes_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campanhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NULL,
  nome VARCHAR(160) NOT NULL,
  canal ENUM('telefone','chat','email','whatsapp','offline','outro')
    NOT NULL DEFAULT 'outro',
  favorita TINYINT(1) NOT NULL DEFAULT 0,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Unicidade por cliente, não global: o sistema de origem tem duas campanhas
  -- chamadas "Chat", em clientes diferentes.
  UNIQUE KEY uq_campanhas_cliente_nome (cliente_id, nome),
  KEY idx_campanhas_cliente (cliente_id),
  CONSTRAINT fk_campanhas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Formulários (fichas de avaliação)
-- ---------------------------------------------------------------------------

CREATE TABLE formularios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(180) NOT NULL,
  categoria ENUM('padrao','diagnostico') NOT NULL DEFAULT 'padrao',
  status ENUM('ativo','rascunho','desenvolvimento','inativo') NOT NULL DEFAULT 'rascunho',
  versao INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formularios_versao (cliente_id, nome, versao),
  KEY idx_formularios_cliente (cliente_id),
  CONSTRAINT fk_formularios_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Um formulário atende várias campanhas e uma campanha pode ter mais de um.
CREATE TABLE formulario_campanhas (
  formulario_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (formulario_id, campanha_id),
  KEY idx_formulario_campanhas_campanha (campanha_id),
  CONSTRAINT fk_formulario_campanhas_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE CASCADE,
  CONSTRAINT fk_formulario_campanhas_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formulario_secoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  formulario_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT NULL,
  posicao INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formulario_secoes_posicao (formulario_id, posicao),
  CONSTRAINT fk_formulario_secoes_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formulario_criterios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  secao_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(200) NOT NULL,
  enunciado TEXT NOT NULL,
  peso_pts DECIMAL(6,2) NULL,
  eliminatoria TINYINT(1) NOT NULL DEFAULT 0,
  posicao INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formulario_criterios_posicao (secao_id, posicao),
  -- Regra central da monitoria: o critério OU vale pontos OU é eliminatório
  -- (NCG). Nunca os dois, nunca nenhum dos dois.
  CONSTRAINT ck_criterio_peso_ou_eliminatoria CHECK (
    (eliminatoria = 1 AND peso_pts IS NULL) OR
    (eliminatoria = 0 AND peso_pts IS NOT NULL)
  ),
  CONSTRAINT fk_formulario_criterios_secao
    FOREIGN KEY (secao_id) REFERENCES formulario_secoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------

CREATE TABLE avaliacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Código que aparece na tela: QA-26-000541
  codigo VARCHAR(20) NOT NULL,
  cod_gravacao VARCHAR(60) NULL,
  cliente_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NULL,
  formulario_id BIGINT UNSIGNED NOT NULL,
  avaliado_id BIGINT UNSIGNED NOT NULL,
  avaliador_id BIGINT UNSIGNED NOT NULL,
  supervisor_id BIGINT UNSIGNED NULL,
  categoria ENUM('padrao','diagnostico') NOT NULL DEFAULT 'padrao',
  origem ENUM('humana','ia') NOT NULL DEFAULT 'humana',
  score DECIMAL(6,2) NULL,
  zerada TINYINT(1) NOT NULL DEFAULT 0,
  quadrante ENUM('1Q','2Q','3Q','4Q','5Q') NULL,
  duracao_segundos INT UNSIGNED NULL,
  audio_path VARCHAR(500) NULL,
  data_contato DATETIME NULL,
  data_avaliacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prazo_feedback DATE NULL,
  prazo_contestacao DATE NULL,
  status_feedback ENUM('pendente','aplicado','dispensado') NOT NULL DEFAULT 'pendente',
  total_conformes INT UNSIGNED NOT NULL DEFAULT 0,
  total_nao_conformes INT UNSIGNED NOT NULL DEFAULT 0,
  total_nao_aplicaveis INT UNSIGNED NOT NULL DEFAULT 0,
  total_criterios INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avaliacoes_codigo (codigo),
  -- Índices desenhados para os filtros da tela de Avaliações e para os
  -- agregados do dashboard, que sempre recortam por período.
  KEY idx_avaliacoes_cliente_data (cliente_id, data_avaliacao),
  KEY idx_avaliacoes_campanha (campanha_id),
  KEY idx_avaliacoes_avaliado_data (avaliado_id, data_avaliacao),
  KEY idx_avaliacoes_avaliador_data (avaliador_id, data_avaliacao),
  KEY idx_avaliacoes_status_feedback (status_feedback),
  KEY idx_avaliacoes_data (data_avaliacao),
  CONSTRAINT fk_avaliacoes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_avaliacoes_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacoes_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id),
  CONSTRAINT fk_avaliacoes_avaliado
    FOREIGN KEY (avaliado_id) REFERENCES users(id),
  CONSTRAINT fk_avaliacoes_avaliador
    FOREIGN KEY (avaliador_id) REFERENCES users(id),
  CONSTRAINT fk_avaliacoes_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE avaliacao_respostas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  criterio_id BIGINT UNSIGNED NOT NULL,
  resposta ENUM('sim','nao') NULL,
  status ENUM('conforme','nao_conforme','nao_aplicavel') NOT NULL,
  peso_aplicado DECIMAL(6,2) NULL,
  observacao_monitor TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avaliacao_respostas (avaliacao_id, criterio_id),
  KEY idx_avaliacao_respostas_criterio (criterio_id),
  CONSTRAINT fk_avaliacao_respostas_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_respostas_criterio
    FOREIGN KEY (criterio_id) REFERENCES formulario_criterios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feedbacks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  autor_id BIGINT UNSIGNED NULL,
  status ENUM('aberto','aplicado','dispensado') NOT NULL DEFAULT 'aberto',
  mensagem TEXT NULL,
  prazo DATE NULL,
  aplicado_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Um feedback por avaliação: o dashboard trata abertos e aplicados como
  -- partição do total de avaliações.
  UNIQUE KEY uq_feedbacks_avaliacao (avaliacao_id),
  KEY idx_feedbacks_status (status),
  CONSTRAINT fk_feedbacks_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedbacks_autor
    FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contestacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  criterio_id BIGINT UNSIGNED NULL,
  aberta_por_id BIGINT UNSIGNED NOT NULL,
  resolvida_por_id BIGINT UNSIGNED NULL,
  status ENUM('aberta','resolvida','rejeitada') NOT NULL DEFAULT 'aberta',
  motivo TEXT NOT NULL,
  resposta TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvida_em DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_contestacoes_avaliacao (avaliacao_id),
  KEY idx_contestacoes_status (status),
  CONSTRAINT fk_contestacoes_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_contestacoes_criterio
    FOREIGN KEY (criterio_id) REFERENCES formulario_criterios(id) ON DELETE SET NULL,
  CONSTRAINT fk_contestacoes_aberta_por
    FOREIGN KEY (aberta_por_id) REFERENCES users(id),
  CONSTRAINT fk_contestacoes_resolvida_por
    FOREIGN KEY (resolvida_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
