-- ---------------------------------------------------------------------------
-- 003 — Telas de Feedback, Contestações, Transcrições,
--       Administração (Operação + Usuários) e Relatórios
--
-- Origem: os prints em PRINTS/TELAS/. A migration 002 modelou o núcleo
-- (cliente > campanha > formulário > avaliação > resposta). Essas telas pedem
-- dado que aquele núcleo não guarda:
--
--   FEEDBACK.png ........... feedback tem 5 estados (Pendente, Assinatura,
--                            Concluída, Justificada, Revisão), não 3. Precisa
--                            de assinatura do operado e de motivo quando é
--                            "Justificada".
--   GESTAO ADM.png ......... a coluna "Itens Contestados" conta CRITÉRIOS por
--                            avaliação. Hoje contestação é uma linha solta com
--                            um criterio_id opcional — não dá para contar nem
--                            julgar item por item.
--   TRANSCRIÇÕES.png ....... gravação como entidade própria (arquivo, duração,
--                            origem, status de transcrição, texto/JSON).
--   PAINEL ADMIN OPERAÇÃO... 10 funcionalidades de configuração, todas sem
--                            tabela: automações, faixas de performance,
--                            prazos de feedback, SLA de contestação, metas,
--                            categorias de formulário, justificativas, turnos,
--                            workflow, bug reports.
--   PAINEL ADMIN USUARIOS... "11 Cargos Cadastrados" e "Permissões no
--                            Catálogo" — o schema tem um ENUM de 5 papéis.
--   RELATORIOS.png ......... catálogo de relatórios, estrela de favorito POR
--                            USUÁRIO e histórico de exportação.
--
-- FORA DE ESCOPO — gestão de Monitores IA (personas): os prints
-- MONITOR DE IA.png foram cortados do projeto. Esta migration NÃO cria
-- `monitores_ia`, `monitor_ia_campanhas` nem fila de processamento de IA.
-- A AVALIAÇÃO por IA continua existindo: `avaliacoes.origem ENUM('humana','ia')`
-- segue valendo (vem da 002) e é o que sustenta o relatório
-- "Base de Monitoria IA". O que não existe é o cadastro de personas.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: esta migration espera um banco no nível da 002 (ou do
-- 01-estrutura.sql antigo, de 13 tabelas). Não rode em cima do
-- 01-estrutura.sql NOVO — aquele já nasce com tudo isto dentro.
--
-- Esta migration NÃO é idempotente nos ALTER TABLE. O MySQL 8 não aceita
-- `ADD COLUMN IF NOT EXISTS`. Rodar duas vezes acusa "Duplicate column name"
-- — o erro é esperado e inofensivo, mas rode uma vez só.
--
-- NADA AQUI APAGA DADO. Não há DROP TABLE nem DROP COLUMN na execução normal:
-- a única remoção do projeto (`contestacoes.criterio_id`, substituída por
-- `contestacao_itens`) está comentada no fim do arquivo, para ser decidida
-- depois. Consequência: um banco migrado fica com essa coluna legada a mais em
-- relação a um banco instalado do zero pelo 01-estrutura.sql. É esperado e não
-- afeta a aplicação, que não lê essa coluna.
--
-- Compatibilidade: sem CHECK, sem coluna JSON e sem índice funcional. O
-- servidor do cPanel já recusou sintaxe moderna durante a carga do seed
-- (ver comentários em database/cpanel/02-dados.sql), então tudo aqui usa
-- construções aceitas por MySQL 5.7 / MariaDB 10.x. As regras que um CHECK
-- protegeria (faixa com min <= max, item contestado pertencendo à avaliação)
-- são validadas na aplicação.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- ===========================================================================
-- 1. RBAC — cargos e permissões
--
-- Print PAINEL ADMIN USUARIOS: "11 Cargos Cadastrados", "71 Permissões no
-- Catálogo". `users.role` continua existindo como papel grosso (usado pelo
-- requireRole das rotas); `users.cargo_id` é o cargo fino que a tela lista.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cargos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- Papel grosso equivalente. Permite derivar users.role a partir do cargo
  -- sem duplicar a decisão de acesso em dois lugares.
  role_base ENUM('administrador','monitor','supervisor','operador','viewer')
    NOT NULL DEFAULT 'viewer',
  nivel TINYINT UNSIGNED NOT NULL DEFAULT 0,
  -- Cargo de sistema não pode ser apagado pela tela de administração.
  sistema TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargos_slug (slug),
  KEY idx_cargos_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Formato: modulo.recurso.acao — ex.: 'monitoria.avaliacao.criar'
  slug VARCHAR(120) NOT NULL,
  modulo VARCHAR(60) NOT NULL,
  recurso VARCHAR(60) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  sistema TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissoes_slug (slug),
  KEY idx_permissoes_modulo (modulo, recurso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargo_permissoes (
  cargo_id BIGINT UNSIGNED NOT NULL,
  permissao_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cargo_id, permissao_id),
  KEY idx_cargo_permissoes_permissao (permissao_id),
  CONSTRAINT fk_cargo_permissoes_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE,
  CONSTRAINT fk_cargo_permissoes_permissao
    FOREIGN KEY (permissao_id) REFERENCES permissoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 2. Turnos — print PAINEL ADMIN OPERAÇÃO, card "Turnos"
-- ===========================================================================

CREATE TABLE IF NOT EXISTS turnos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  -- SET em vez de VARCHAR com vírgulas: o banco passa a recusar dia inválido.
  dias_semana SET('dom','seg','ter','qua','qui','sex','sab')
    NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_turnos_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 3. Usuários — cargo, turno, hierarquia e presença
--
-- `supervisor_id` aqui é o organograma (quem é o superior da pessoa hoje).
-- `avaliacoes.supervisor_id` continua sendo o retrato do superior no momento
-- da monitoria — os dois são necessários: a coluna "Superior" do print de
-- Feedback tem de mostrar quem era o superior naquela avaliação, mesmo que a
-- pessoa tenha mudado de equipe depois.
-- ===========================================================================

ALTER TABLE users
  ADD COLUMN cargo_id BIGINT UNSIGNED NULL AFTER role,
  ADD COLUMN turno_id BIGINT UNSIGNED NULL AFTER cargo_id,
  ADD COLUMN cliente_id BIGINT UNSIGNED NULL AFTER turno_id,
  ADD COLUMN supervisor_id BIGINT UNSIGNED NULL AFTER cliente_id,
  ADD COLUMN ultimo_acesso_em DATETIME NULL AFTER active,
  ADD COLUMN senha_alterada_em DATETIME NULL AFTER ultimo_acesso_em,
  -- Todo mundo nasce com a mesma senha no seed; isso força a troca.
  ADD COLUMN trocar_senha TINYINT(1) NOT NULL DEFAULT 0 AFTER senha_alterada_em;

ALTER TABLE users
  ADD KEY idx_users_cargo (cargo_id),
  ADD KEY idx_users_cliente (cliente_id),
  ADD KEY idx_users_supervisor (supervisor_id),
  ADD KEY idx_users_active (active),
  ADD CONSTRAINT fk_users_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Print PAINEL ADMIN USUARIOS, card "Sessões e Presença": a tela precisa
-- mostrar de onde a sessão veio e quando a pessoa foi vista por último, e
-- precisa poder revogar sessão sem apagar a linha (a revogação é auditável).
ALTER TABLE user_sessions
  ADD COLUMN ip VARCHAR(45) NULL AFTER token_hash,
  ADD COLUMN user_agent VARCHAR(300) NULL AFTER ip,
  ADD COLUMN last_seen_at DATETIME NULL AFTER expires_at,
  ADD COLUMN revogada_em DATETIME NULL AFTER last_seen_at,
  ADD COLUMN revogada_por_id BIGINT UNSIGNED NULL AFTER revogada_em;

ALTER TABLE user_sessions
  ADD KEY idx_user_sessions_last_seen (last_seen_at),
  ADD CONSTRAINT fk_user_sessions_revogada_por
    FOREIGN KEY (revogada_por_id) REFERENCES users(id) ON DELETE SET NULL;

-- Print PAINEL ADMIN USUARIOS, card "Trilha de Auditoria — registro de
-- acessos e ações sensíveis (compliance)". O "Atividade Recente" do print
-- mostra e-mail + módulo + ação + entidade; faltava o módulo e faltava
-- registrar tentativa FALHA (é o que interessa em compliance).
ALTER TABLE audit_logs
  ADD COLUMN modulo VARCHAR(60) NULL AFTER acao,
  ADD COLUMN resultado ENUM('sucesso','falha') NOT NULL DEFAULT 'sucesso' AFTER entidade_id,
  ADD COLUMN severidade ENUM('info','aviso','critico') NOT NULL DEFAULT 'info' AFTER resultado,
  ADD COLUMN user_agent VARCHAR(300) NULL AFTER ip;

ALTER TABLE audit_logs
  ADD KEY idx_audit_logs_entidade (entidade, entidade_id),
  ADD KEY idx_audit_logs_data (created_at),
  ADD KEY idx_audit_logs_modulo (modulo, created_at);

-- Print PAINEL ADMIN USUARIOS, card "Usuários de DDM — Convidar usuários,
-- gerenciar status e redefinir senhas".
CREATE TABLE IF NOT EXISTS user_convites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(180) NOT NULL,
  nome VARCHAR(140) NULL,
  cargo_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  -- HASH do token, nunca o token — mesma regra de user_sessions.
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  convidado_por_id BIGINT UNSIGNED NULL,
  aceito_em DATETIME NULL,
  aceito_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_convites_token (token_hash),
  KEY idx_user_convites_email (email),
  KEY idx_user_convites_expira (expires_at),
  CONSTRAINT fk_user_convites_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_convites_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_convites_convidado_por
    FOREIGN KEY (convidado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_convites_aceito_user
    FOREIGN KEY (aceito_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  usado_em DATETIME NULL,
  solicitado_por_id BIGINT UNSIGNED NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_user (user_id),
  KEY idx_password_resets_expira (expires_at),
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_password_resets_solicitado_por
    FOREIGN KEY (solicitado_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 4. Categorias de formulário
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Categorias de Formulários — Gerenciar
-- categorias DINÂMICAS". Hoje é ENUM('padrao','diagnostico'): criar uma
-- categoria nova exigiria ALTER TABLE. O ENUM fica no lugar (código atual lê
-- `formularios.categoria`) e `categoria_id` passa a ser a fonte de verdade.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS formulario_categorias (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(400) NULL,
  cor_hex CHAR(7) NULL,
  posicao INT UNSIGNED NOT NULL DEFAULT 0,
  sistema TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formulario_categorias_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE formularios
  ADD COLUMN categoria_id BIGINT UNSIGNED NULL AFTER categoria;

ALTER TABLE formularios
  ADD KEY idx_formularios_categoria (categoria_id),
  ADD KEY idx_formularios_status (status),
  ADD CONSTRAINT fk_formularios_categoria
    FOREIGN KEY (categoria_id) REFERENCES formulario_categorias(id) ON DELETE SET NULL;

-- ===========================================================================
-- 5. Faixas de performance
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Conjuntos de Faixas de Performance —
-- Configurar faixas de desempenho E PRAZOS DE FEEDBACK". É daqui que sai o
-- `avaliacoes.prazo_feedback`: a nota cai numa faixa, a faixa diz quantos
-- dias o superior tem para aplicar o feedback.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS faixa_conjuntos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- Conjunto usado quando a campanha não aponta para nenhum.
  padrao TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_faixa_conjuntos_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faixas_performance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conjunto_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  -- Intervalo fechado em score_min, aberto em score_max, para não haver
  -- nota que caia em duas faixas. A aplicação valida min <= max.
  score_min DECIMAL(6,2) NOT NULL,
  score_max DECIMAL(6,2) NOT NULL,
  cor_hex CHAR(7) NULL,
  prazo_feedback_dias SMALLINT UNSIGNED NULL,
  quadrante ENUM('1Q','2Q','3Q','4Q','5Q') NULL,
  posicao INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_faixas_performance_posicao (conjunto_id, posicao),
  KEY idx_faixas_performance_faixa (conjunto_id, score_min, score_max),
  CONSTRAINT fk_faixas_performance_conjunto
    FOREIGN KEY (conjunto_id) REFERENCES faixa_conjuntos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE campanhas
  ADD COLUMN faixa_conjunto_id BIGINT UNSIGNED NULL AFTER canal;

ALTER TABLE campanhas
  ADD KEY idx_campanhas_faixa_conjunto (faixa_conjunto_id),
  ADD KEY idx_campanhas_ativa (ativa),
  ADD CONSTRAINT fk_campanhas_faixa_conjunto
    FOREIGN KEY (faixa_conjunto_id) REFERENCES faixa_conjuntos(id) ON DELETE SET NULL;

-- ===========================================================================
-- 6. Gravações e transcrições
--
-- Print TRANSCRIÇÕES: colunas Arquivo, Enviada em, Duração, Origem,
-- Transcrição, Ações — e "Exportar JSON (recorte atual)".
--
-- `hash_sha256` é o guarda de idempotência: reenviar o mesmo áudio não cria
-- gravação duplicada nem gasta transcrição de novo. UNIQUE aceita vários NULL,
-- então gravação de origem externa sem hash calculado continua entrando.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS gravacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_arquivo VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NULL,
  mime_type VARCHAR(120) NULL,
  tamanho_bytes BIGINT UNSIGNED NULL,
  duracao_segundos INT UNSIGNED NULL,
  hash_sha256 CHAR(64) NULL,
  origem ENUM('upload','integracao','discadora') NOT NULL DEFAULT 'upload',
  cliente_id BIGINT UNSIGNED NULL,
  campanha_id BIGINT UNSIGNED NULL,
  avaliado_id BIGINT UNSIGNED NULL,
  enviado_por_id BIGINT UNSIGNED NULL,
  -- Preenchido quando a gravação virou monitoria.
  avaliacao_id BIGINT UNSIGNED NULL,
  status_transcricao ENUM('nao_solicitada','pendente','processando','concluida','erro')
    NOT NULL DEFAULT 'nao_solicitada',
  -- Checkbox "Transcrever automaticamente" do print.
  transcrever_automatico TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gravacoes_hash (hash_sha256),
  KEY idx_gravacoes_status (status_transcricao),
  KEY idx_gravacoes_data (created_at),
  KEY idx_gravacoes_cliente_data (cliente_id, created_at),
  KEY idx_gravacoes_campanha (campanha_id),
  KEY idx_gravacoes_avaliacao (avaliacao_id),
  KEY idx_gravacoes_nome (nome_arquivo),
  CONSTRAINT fk_gravacoes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_gravacoes_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL,
  CONSTRAINT fk_gravacoes_avaliado
    FOREIGN KEY (avaliado_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gravacoes_enviado_por
    FOREIGN KEY (enviado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gravacoes_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sem UNIQUE em gravacao_id: retranscrever é normal (troca de modelo, áudio
-- com ruído) e o histórico das tentativas é o que explica um resultado ruim.
-- A transcrição corrente é a mais recente com status 'concluida'.
CREATE TABLE IF NOT EXISTS transcricoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gravacao_id BIGINT UNSIGNED NOT NULL,
  provedor VARCHAR(40) NOT NULL DEFAULT 'gemini',
  modelo VARCHAR(80) NULL,
  idioma VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  texto LONGTEXT NULL,
  -- Falas com timestamp e locutor, serializado. É o que a tela exporta em
  -- "Exportar JSON".
  segmentos_json LONGTEXT NULL,
  confianca DECIMAL(5,4) NULL,
  duracao_processamento_ms INT UNSIGNED NULL,
  status ENUM('pendente','processando','concluida','erro') NOT NULL DEFAULT 'pendente',
  erro_mensagem VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transcricoes_gravacao (gravacao_id, created_at),
  KEY idx_transcricoes_status (status),
  CONSTRAINT fk_transcricoes_gravacao
    FOREIGN KEY (gravacao_id) REFERENCES gravacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 7. Avaliações — vínculos novos e exclusão auditável
-- ===========================================================================

ALTER TABLE avaliacoes
  ADD COLUMN gravacao_id BIGINT UNSIGNED NULL AFTER audio_path,
  ADD COLUMN categoria_id BIGINT UNSIGNED NULL AFTER categoria,
  ADD COLUMN faixa_performance_id BIGINT UNSIGNED NULL AFTER quadrante,
  -- Relatório "Fichas Excluídas/Avulsas — auditoria de exclusões com autor,
  -- data, motivo e dados da avaliação" (print RELATORIOS). Com DELETE físico
  -- esse relatório é impossível: a linha que ele descreve já não existe.
  -- Toda listagem passa a filtrar `excluida_em IS NULL`.
  ADD COLUMN excluida_em DATETIME NULL AFTER updated_at,
  ADD COLUMN excluida_por_id BIGINT UNSIGNED NULL AFTER excluida_em,
  ADD COLUMN exclusao_motivo VARCHAR(400) NULL AFTER excluida_por_id,
  -- Ficha "avulsa": monitoria criada fora da amostra planejada.
  ADD COLUMN avulsa TINYINT(1) NOT NULL DEFAULT 0 AFTER exclusao_motivo;

ALTER TABLE avaliacoes
  ADD KEY idx_avaliacoes_gravacao (gravacao_id),
  ADD KEY idx_avaliacoes_categoria (categoria_id),
  ADD KEY idx_avaliacoes_excluida (excluida_em),
  ADD KEY idx_avaliacoes_supervisor_data (supervisor_id, data_avaliacao),
  -- Sustenta o relatório "Base de Monitoria IA": recorte por origem = 'ia'
  -- dentro de um período.
  ADD KEY idx_avaliacoes_origem (origem, data_avaliacao),
  ADD CONSTRAINT fk_avaliacoes_gravacao
    FOREIGN KEY (gravacao_id) REFERENCES gravacoes(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_avaliacoes_categoria
    FOREIGN KEY (categoria_id) REFERENCES formulario_categorias(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_avaliacoes_faixa
    FOREIGN KEY (faixa_performance_id) REFERENCES faixas_performance(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_avaliacoes_excluida_por
    FOREIGN KEY (excluida_por_id) REFERENCES users(id) ON DELETE SET NULL;

-- Print FEEDBACK: os cards são Pendente 142 + Assinatura 134 +
-- Finalizadas 218 + Revisão 0 = 494 = Todos. Ou seja: os estados particionam
-- o total, e "Finalizadas" é a soma de Concluídas (201) com Justificadas (17).
-- O ENUM atual ('pendente','aplicado','dispensado') não expressa isso.
--
-- Feito em três passos para não perder as linhas que já estão em 'aplicado'.
ALTER TABLE avaliacoes
  MODIFY COLUMN status_feedback
    ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado','aplicado')
    NOT NULL DEFAULT 'pendente';

UPDATE avaliacoes SET status_feedback = 'concluida' WHERE status_feedback = 'aplicado';

ALTER TABLE avaliacoes
  MODIFY COLUMN status_feedback
    ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado')
    NOT NULL DEFAULT 'pendente';

-- Relatório "Monitoria Editada — trilha de auditoria de edições realizadas em
-- avaliações" (print RELATORIOS). audit_logs guarda um texto livre em
-- `detalhe`; o relatório precisa de campo, valor anterior e valor novo.
CREATE TABLE IF NOT EXISTS avaliacao_edicoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  avaliacao_resposta_id BIGINT UNSIGNED NULL,
  editado_por_id BIGINT UNSIGNED NULL,
  campo VARCHAR(80) NOT NULL,
  valor_anterior TEXT NULL,
  valor_novo TEXT NULL,
  motivo VARCHAR(400) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_avaliacao_edicoes_avaliacao (avaliacao_id, created_at),
  KEY idx_avaliacao_edicoes_data (created_at),
  CONSTRAINT fk_avaliacao_edicoes_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_edicoes_resposta
    FOREIGN KEY (avaliacao_resposta_id) REFERENCES avaliacao_respostas(id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacao_edicoes_editado_por
    FOREIGN KEY (editado_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 8. Feedback — assinatura, justificativa e revisão
-- ===========================================================================

ALTER TABLE feedbacks
  MODIFY COLUMN status
    ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado','aberto','aplicado')
    NOT NULL DEFAULT 'pendente';

UPDATE feedbacks SET status = 'pendente'  WHERE status = 'aberto';
UPDATE feedbacks SET status = 'concluida' WHERE status = 'aplicado';

ALTER TABLE feedbacks
  MODIFY COLUMN status
    ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado')
    NOT NULL DEFAULT 'pendente';

ALTER TABLE feedbacks
  -- Quem de fato aplicou pode ser diferente de quem redigiu (`autor_id`).
  ADD COLUMN aplicado_por_id BIGINT UNSIGNED NULL AFTER autor_id,
  -- Estado "Assinatura": o operado precisa dar ciência. Sem isso o feedback
  -- não sai de 134 para Finalizada. IP guardado por exigência de compliance.
  ADD COLUMN assinado_por_id BIGINT UNSIGNED NULL AFTER aplicado_em,
  ADD COLUMN assinado_em DATETIME NULL AFTER assinado_por_id,
  ADD COLUMN assinatura_ip VARCHAR(45) NULL AFTER assinado_em,
  -- Estado "Justificada" (17 das 218 Finalizadas): fechou sem aplicar, com
  -- motivo de catálogo.
  ADD COLUMN justificativa_motivo_id BIGINT UNSIGNED NULL AFTER assinatura_ip,
  ADD COLUMN justificativa_texto TEXT NULL AFTER justificativa_motivo_id,
  -- Estado "Revisão": operado contestou o conteúdo do feedback.
  ADD COLUMN revisao_solicitada_por_id BIGINT UNSIGNED NULL AFTER justificativa_texto,
  ADD COLUMN revisao_solicitada_em DATETIME NULL AFTER revisao_solicitada_por_id,
  ADD COLUMN revisao_motivo TEXT NULL AFTER revisao_solicitada_em,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE feedbacks
  ADD KEY idx_feedbacks_prazo (prazo),
  ADD KEY idx_feedbacks_status_prazo (status, prazo),
  ADD CONSTRAINT fk_feedbacks_aplicado_por
    FOREIGN KEY (aplicado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_feedbacks_assinado_por
    FOREIGN KEY (assinado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_feedbacks_revisao_por
    FOREIGN KEY (revisao_solicitada_por_id) REFERENCES users(id) ON DELETE SET NULL;

-- Print PAINEL ADMIN OPERAÇÃO, card "Configurações de Feedbacks — Configurar
-- prazos em dias e COREs para status de feedbacks". Uma linha por status: a
-- cor do badge e o prazo saem do banco, não do CSS.
CREATE TABLE IF NOT EXISTS feedback_status_configuracoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  status ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado') NOT NULL,
  label VARCHAR(80) NOT NULL,
  prazo_dias SMALLINT UNSIGNED NULL,
  cor_hex CHAR(7) NULL,
  cor_texto_hex CHAR(7) NULL,
  posicao INT UNSIGNED NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feedback_status_config (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relatório "Pesquisa de Satisfação — respostas dos operadores sobre
-- feedbacks" (print RELATORIOS).
CREATE TABLE IF NOT EXISTS feedback_pesquisas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  feedback_id BIGINT UNSIGNED NOT NULL,
  respondido_por_id BIGINT UNSIGNED NULL,
  nota TINYINT UNSIGNED NULL,
  concorda TINYINT(1) NULL,
  comentario TEXT NULL,
  respondido_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Uma resposta por feedback.
  UNIQUE KEY uq_feedback_pesquisas_feedback (feedback_id),
  KEY idx_feedback_pesquisas_nota (nota),
  CONSTRAINT fk_feedback_pesquisas_feedback
    FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_pesquisas_respondido_por
    FOREIGN KEY (respondido_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 9. Contestações — cabeçalho + itens
--
-- Print GESTAO ADM: cards "Todas / Pendentes / Julgadas" e a coluna
-- "Itens Contestados" com 1, 2 ou 3 por avaliação.
--
-- Hoje `contestacoes` é uma linha por contestação com um `criterio_id`
-- opcional: não dá para o operador contestar 3 critérios num pedido só, nem
-- para o ADM deferir um e indeferir outro. `contestacao_itens` resolve os dois.
-- ===========================================================================

ALTER TABLE contestacoes
  MODIFY COLUMN status
    ENUM('pendente','em_analise','julgada','cancelada','aberta','resolvida','rejeitada')
    NOT NULL DEFAULT 'pendente';

UPDATE contestacoes SET status = 'pendente' WHERE status = 'aberta';
UPDATE contestacoes SET status = 'julgada'  WHERE status IN ('resolvida', 'rejeitada');

ALTER TABLE contestacoes
  MODIFY COLUMN status
    ENUM('pendente','em_analise','julgada','cancelada')
    NOT NULL DEFAULT 'pendente';

-- `resposta`/`resolvida_*` viram `parecer`/`julgada_*`: é o vocabulário da
-- tela ("Julgadas"). Nenhum código lê essas colunas hoje.
ALTER TABLE contestacoes
  CHANGE COLUMN resposta parecer TEXT NULL,
  CHANGE COLUMN resolvida_por_id julgada_por_id BIGINT UNSIGNED NULL,
  CHANGE COLUMN resolvida_em julgada_em DATETIME NULL;

ALTER TABLE contestacoes
  -- Deferida / parcial / indeferida é o consolidado dos itens.
  ADD COLUMN resultado ENUM('deferida','parcial','indeferida') NULL AFTER status,
  -- Vem do SLA da campanha no momento da abertura.
  ADD COLUMN prazo_julgamento DATE NULL AFTER resultado,
  ADD COLUMN score_anterior DECIMAL(6,2) NULL AFTER prazo_julgamento,
  ADD COLUMN score_final DECIMAL(6,2) NULL AFTER score_anterior,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE contestacoes
  ADD KEY idx_contestacoes_prazo (prazo_julgamento),
  ADD KEY idx_contestacoes_status_data (status, created_at),
  ADD KEY idx_contestacoes_aberta_por (aberta_por_id);

CREATE TABLE IF NOT EXISTS contestacao_itens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contestacao_id BIGINT UNSIGNED NOT NULL,
  -- Aponta para a RESPOSTA, não para o critério: é a resposta daquele
  -- critério naquela avaliação que está sendo contestada.
  avaliacao_resposta_id BIGINT UNSIGNED NOT NULL,
  argumento TEXT NOT NULL,
  status_original ENUM('conforme','nao_conforme','nao_aplicavel') NULL,
  status_final ENUM('conforme','nao_conforme','nao_aplicavel') NULL,
  resultado ENUM('deferido','indeferido') NULL,
  parecer TEXT NULL,
  julgada_por_id BIGINT UNSIGNED NULL,
  julgada_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- O mesmo critério não pode ser contestado duas vezes no mesmo pedido.
  UNIQUE KEY uq_contestacao_itens (contestacao_id, avaliacao_resposta_id),
  KEY idx_contestacao_itens_resposta (avaliacao_resposta_id),
  KEY idx_contestacao_itens_resultado (resultado),
  CONSTRAINT fk_contestacao_itens_contestacao
    FOREIGN KEY (contestacao_id) REFERENCES contestacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_contestacao_itens_resposta
    FOREIGN KEY (avaliacao_resposta_id) REFERENCES avaliacao_respostas(id) ON DELETE CASCADE,
  CONSTRAINT fk_contestacao_itens_julgada_por
    FOREIGN KEY (julgada_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migra o criterio_id solto do modelo antigo para um item, ANTES de remover a
-- coluna. Sem este INSERT, o DROP abaixo apaga a informação de qual critério
-- cada contestação questionava.
INSERT INTO contestacao_itens (contestacao_id, avaliacao_resposta_id, argumento, status_original)
SELECT c.id, r.id, c.motivo, r.status
  FROM contestacoes c, avaliacao_respostas r
 WHERE c.criterio_id IS NOT NULL
   AND r.avaliacao_id = c.avaliacao_id
   AND r.criterio_id = c.criterio_id;

-- `contestacoes.criterio_id` NÃO é removida aqui, de propósito.
--
-- A aplicação parou de usar essa coluna (quem responde "qual critério" agora é
-- `contestacao_itens`), mas apagá-la é irreversível — e este arquivo é feito
-- para ser colado inteiro no phpMyAdmin, então uma trava do tipo "confira e
-- decida" no meio dele não trava nada: o DROP rodaria na mesma execução.
--
-- Fica como coluna LEGADA: ocupa alguns bytes e não incomoda ninguém. O DROP
-- está no fim do arquivo, comentado, para ser rodado à parte depois que a
-- operação confirmar que a migração dos itens ficou correta.
--
-- Esta consulta diz se o INSERT acima deu conta de tudo. O INSERT só migra
-- contestação cujo critério TEM resposta na avaliação (o item aponta para a
-- resposta, não para o critério solto). Critério acrescentado à ficha depois da
-- avaliação não tem resposta para apontar e aparece aqui.
--
-- Zero linhas = migração completa, o DROP do fim do arquivo é seguro.
-- Qualquer linha = resolva esses casos com a operação ANTES de rodar o DROP.
SELECT 'contestacoes NAO migradas para contestacao_itens' AS alerta,
       c.id AS contestacao_id,
       c.avaliacao_id,
       c.criterio_id,
       c.status,
       LEFT(c.motivo, 80) AS motivo
  FROM contestacoes c
 WHERE c.criterio_id IS NOT NULL
   AND NOT EXISTS (
         SELECT 1
           FROM avaliacao_respostas r
          WHERE r.avaliacao_id = c.avaliacao_id
            AND r.criterio_id = c.criterio_id
       );

-- Print PAINEL ADMIN OPERAÇÃO, card "SLA de Contestações — configurar prazos
-- de resposta (SLA) para contestações POR CAMPANHA". Campanha sem linha aqui
-- usa o prazo padrão da aplicação.
CREATE TABLE IF NOT EXISTS sla_contestacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campanha_id BIGINT UNSIGNED NOT NULL,
  -- Dias que o operado tem para abrir contestação depois do feedback.
  prazo_abertura_dias SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  -- Dias que o ADM tem para julgar.
  prazo_julgamento_dias SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sla_contestacoes_campanha (campanha_id),
  CONSTRAINT fk_sla_contestacoes_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 10. Metas mensais de monitoria
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Metas Mensais de Monitoria".
--
-- Nota sobre o UNIQUE: `campanha_id` é NULL para meta de cliente inteiro, e o
-- MySQL aceita vários NULL num índice UNIQUE. Duas metas de cliente para o
-- mesmo mês, portanto, não são barradas pelo banco — a aplicação valida.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS metas_monitoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NULL,
  ano SMALLINT UNSIGNED NOT NULL,
  mes TINYINT UNSIGNED NOT NULL,
  meta_avaliacoes INT UNSIGNED NULL,
  meta_feedbacks INT UNSIGNED NULL,
  meta_score DECIMAL(6,2) NULL,
  responsavel_id BIGINT UNSIGNED NULL,
  observacao VARCHAR(400) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metas_monitoria (cliente_id, campanha_id, ano, mes),
  KEY idx_metas_monitoria_periodo (ano, mes),
  KEY idx_metas_monitoria_campanha (campanha_id),
  CONSTRAINT fk_metas_monitoria_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_metas_monitoria_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
  CONSTRAINT fk_metas_monitoria_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 11. Justificativas
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Justificativas — gerenciar motivos de
-- justificativa para ausência de monitoria e feedback". Alimenta também os
-- relatórios "Ausência de Monitoria" e "Fichas Excluídas".
--
-- Não confundir com `avaliacao_respostas.observacao_monitor`, que é a
-- justificativa do monitor num critério e continua onde está.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS justificativa_motivos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  escopo ENUM('ausencia_monitoria','ausencia_feedback','contestacao','exclusao_ficha') NOT NULL,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  exige_texto TINYINT(1) NOT NULL DEFAULT 0,
  posicao INT UNSIGNED NOT NULL DEFAULT 0,
  sistema TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_justificativa_motivos (escopo, slug),
  KEY idx_justificativa_motivos_escopo (escopo, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE feedbacks
  ADD CONSTRAINT fk_feedbacks_justificativa_motivo
    FOREIGN KEY (justificativa_motivo_id) REFERENCES justificativa_motivos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS justificativas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  escopo ENUM('ausencia_monitoria','ausencia_feedback','contestacao','exclusao_ficha') NOT NULL,
  motivo_id BIGINT UNSIGNED NULL,
  avaliacao_id BIGINT UNSIGNED NULL,
  avaliado_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  campanha_id BIGINT UNSIGNED NULL,
  -- Mês de referência (sempre dia 01). "Ausência de monitoria" é sobre um
  -- período, não sobre uma avaliação que não existe.
  competencia DATE NULL,
  texto TEXT NULL,
  criado_por_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_justificativas_escopo_data (escopo, created_at),
  KEY idx_justificativas_avaliado (avaliado_id, competencia),
  KEY idx_justificativas_avaliacao (avaliacao_id),
  KEY idx_justificativas_campanha (campanha_id, competencia),
  CONSTRAINT fk_justificativas_motivo
    FOREIGN KEY (motivo_id) REFERENCES justificativa_motivos(id) ON DELETE SET NULL,
  CONSTRAINT fk_justificativas_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_justificativas_avaliado
    FOREIGN KEY (avaliado_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_justificativas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_justificativas_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL,
  CONSTRAINT fk_justificativas_criado_por
    FOREIGN KEY (criado_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 12. Automações
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Automações — gerenciar REGRAS,
-- TEMPLATES, DESTINOS e EXECUÇÕES automáticas". As quatro palavras são as
-- quatro tabelas.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS automacao_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  canal ENUM('email','whatsapp','webhook','interno') NOT NULL DEFAULT 'email',
  assunto VARCHAR(200) NULL,
  corpo TEXT NOT NULL,
  -- Placeholders aceitos pelo corpo, serializado.
  variaveis_json LONGTEXT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automacao_templates_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- Ex.: 'avaliacao.criada', 'feedback.prazo_vencido',
  -- 'contestacao.aberta', 'ia.execucao_erro'.
  evento VARCHAR(80) NOT NULL,
  condicoes_json LONGTEXT NULL,
  template_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  campanha_id BIGINT UNSIGNED NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_por_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Índice do disparador: "quais automações ativas escutam este evento".
  KEY idx_automacoes_evento (evento, ativo),
  KEY idx_automacoes_cliente (cliente_id),
  CONSTRAINT fk_automacoes_template
    FOREIGN KEY (template_id) REFERENCES automacao_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_automacoes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_automacoes_campanha
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
  CONSTRAINT fk_automacoes_criado_por
    FOREIGN KEY (criado_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automacao_destinos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automacao_id BIGINT UNSIGNED NOT NULL,
  -- 'avaliado' e 'supervisor' são resolvidos em tempo de execução a partir da
  -- entidade do evento; os outros são endereços fixos.
  tipo ENUM('usuario','cargo','avaliado','supervisor','email','webhook') NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  cargo_id BIGINT UNSIGNED NULL,
  valor VARCHAR(400) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_automacao_destinos_automacao (automacao_id),
  CONSTRAINT fk_automacao_destinos_automacao
    FOREIGN KEY (automacao_id) REFERENCES automacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_automacao_destinos_usuario
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_automacao_destinos_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automacao_execucoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automacao_id BIGINT UNSIGNED NOT NULL,
  entidade VARCHAR(60) NULL,
  entidade_id VARCHAR(60) NULL,
  -- Ex.: 'automacao:3|feedback:912'. UNIQUE = o mesmo evento não dispara a
  -- mesma automação duas vezes, mesmo que o job rode de novo.
  idempotency_key VARCHAR(160) NULL,
  status ENUM('pendente','enviada','erro','descartada') NOT NULL DEFAULT 'pendente',
  tentativas TINYINT UNSIGNED NOT NULL DEFAULT 0,
  erro_mensagem VARCHAR(500) NULL,
  payload_json LONGTEXT NULL,
  agendada_para DATETIME NULL,
  executada_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automacao_execucoes_idempotency (idempotency_key),
  KEY idx_automacao_execucoes_fila (status, agendada_para),
  KEY idx_automacao_execucoes_automacao (automacao_id, created_at),
  CONSTRAINT fk_automacao_execucoes_automacao
    FOREIGN KEY (automacao_id) REFERENCES automacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 13. Workflow
--
-- Print PAINEL ADMIN OPERAÇÃO, card "Ver meu Workflow — visualizar o workflow
-- ATIVO em modo de visualização". Só leitura na tela; a definição vem daqui.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  versao INT UNSIGNED NOT NULL DEFAULT 1,
  -- Só um ativo por vez; a aplicação desativa o anterior ao ativar outro.
  ativo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workflows_slug_versao (slug, versao),
  KEY idx_workflows_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_etapas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workflow_id BIGINT UNSIGNED NOT NULL,
  chave VARCHAR(60) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  ordem INT UNSIGNED NOT NULL,
  cargo_id BIGINT UNSIGNED NULL,
  prazo_dias SMALLINT UNSIGNED NULL,
  obrigatoria TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workflow_etapas_ordem (workflow_id, ordem),
  UNIQUE KEY uq_workflow_etapas_chave (workflow_id, chave),
  CONSTRAINT fk_workflow_etapas_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  CONSTRAINT fk_workflow_etapas_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 14. Bug reports — print PAINEL ADMIN OPERAÇÃO, card "Bug Reports"
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bug_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NOT NULL,
  severidade ENUM('baixa','media','alta','critica') NOT NULL DEFAULT 'media',
  status ENUM('aberto','em_analise','resolvido','descartado') NOT NULL DEFAULT 'aberto',
  reportado_por_id BIGINT UNSIGNED NULL,
  -- Rota onde o bug apareceu, para reproduzir.
  rota VARCHAR(200) NULL,
  user_agent VARCHAR(300) NULL,
  anexo_path VARCHAR(500) NULL,
  resposta TEXT NULL,
  resolvido_por_id BIGINT UNSIGNED NULL,
  resolvido_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bug_reports_status (status, created_at),
  KEY idx_bug_reports_reportado_por (reportado_por_id),
  CONSTRAINT fk_bug_reports_reportado_por
    FOREIGN KEY (reportado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bug_reports_resolvido_por
    FOREIGN KEY (resolvido_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 15. Relatórios
--
-- Print RELATORIOS: lista de tipos com o chip "Sistema", a ESTRELA de
-- favorito e o painel de execução com filtros + exportação Excel/CSV.
--
-- A estrela é POR USUÁRIO (é a lista da Gisele que aparece marcada), por isso
-- `relatorio_favoritos` e não uma coluna `favorito` no tipo.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS relatorio_tipos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- 'sistema' = chip "Sistema" do print; 'ia' = saída em texto interpretado.
  grupo ENUM('sistema','ia','personalizado') NOT NULL DEFAULT 'sistema',
  -- Permissão exigida para executar. NULL = qualquer sessão autenticada.
  permissao_slug VARCHAR(120) NULL,
  posicao INT UNSIGNED NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_relatorio_tipos_slug (slug),
  KEY idx_relatorio_tipos_grupo (grupo, posicao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relatorio_favoritos (
  user_id BIGINT UNSIGNED NOT NULL,
  relatorio_tipo_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, relatorio_tipo_id),
  KEY idx_relatorio_favoritos_tipo (relatorio_tipo_id),
  CONSTRAINT fk_relatorio_favoritos_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_relatorio_favoritos_tipo
    FOREIGN KEY (relatorio_tipo_id) REFERENCES relatorio_tipos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de execução/exportação. Serve para compliance ("quem exportou a
-- base inteira e quando") e para explicar lentidão (`duracao_ms`, `linhas`).
CREATE TABLE IF NOT EXISTS relatorio_execucoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  relatorio_tipo_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  filtros_json LONGTEXT NULL,
  formato ENUM('tela','excel','csv') NOT NULL DEFAULT 'tela',
  status ENUM('executando','concluida','erro') NOT NULL DEFAULT 'executando',
  linhas INT UNSIGNED NULL,
  duracao_ms INT UNSIGNED NULL,
  erro_mensagem VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_relatorio_execucoes_tipo (relatorio_tipo_id, created_at),
  KEY idx_relatorio_execucoes_user (user_id, created_at),
  CONSTRAINT fk_relatorio_execucoes_tipo
    FOREIGN KEY (relatorio_tipo_id) REFERENCES relatorio_tipos(id) ON DELETE CASCADE,
  CONSTRAINT fk_relatorio_execucoes_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- Conferência
-- ===========================================================================

SELECT 'tabelas do QualiDDM' AS conferencia, COUNT(*) AS total
  FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_name IN (
     'users','user_sessions','audit_logs','clientes','campanhas','formularios',
     'formulario_campanhas','formulario_secoes','formulario_criterios',
     'avaliacoes','avaliacao_respostas','feedbacks','contestacoes',
     'cargos','permissoes','cargo_permissoes','user_convites','password_resets',
     'turnos','formulario_categorias','faixa_conjuntos','faixas_performance',
     'gravacoes','transcricoes','avaliacao_edicoes',
     'feedback_status_configuracoes','feedback_pesquisas','contestacao_itens',
     'sla_contestacoes','metas_monitoria','justificativa_motivos',
     'justificativas','automacao_templates','automacoes','automacao_destinos',
     'automacao_execucoes','workflows','workflow_etapas','bug_reports',
     'relatorio_tipos','relatorio_favoritos','relatorio_execucoes'
   );
-- Esperado: 42 (13 de 002 + 29 novas)

-- ---------------------------------------------------------------------------
-- Depois desta migration, rode os seeds dos catálogos novos: eles estão no
-- fim de database/cpanel/02-dados.sql, no bloco "CATÁLOGOS (migration 003)".
-- Sem eles, as telas de Relatórios, Feedback e Administração abrem vazias —
-- as tabelas existem mas não têm linha nenhuma.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- LIMPEZA OPCIONAL — rode DEPOIS, à parte, e só uma vez
--
-- Remove a coluna legada `contestacoes.criterio_id`, substituída por
-- `contestacao_itens`. É IRREVERSÍVEL, e por isso está comentada: não faz
-- parte da execução normal desta migration.
--
-- Antes de descomentar e rodar:
--   1. a consulta "contestacoes NAO migradas para contestacao_itens" (seção 9
--      deste arquivo) tem de devolver ZERO linhas;
--   2. confira que `contestacao_itens` tem uma linha para cada contestação que
--      antes tinha critério:
--        SELECT (SELECT COUNT(*) FROM contestacoes WHERE criterio_id IS NOT NULL) AS antes,
--               (SELECT COUNT(*) FROM contestacao_itens) AS depois;
--   3. tenha backup do banco.
--
-- ALTER TABLE contestacoes DROP FOREIGN KEY fk_contestacoes_criterio;
-- ALTER TABLE contestacoes DROP COLUMN criterio_id;
-- ---------------------------------------------------------------------------
