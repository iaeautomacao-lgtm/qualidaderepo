-- ---------------------------------------------------------------------------
-- 002 — Domínio real de monitoria de qualidade
--
-- A migration 001 modelou wallets/operators/checklists/reviews. O sistema de
-- referência (QualiTalk, prints em PRINTS/) trabalha com outra estrutura:
--
--   Cliente (operação) -> Campanha
--   Cliente -> Formulário -> Seção -> Critério
--   Avaliação = Formulário aplicado a um Avaliado, por um Monitor, numa Campanha
--   Avaliação -> Resposta por critério -> Feedback / Contestação
--
-- Esta migration cria o domínio novo ao lado do antigo. NÃO derruba as tabelas
-- de 001: quem já importou aquele schema decide quando remover. As tabelas
-- `users` e `user_sessions` de 001 continuam valendo — só o papel muda.
--
-- Regra de nota: um critério vale pontos OU é eliminatório. Eliminatório não
-- soma peso; quando reprova, zera a avaliação (as "Avaliações Zeradas" do
-- dashboard). Por isso `peso_pts` é NULL quando `eliminatoria = 1`, e existe
-- CHECK garantindo que os dois nunca convivam.
-- ---------------------------------------------------------------------------

-- Papéis do domínio real. ENUM antigo ('admin','quality_manager','reviewer',
-- 'viewer') não descreve Monitor nem Supervisor.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'administrador',
    'monitor',
    'supervisor',
    'operador',
    'viewer'
  ) NOT NULL DEFAULT 'viewer';

CREATE TABLE IF NOT EXISTS clientes (
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

CREATE TABLE IF NOT EXISTS campanhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NULL,
  nome VARCHAR(160) NOT NULL,
  canal ENUM('telefone','chat','email','whatsapp','offline','outro') NOT NULL DEFAULT 'outro',
  favorita TINYINT(1) NOT NULL DEFAULT 0,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- O sistema de origem tem campanhas homônimas em clientes diferentes
  -- ("Chat", "Telefone Ativo"), então a unicidade é por cliente, não global.
  UNIQUE KEY uq_campanhas_cliente_nome (cliente_id, nome),
  KEY idx_campanhas_cliente (cliente_id),
  CONSTRAINT fk_campanhas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formularios (
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
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Formulário pode valer para várias campanhas ("5 campanhas" no card de
-- formulário recente), e uma campanha pode ter mais de um formulário.
CREATE TABLE IF NOT EXISTS formulario_campanhas (
  formulario_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (formulario_id, campanha_id),
  KEY idx_formulario_campanhas_campanha (campanha_id),
  CONSTRAINT fk_formulario_campanhas_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_formulario_campanhas_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formulario_secoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  formulario_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT NULL,
  posicao INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formulario_secoes_posicao (formulario_id, posicao),
  CONSTRAINT fk_formulario_secoes_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formulario_criterios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  secao_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(200) NOT NULL,
  enunciado TEXT NOT NULL,
  peso_pts DECIMAL(6,2) NULL,
  eliminatoria TINYINT(1) NOT NULL DEFAULT 0,
  posicao INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formulario_criterios_posicao (secao_id, posicao),
  -- Ou pontua, ou elimina. Nunca os dois, nunca nenhum dos dois.
  CONSTRAINT ck_criterio_peso_ou_eliminatoria CHECK (
    (eliminatoria = 1 AND peso_pts IS NULL) OR
    (eliminatoria = 0 AND peso_pts IS NOT NULL)
  ),
  CONSTRAINT fk_formulario_criterios_secao
    FOREIGN KEY (secao_id) REFERENCES formulario_secoes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avaliacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Identificador que aparece na tela: QA-26-000541.
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
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_avaliacoes_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id),
  CONSTRAINT fk_avaliacoes_avaliado
    FOREIGN KEY (avaliado_id) REFERENCES users(id),
  CONSTRAINT fk_avaliacoes_avaliador
    FOREIGN KEY (avaliador_id) REFERENCES users(id),
  CONSTRAINT fk_avaliacoes_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avaliacao_respostas (
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
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_respostas_criterio
    FOREIGN KEY (criterio_id) REFERENCES formulario_criterios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedbacks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  autor_id BIGINT UNSIGNED NULL,
  status ENUM('aberto','aplicado','dispensado') NOT NULL DEFAULT 'aberto',
  mensagem TEXT NULL,
  prazo DATE NULL,
  aplicado_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Um feedback por avaliação: a tela conta "Feedbacks Abertos" e
  -- "Aplicados" como partição do total de avaliações.
  UNIQUE KEY uq_feedbacks_avaliacao (avaliacao_id),
  KEY idx_feedbacks_status (status),
  CONSTRAINT fk_feedbacks_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_feedbacks_autor
    FOREIGN KEY (autor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contestacoes (
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
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_contestacoes_criterio
    FOREIGN KEY (criterio_id) REFERENCES formulario_criterios(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_contestacoes_aberta_por
    FOREIGN KEY (aberta_por_id) REFERENCES users(id),
  CONSTRAINT fk_contestacoes_resolvida_por
    FOREIGN KEY (resolvida_por_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
