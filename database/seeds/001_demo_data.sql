INSERT INTO users (id, name, email, password_hash, role, active)
VALUES
  (1, 'Gisele Oliveira', 'admin@qualiddm.local', 'pbkdf2$210000$qualiddm-demo-seed-salt$kw1ZWRQ57gtd8Y91OAqTRyjzKLiIBuGVJ7LyPmvTRaA', 'admin', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), active = VALUES(active);

INSERT INTO wallets (id, name, description, active)
VALUES
  (1, 'Banco PAN', 'Carteira de referência para validação de negociação e atendimento.', 1),
  (2, 'Credz', 'Carteira com foco em acordos, cordialidade e registro correto.', 1),
  (3, 'Will Bank', 'Carteira digital com regras específicas de confirmação.', 1),
  (4, 'Cartão Benefício', 'Operação com atenção à elegibilidade e consentimento.', 1)
ON DUPLICATE KEY UPDATE description = VALUES(description), active = VALUES(active);

INSERT INTO operators (id, wallet_id, name, external_code, active)
VALUES
  (1, 1, 'Marina Costa', 'OP-001', 1),
  (2, 2, 'Diego Santos', 'OP-002', 1),
  (3, 3, 'Lívia Rocha', 'OP-003', 1),
  (4, 4, 'Rafael Lima', 'OP-004', 1)
ON DUPLICATE KEY UPDATE wallet_id = VALUES(wallet_id), name = VALUES(name), active = VALUES(active);

INSERT INTO checklist_templates (id, wallet_id, name, version, active)
VALUES
  (1, 1, 'Checklist Banco PAN', 1, 1),
  (2, 2, 'Checklist Credz', 1, 1),
  (3, 3, 'Checklist Will Bank', 1, 1),
  (4, 4, 'Checklist Cartão Benefício', 1, 1)
ON DUPLICATE KEY UPDATE active = VALUES(active);

INSERT INTO checklist_items (template_id, position, label, description, weight, required)
VALUES
  (1, 1, 'Saudação e identificação', 'Operador deve se identificar e informar origem do contato.', 1, 1),
  (1, 2, 'Confirmação de dados sensíveis', 'Confirmar dados conforme regra da carteira, sem exposição indevida.', 1, 1),
  (1, 3, 'Clareza na negociação', 'Explicar valores, prazo, baixa e próximo passo.', 1, 1),
  (1, 4, 'Registro correto no sistema', 'Informar ou executar registro rastreável no atendimento.', 1, 1),
  (1, 5, 'Encerramento com próximo passo', 'Encerrar com protocolo, prazo e confirmação de entendimento.', 1, 1)
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), weight = VALUES(weight), required = VALUES(required);

INSERT INTO business_rules (wallet_id, title, rule_text, severity, active)
VALUES
  (1, 'Protocolo no encerramento', 'Atendimentos Banco PAN devem terminar com protocolo, prazo e confirmação do próximo passo.', 'medium', 1),
  (1, 'Dados sensíveis', 'Evitar repetir CPF completo ou informações sensíveis sem necessidade operacional.', 'high', 1)
ON DUPLICATE KEY UPDATE rule_text = VALUES(rule_text), severity = VALUES(severity), active = VALUES(active);

INSERT INTO reviews
  (id, public_id, wallet_id, operator_id, reviewer_id, score, ai_confidence, duration_seconds, status, summary, feedback_summary, created_at)
VALUES
  (1, 'ql-1048', 1, 1, 1, 98, 0.9200, 222, 'approved',
   'Chamada com boa condução, explicação clara e pontos de encerramento para reforçar.',
   'Reforçar protocolo, prazo e rastreabilidade no encerramento.',
   DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)),
  (2, 'ql-1047', 2, 2, 1, 91, 0.8800, 310, 'approved',
   'Atendimento cordial e objetivo.',
   'Manter clareza na explicação do acordo.',
   DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 DAY)),
  (3, 'ql-1046', 3, 3, 1, 87, 0.8100, 265, 'needs_review',
   'Boa condução, mas houve incerteza em critério de validação.',
   'Revisar confirmação de dados.',
   DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 3 DAY)),
  (4, 'ql-1045', 4, 4, 1, 82, 0.7900, 241, 'needs_review',
   'Atendimento precisa de calibragem humana.',
   'Reforçar elegibilidade e consentimento.',
   DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 4 DAY))
ON DUPLICATE KEY UPDATE score = VALUES(score), ai_confidence = VALUES(ai_confidence), status = VALUES(status);
