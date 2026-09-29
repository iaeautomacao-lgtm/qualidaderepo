-- Configuração dos perfis Acordito/IA por carteira.
-- Permite vincular cliente, formulário IA e prompt operacional do monitor.

CREATE TABLE IF NOT EXISTS monitor_ia_configuracoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NOT NULL,
  formulario_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(160) NOT NULL,
  prompt TEXT NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_por_id BIGINT UNSIGNED NULL,
  atualizado_por_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monitor_ia_cliente (cliente_id),
  KEY idx_monitor_ia_formulario (formulario_id),
  KEY idx_monitor_ia_ativo (ativo),
  CONSTRAINT fk_monitor_ia_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_monitor_ia_formulario FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_monitor_ia_criado_por FOREIGN KEY (criado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_monitor_ia_atualizado_por FOREIGN KEY (atualizado_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO monitor_ia_configuracoes (cliente_id, formulario_id, nome, prompt, ativo)
SELECT c.id,
       f.id,
       'Acordito Firjan',
       'Você é o Acordito configurado para a carteira FIRJAN. Avalie o atendimento com foco em fraseologia Firjan, confirmação de dados, clareza da orientação, cordialidade, encerramento e evidências objetivas na transcrição. Sempre devolva critérios com evidência, confiança e status conforme o formulário vinculado.',
       1
  FROM clientes c
  JOIN formularios f ON f.cliente_id = c.id
 WHERE UPPER(c.nome) = 'FIRJAN'
   AND UPPER(f.nome) LIKE 'IA FIRJAN%'
 ORDER BY f.nome
 LIMIT 1
ON DUPLICATE KEY UPDATE
  formulario_id = VALUES(formulario_id),
  nome = VALUES(nome),
  prompt = VALUES(prompt),
  ativo = VALUES(ativo);