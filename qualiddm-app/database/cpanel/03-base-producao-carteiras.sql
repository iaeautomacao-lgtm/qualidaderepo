-- ===========================================================================
-- QualiDDM - BASE DE PRODUCAO: CARTEIRAS E CAMPANHAS
--
-- Use este arquivo no phpMyAdmin, banco `grpia_qualiddm`, aba SQL.
--
-- Objetivo:
--   - Alimentar as carteiras reais usadas nos filtros e no Upload.
--   - Alimentar campanhas/operacoes base para Monitor IA.
--   - Nao inserir avaliacoes, formularios, criterios ou dados mockados.
--
-- Pode executar mais de uma vez: os INSERTs sao idempotentes.
-- ===========================================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Carteiras / Clientes reais
-- ---------------------------------------------------------------------------

INSERT INTO clientes (slug, nome, contrato, ativo)
VALUES
  ('anima', 'Anima', NULL, 1),
  ('cobranca-isaac', 'Cobranca- Isaac', NULL, 1),
  ('cruzeiro-do-sul', 'Cruzeiro do Sul', NULL, 1),
  ('educacional', 'Educacional', NULL, 1),
  ('empresarial-cobranca', 'Empresarial - Cobranca', NULL, 1),
  ('fiergs', 'FIERGS', '2026', 1),
  ('firjan', 'FIRJAN', '2026', 1),
  ('grupo-avenida', 'Grupo Avenida', NULL, 1),
  ('receptivo', 'Receptivo', NULL, 1),
  ('vero', 'Vero', NULL, 1),
  ('yduqs', 'Yduqs', NULL, 1)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  contrato = VALUES(contrato),
  ativo = 1,
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Campanhas globais. Como cliente_id fica NULL, aparecem para todas as carteiras
-- no Upload e nos filtros.
-- ---------------------------------------------------------------------------

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Ativo - Prospeccao', 'telefone', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Ativo - Prospeccao');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Telefone Ativo', 'telefone', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Telefone Ativo');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Telefone Receptivo', 'telefone', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Telefone Receptivo');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Monitorias IA - Telefone Ativo', 'telefone', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Monitorias IA - Telefone Ativo');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Monitorias IA - Telefone Receptivo', 'telefone', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Monitorias IA - Telefone Receptivo');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'Chat', 'chat', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'Chat');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'WhatsApp', 'whatsapp', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'WhatsApp');

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT NULL, 'E-mail', 'email', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE cliente_id IS NULL AND nome = 'E-mail');

-- ---------------------------------------------------------------------------
-- Campanhas especificas vistas nos prints/referencias do QualiTalk.
-- ---------------------------------------------------------------------------

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Isaac Ativo - Telefone', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'cobranca-isaac'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Isaac Ativo - Telefone'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Telefone ativo Empresarial', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'empresarial-cobranca'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Telefone ativo Empresarial'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Vero Churn', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'vero'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Vero Churn'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Vero Churn - Telefone', 'telefone', 0, 1
FROM clientes c
WHERE c.slug = 'vero'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Vero Churn - Telefone'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Vero Pre Churn - Telefone', 'telefone', 0, 1
FROM clientes c
WHERE c.slug = 'vero'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Vero Pre Churn - Telefone'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Vero Ativo', 'telefone', 0, 1
FROM clientes c
WHERE c.slug = 'vero'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Vero Ativo'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'TELEFONE ATIVO - Monitorias IA', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'firjan'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'TELEFONE ATIVO - Monitorias IA'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Telefone Receptivo - Monitorias IA', 'telefone', 0, 1
FROM clientes c
WHERE c.slug = 'firjan'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Telefone Receptivo - Monitorias IA'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Ativo - Prospeccao', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'fiergs'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Ativo - Prospeccao'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Telefone Grupo Avenida', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'grupo-avenida'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Telefone Grupo Avenida'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Telefone Ativo', 'telefone', 1, 1
FROM clientes c
WHERE c.slug IN ('anima', 'cruzeiro-do-sul', 'educacional', 'yduqs')
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Telefone Ativo'
  );

INSERT INTO campanhas (cliente_id, nome, canal, favorita, ativa)
SELECT c.id, 'Telefone Receptivo', 'telefone', 1, 1
FROM clientes c
WHERE c.slug = 'receptivo'
  AND NOT EXISTS (
    SELECT 1 FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.nome = 'Telefone Receptivo'
  );

-- ---------------------------------------------------------------------------
-- Opcional: marca como erro a fila antiga que ficou sem texto/segmentos, para
-- ficar visivel que precisa reenviar. Nao apaga arquivo nem historico.
-- ---------------------------------------------------------------------------

UPDATE transcricoes t
JOIN gravacoes g ON g.id = t.gravacao_id
   SET t.status = 'erro',
       t.erro_mensagem = 'Registro antigo sem analise estruturada. Reenvie o arquivo apos atualizar o sistema.'
 WHERE g.nome_arquivo = 'chat-isaac-acordorealizado.pdf'
   AND t.status = 'pendente'
   AND t.texto IS NULL
   AND t.segmentos_json IS NULL;

UPDATE gravacoes g
LEFT JOIN transcricoes t ON t.gravacao_id = g.id
   SET g.status_transcricao = 'erro'
 WHERE g.nome_arquivo = 'chat-isaac-acordorealizado.pdf'
   AND t.status = 'erro'
   AND t.erro_mensagem = 'Registro antigo sem analise estruturada. Reenvie o arquivo apos atualizar o sistema.';

COMMIT;

-- Conferencia esperada apos importar:
SELECT 'clientes' AS tabela, COUNT(*) AS total FROM clientes
UNION ALL
SELECT 'campanhas', COUNT(*) FROM campanhas
UNION ALL
SELECT 'formularios', COUNT(*) FROM formularios
UNION ALL
SELECT 'avaliacoes', COUNT(*) FROM avaliacoes
UNION ALL
SELECT 'gravacoes', COUNT(*) FROM gravacoes
UNION ALL
SELECT 'transcricoes', COUNT(*) FROM transcricoes;
