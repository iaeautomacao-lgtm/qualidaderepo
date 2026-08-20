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
-- Se o banco JÁ está instalado e você só quer as tabelas novas das telas de
-- Feedback / Contestações / Transcrições / Administração / Relatórios,
-- NÃO use este arquivo: rode
-- `database/migrations/003_telas_operacao_ia_admin.sql`, que faz a mudança
-- sem apagar nada. Para as evidências da IA na ficha, os anexos por critério e
-- o tipo de feedback, rode em seguida
-- `database/migrations/004_ficha_ia_evidencias_e_anexos.sql`.
--
-- Requer MySQL 8.0.16+ ou MariaDB 10.2+ (por causa da restrição CHECK na
-- tabela formulario_criterios). Se o servidor for mais antigo e acusar erro
-- nessa linha, remova apenas o bloco CONSTRAINT ck_criterio_peso_ou_eliminatoria
-- — a regra passa a valer só na aplicação.
--
-- ORDEM DAS TABELAS: as tabelas aparecem em ordem de dependência, não em
-- ordem alfabética nem por assunto. `clientes` e `cargos` vêm antes de
-- `users` porque `users` aponta para as duas. O único ciclo do schema
-- (avaliacoes <-> gravacoes) é resolvido por um ALTER TABLE no fim do
-- bloco de avaliações. Não reordene os CREATE TABLE.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS relatorio_execucoes;
DROP TABLE IF EXISTS relatorio_favoritos;
DROP TABLE IF EXISTS relatorio_tipos;
DROP TABLE IF EXISTS bug_reports;
DROP TABLE IF EXISTS workflow_etapas;
DROP TABLE IF EXISTS workflows;
DROP TABLE IF EXISTS automacao_execucoes;
DROP TABLE IF EXISTS automacao_destinos;
DROP TABLE IF EXISTS automacoes;
DROP TABLE IF EXISTS automacao_templates;
DROP TABLE IF EXISTS justificativas;
DROP TABLE IF EXISTS metas_monitoria;
DROP TABLE IF EXISTS sla_contestacoes;
DROP TABLE IF EXISTS contestacao_itens;
DROP TABLE IF EXISTS contestacoes;
DROP TABLE IF EXISTS feedback_pesquisas;
DROP TABLE IF EXISTS feedback_status_configuracoes;
DROP TABLE IF EXISTS feedbacks;
DROP TABLE IF EXISTS avaliacao_edicoes;
DROP TABLE IF EXISTS transcricoes;
DROP TABLE IF EXISTS gravacoes;
DROP TABLE IF EXISTS avaliacao_resposta_anexos;
DROP TABLE IF EXISTS avaliacao_respostas;
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS justificativa_motivos;
DROP TABLE IF EXISTS formulario_criterios;
DROP TABLE IF EXISTS formulario_secoes;
DROP TABLE IF EXISTS formulario_campanhas;
DROP TABLE IF EXISTS formularios;
DROP TABLE IF EXISTS formulario_categorias;
DROP TABLE IF EXISTS campanhas;
DROP TABLE IF EXISTS faixas_performance;
DROP TABLE IF EXISTS faixa_conjuntos;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS user_convites;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS turnos;
DROP TABLE IF EXISTS cargo_permissoes;
DROP TABLE IF EXISTS permissoes;
DROP TABLE IF EXISTS cargos;
DROP TABLE IF EXISTS clientes;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Clientes (operações)
--
-- Primeiro de todos porque `users`, `campanhas`, `formularios` e mais meia
-- dúzia de tabelas apontam para cá.
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

-- ---------------------------------------------------------------------------
-- RBAC — cargos e catálogo de permissões
--
-- A tela Administração > Usuários mostra "11 Cargos Cadastrados" e
-- "71 Permissões no Catálogo". `users.role` é o papel grosso que as rotas
-- checam; `users.cargo_id` é o cargo fino que a operação administra.
-- ---------------------------------------------------------------------------

CREATE TABLE cargos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- Papel grosso equivalente, para derivar users.role a partir do cargo sem
  -- duplicar a decisão de acesso em dois lugares.
  role_base ENUM('administrador','monitor','supervisor','operador','viewer')
    NOT NULL DEFAULT 'viewer',
  nivel TINYINT UNSIGNED NOT NULL DEFAULT 0,
  -- Cargo de sistema não pode ser apagado pela tela.
  sistema TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargos_slug (slug),
  KEY idx_cargos_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissoes (
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

CREATE TABLE cargo_permissoes (
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

-- ---------------------------------------------------------------------------
-- Turnos de trabalho (Administração > Operação > Turnos)
-- ---------------------------------------------------------------------------

CREATE TABLE turnos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  -- SET em vez de VARCHAR com vírgulas: o banco recusa dia inválido.
  dias_semana SET('dom','seg','ter','qua','qui','sex','sab')
    NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_turnos_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Pessoas e acesso
-- ---------------------------------------------------------------------------

-- Uma tabela só para todo mundo: administrador, monitor, supervisor e operador
-- avaliado. Separar em tabelas diferentes obrigaria a duplicar login, e o
-- mesmo profissional às vezes acumula papéis.
--
-- `supervisor_id` é o organograma de HOJE. O superior que aparece na tela de
-- Feedback vem de `avaliacoes.supervisor_id`, que é o retrato do superior no
-- momento da monitoria — a pessoa pode ter trocado de equipe depois.
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL,
  -- Formato: pbkdf2$iteracoes$salt$hash. Nunca guarde senha em texto puro.
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrador','monitor','supervisor','operador','viewer')
    NOT NULL DEFAULT 'viewer',
  cargo_id BIGINT UNSIGNED NULL,
  turno_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  supervisor_id BIGINT UNSIGNED NULL,
  login VARCHAR(120) NULL,
  cpf VARCHAR(20) NULL,
  matricula VARCHAR(80) NULL,
  external_code VARCHAR(80) NULL,
  data_inicio_produto DATE NULL,
  hierarquia_vigencia DATE NULL,
  hierarquia_motivo VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acesso_em DATETIME NULL,
  senha_alterada_em DATETIME NULL,
  -- O seed cria todo mundo com a mesma senha; isso força a troca.
  trocar_senha TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_cargo (cargo_id),
  KEY idx_users_cliente (cliente_id),
  KEY idx_users_supervisor (supervisor_id),
  KEY idx_users_turno (turno_id),
  KEY idx_users_login (login),
  KEY idx_users_cpf (cpf),
  KEY idx_users_matricula (matricula),
  KEY idx_users_active (active),
  CONSTRAINT fk_users_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_campanhas (
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

-- Guarda o HASH do token, nunca o token. Se esta tabela vazar, ninguém
-- consegue se passar por usuário com o conteúdo dela.
--
-- `ip`, `user_agent` e `last_seen_at` existem para a tela "Sessões e
-- Presença". A revogação é uma coluna e não um DELETE porque desligar a
-- sessão de alguém é ação sensível e precisa ficar registrada.
CREATE TABLE user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(300) NULL,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  revogada_em DATETIME NULL,
  revogada_por_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY idx_user_sessions_user_id (user_id),
  KEY idx_user_sessions_expires_at (expires_at),
  KEY idx_user_sessions_last_seen (last_seen_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_sessions_revogada_por
    FOREIGN KEY (revogada_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Administração > Usuários > "Convidar usuários".
CREATE TABLE user_convites (
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

-- Administração > Usuários > "redefinir senhas".
CREATE TABLE password_resets (
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

-- Trilha de auditoria (Administração > Usuários > "Trilha de Auditoria").
-- `resultado` registra também a tentativa que FALHOU — em compliance é
-- justamente a falha que interessa.
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  acao VARCHAR(80) NOT NULL,
  modulo VARCHAR(60) NULL,
  entidade VARCHAR(80) NULL,
  entidade_id VARCHAR(40) NULL,
  resultado ENUM('sucesso','falha') NOT NULL DEFAULT 'sucesso',
  severidade ENUM('info','aviso','critico') NOT NULL DEFAULT 'info',
  detalhe TEXT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_acao_data (acao, created_at),
  KEY idx_audit_logs_entidade (entidade, entidade_id),
  KEY idx_audit_logs_data (created_at),
  KEY idx_audit_logs_modulo (modulo, created_at),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Faixas de performance
--
-- Administração > Operação > "Conjuntos de Faixas de Performance —
-- configurar faixas de desempenho E PRAZOS DE FEEDBACK". É daqui que sai o
-- `avaliacoes.prazo_feedback`: a nota cai numa faixa e a faixa diz quantos
-- dias o superior tem para aplicar o feedback.
-- ---------------------------------------------------------------------------

CREATE TABLE faixa_conjuntos (
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

CREATE TABLE faixas_performance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conjunto_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
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

-- ---------------------------------------------------------------------------
-- Campanhas
-- ---------------------------------------------------------------------------

CREATE TABLE campanhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NULL,
  nome VARCHAR(160) NOT NULL,
  canal ENUM('telefone','chat','email','whatsapp','offline','outro')
    NOT NULL DEFAULT 'outro',
  faixa_conjunto_id BIGINT UNSIGNED NULL,
  favorita TINYINT(1) NOT NULL DEFAULT 0,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Unicidade por cliente, não global: o sistema de origem tem duas campanhas
  -- chamadas "Chat", em clientes diferentes.
  UNIQUE KEY uq_campanhas_cliente_nome (cliente_id, nome),
  KEY idx_campanhas_cliente (cliente_id),
  KEY idx_campanhas_faixa_conjunto (faixa_conjunto_id),
  KEY idx_campanhas_ativa (ativa),
  CONSTRAINT fk_campanhas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_campanhas_faixa_conjunto
    FOREIGN KEY (faixa_conjunto_id) REFERENCES faixa_conjuntos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Formulários (fichas de avaliação)
-- ---------------------------------------------------------------------------

-- Administração > Operação > "Categorias de Formulários — gerenciar
-- categorias DINÂMICAS". O ENUM `formularios.categoria` continua existindo
-- (código antigo lê ele), mas `categoria_id` é a fonte de verdade: criar
-- categoria nova é INSERT aqui, não ALTER TABLE.
CREATE TABLE formulario_categorias (
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

CREATE TABLE formularios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(180) NOT NULL,
  categoria ENUM('padrao','diagnostico') NOT NULL DEFAULT 'padrao',
  categoria_id BIGINT UNSIGNED NULL,
  status ENUM('ativo','rascunho','desenvolvimento','inativo') NOT NULL DEFAULT 'rascunho',
  versao INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formularios_versao (cliente_id, nome, versao),
  KEY idx_formularios_cliente (cliente_id),
  KEY idx_formularios_categoria (categoria_id),
  KEY idx_formularios_status (status),
  CONSTRAINT fk_formularios_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_formularios_categoria
    FOREIGN KEY (categoria_id) REFERENCES formulario_categorias(id) ON DELETE SET NULL
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
-- Catálogo de motivos de justificativa
--
-- Administração > Operação > "Justificativas — gerenciar motivos de
-- justificativa para ausência de monitoria e feedback". Vem antes de
-- `feedbacks`, que aponta para cá quando o feedback é fechado como
-- "Justificada".
--
-- Não confundir com `avaliacao_respostas.observacao_monitor`, que é a
-- justificativa do monitor num critério.
-- ---------------------------------------------------------------------------

CREATE TABLE justificativa_motivos (
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

-- ---------------------------------------------------------------------------
-- Avaliações
--
-- `excluida_em` existe porque o relatório "Fichas Excluídas/Avulsas" precisa
-- auditar exclusões com autor, data e motivo — com DELETE físico esse
-- relatório é impossível. TODA listagem tem de filtrar `excluida_em IS NULL`.
--
-- `status_feedback` tem 6 valores porque a tela de Feedback tem 5 cards que
-- particionam o total (Pendente + Assinatura + Finalizadas + Revisão = Todos),
-- e "Finalizadas" é Concluída + Justificada.
-- ---------------------------------------------------------------------------

CREATE TABLE avaliacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Código que aparece na tela: QA-26-000541
  codigo VARCHAR(20) NOT NULL,
  cod_gravacao VARCHAR(60) NULL,
  -- CPF do CLIENTE atendido ("Cabeçalho da Ficha → CPF"), não do operador
  -- avaliado: o sistema não cadastra o cliente final.
  cpf_cliente VARCHAR(20) NULL,
  cliente_id BIGINT UNSIGNED NOT NULL,
  campanha_id BIGINT UNSIGNED NULL,
  formulario_id BIGINT UNSIGNED NOT NULL,
  avaliado_id BIGINT UNSIGNED NOT NULL,
  avaliador_id BIGINT UNSIGNED NOT NULL,
  supervisor_id BIGINT UNSIGNED NULL,
  categoria ENUM('padrao','diagnostico') NOT NULL DEFAULT 'padrao',
  categoria_id BIGINT UNSIGNED NULL,
  -- 'ia' = ficha gerada pela avaliação automática (rotas /api/avaliar e
  -- /api/analyze). É o recorte do relatório "Base de Monitoria IA".
  -- `avaliador_id` continua apontando para o usuário responsável.
  origem ENUM('humana','ia') NOT NULL DEFAULT 'humana',
  -- Cabeçalho da ficha gerada por IA. `ia_modelo` é guardado porque a mesma
  -- ficha reavaliada com outro modelo dá outra nota, e a auditoria precisa
  -- saber qual respondeu. `ia_analise_json` guarda o que não tem coluna própria
  -- e a tela lê em bloco (insights, riscos, próximos passos, transcrição com
  -- falantes, instante da geração) — texto serializado, não JSON nativo, pelo
  -- mesmo motivo de `transcricoes.segmentos_json`.
  ia_persona VARCHAR(160) NULL,
  ia_modelo VARCHAR(120) NULL,
  ia_confianca DECIMAL(5,4) NULL,
  ia_resumo TEXT NULL,
  ia_observacoes TEXT NULL,
  ia_analise_json LONGTEXT NULL,
  score DECIMAL(6,2) NULL,
  zerada TINYINT(1) NOT NULL DEFAULT 0,
  quadrante ENUM('1Q','2Q','3Q','4Q','5Q') NULL,
  faixa_performance_id BIGINT UNSIGNED NULL,
  duracao_segundos INT UNSIGNED NULL,
  audio_path VARCHAR(500) NULL,
  -- FK adicionada no ALTER TABLE logo depois de `gravacoes`: as duas tabelas
  -- se referenciam e o MySQL não aceita o ciclo num CREATE só.
  gravacao_id BIGINT UNSIGNED NULL,
  data_contato DATETIME NULL,
  data_avaliacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prazo_feedback DATE NULL,
  prazo_contestacao DATE NULL,
  status_feedback ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado')
    NOT NULL DEFAULT 'pendente',
  total_conformes INT UNSIGNED NOT NULL DEFAULT 0,
  total_nao_conformes INT UNSIGNED NOT NULL DEFAULT 0,
  total_nao_aplicaveis INT UNSIGNED NOT NULL DEFAULT 0,
  total_criterios INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  excluida_em DATETIME NULL,
  excluida_por_id BIGINT UNSIGNED NULL,
  exclusao_motivo VARCHAR(400) NULL,
  -- Ficha "avulsa": monitoria criada fora da amostra planejada.
  avulsa TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avaliacoes_codigo (codigo),
  -- Índices desenhados para os filtros das telas de Avaliações, Feedback,
  -- Contestações e Relatórios, que sempre recortam por período e por
  -- cliente/campanha/avaliador.
  KEY idx_avaliacoes_cliente_data (cliente_id, data_avaliacao),
  KEY idx_avaliacoes_campanha (campanha_id),
  KEY idx_avaliacoes_avaliado_data (avaliado_id, data_avaliacao),
  KEY idx_avaliacoes_avaliador_data (avaliador_id, data_avaliacao),
  KEY idx_avaliacoes_supervisor_data (supervisor_id, data_avaliacao),
  KEY idx_avaliacoes_status_feedback (status_feedback),
  KEY idx_avaliacoes_data (data_avaliacao),
  KEY idx_avaliacoes_gravacao (gravacao_id),
  KEY idx_avaliacoes_categoria (categoria_id),
  KEY idx_avaliacoes_excluida (excluida_em),
  KEY idx_avaliacoes_origem (origem, data_avaliacao),
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
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacoes_categoria
    FOREIGN KEY (categoria_id) REFERENCES formulario_categorias(id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacoes_faixa
    FOREIGN KEY (faixa_performance_id) REFERENCES faixas_performance(id) ON DELETE SET NULL,
  CONSTRAINT fk_avaliacoes_excluida_por
    FOREIGN KEY (excluida_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE avaliacao_respostas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  criterio_id BIGINT UNSIGNED NOT NULL,
  -- Rótulo EXIBIDO da resposta, não a regra: além de 'sim'/'nao' a operação usa
  -- 'diagnostico' (não penaliza) e rótulos de opção próprios por carteira. Quem
  -- decide conforme / não conforme / não aplicável é `status`, abaixo. A lista
  -- de valores aceitos fica na aplicação (`RESPOSTAS_CONHECIDAS`, em
  -- src/server/repositories/avaliacoes.js).
  resposta VARCHAR(40) NULL,
  status ENUM('conforme','nao_conforme','nao_aplicavel') NOT NULL,
  peso_aplicado DECIMAL(6,2) NULL,
  observacao_monitor TEXT NULL,
  -- `ia_evidencia` é o trecho citado do atendimento: é o que transforma
  -- "não conforme" em algo que uma pessoa consegue contestar. `ia_raciocinio` é
  -- a explicação do modelo, espelhada em `observacao_monitor` enquanto ninguém
  -- editou a observação — o relatório de Justificativas lê aquela coluna.
  ia_evidencia TEXT NULL,
  ia_confianca DECIMAL(5,4) NULL,
  ia_raciocinio TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avaliacao_respostas (avaliacao_id, criterio_id),
  KEY idx_avaliacao_respostas_criterio (criterio_id),
  CONSTRAINT fk_avaliacao_respostas_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_respostas_criterio
    FOREIGN KEY (criterio_id) REFERENCES formulario_criterios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Anexos de apoio de um critério (print, e-mail, áudio). O arquivo em si fica
-- na raiz de UPLOAD_STORAGE_DIR; a tabela guarda só o ponteiro, e o download
-- confere se o caminho resolvido continua dentro daquela raiz.
CREATE TABLE avaliacao_resposta_anexos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resposta_id BIGINT UNSIGNED NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NULL,
  tamanho_bytes BIGINT UNSIGNED NULL,
  enviado_por_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_anexos_resposta (resposta_id),
  CONSTRAINT fk_anexos_resposta FOREIGN KEY (resposta_id)
    REFERENCES avaliacao_respostas(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexos_usuario FOREIGN KEY (enviado_por_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Gravações e transcrições (tela Transcrições)
--
-- `hash_sha256` é o guarda de idempotência: reenviar o mesmo áudio não cria
-- gravação duplicada nem gasta transcrição de novo. UNIQUE aceita vários NULL,
-- então gravação de origem externa sem hash continua entrando.
-- ---------------------------------------------------------------------------

CREATE TABLE gravacoes (
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
  -- Checkbox "Transcrever automaticamente" da tela.
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

-- Fecha o ciclo avaliacoes <-> gravacoes.
ALTER TABLE avaliacoes
  ADD CONSTRAINT fk_avaliacoes_gravacao
    FOREIGN KEY (gravacao_id) REFERENCES gravacoes(id) ON DELETE SET NULL;

-- Sem UNIQUE em gravacao_id: retranscrever é normal (troca de modelo, áudio
-- com ruído) e o histórico das tentativas é o que explica um resultado ruim.
-- A transcrição corrente é a mais recente com status 'concluida'.
CREATE TABLE transcricoes (
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

-- Relatório "Monitoria Editada — trilha de auditoria de edições realizadas em
-- avaliações". `audit_logs` guarda texto livre em `detalhe`; o relatório
-- precisa de campo, valor anterior e valor novo separados.
CREATE TABLE avaliacao_edicoes (
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

-- ---------------------------------------------------------------------------
-- Feedback
--
-- O ciclo é: Pendente -> (o superior aplica) -> Assinatura -> (o operado dá
-- ciência) -> Concluída. Fora do trilho: Justificada (fechou sem aplicar, com
-- motivo de catálogo) e Revisão (o operado discordou do conteúdo).
-- ---------------------------------------------------------------------------

CREATE TABLE feedbacks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  autor_id BIGINT UNSIGNED NULL,
  -- Quem de fato aplicou pode ser diferente de quem redigiu.
  aplicado_por_id BIGINT UNSIGNED NULL,
  status ENUM('pendente','assinatura','concluida','justificada','revisao','dispensado')
    NOT NULL DEFAULT 'pendente',
  -- Tom do feedback registrado na ficha. Coluna própria para não contaminar o
  -- texto que o operado assina.
  tipo ENUM('elogio','orientacao','alerta') NULL,
  mensagem TEXT NULL,
  prazo DATE NULL,
  aplicado_em DATETIME NULL,
  -- Ciência do operado. IP guardado por exigência de compliance.
  assinado_por_id BIGINT UNSIGNED NULL,
  assinado_em DATETIME NULL,
  assinatura_ip VARCHAR(45) NULL,
  justificativa_motivo_id BIGINT UNSIGNED NULL,
  justificativa_texto TEXT NULL,
  revisao_solicitada_por_id BIGINT UNSIGNED NULL,
  revisao_solicitada_em DATETIME NULL,
  revisao_motivo TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Um feedback por avaliação: o dashboard trata os estados como partição do
  -- total de avaliações.
  UNIQUE KEY uq_feedbacks_avaliacao (avaliacao_id),
  KEY idx_feedbacks_status (status),
  KEY idx_feedbacks_prazo (prazo),
  KEY idx_feedbacks_status_prazo (status, prazo),
  CONSTRAINT fk_feedbacks_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedbacks_autor
    FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedbacks_aplicado_por
    FOREIGN KEY (aplicado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedbacks_assinado_por
    FOREIGN KEY (assinado_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedbacks_revisao_por
    FOREIGN KEY (revisao_solicitada_por_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedbacks_justificativa_motivo
    FOREIGN KEY (justificativa_motivo_id) REFERENCES justificativa_motivos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Administração > Operação > "Configurações de Feedbacks — configurar prazos
-- em dias e CORES para status de feedbacks". A cor do badge e o prazo saem do
-- banco, não do CSS.
CREATE TABLE feedback_status_configuracoes (
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
-- feedbacks".
CREATE TABLE feedback_pesquisas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  feedback_id BIGINT UNSIGNED NOT NULL,
  respondido_por_id BIGINT UNSIGNED NULL,
  nota TINYINT UNSIGNED NULL,
  concorda TINYINT(1) NULL,
  comentario TEXT NULL,
  respondido_em DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feedback_pesquisas_feedback (feedback_id),
  KEY idx_feedback_pesquisas_nota (nota),
  CONSTRAINT fk_feedback_pesquisas_feedback
    FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_pesquisas_respondido_por
    FOREIGN KEY (respondido_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Contestações
--
-- Duas tabelas, não uma: a contestação é o PEDIDO do operado sobre uma
-- avaliação, e cada item é um critério contestado dentro daquele pedido. É
-- isso que a coluna "Itens Contestados" da tela Gestão ADM conta, e é isso
-- que permite deferir um critério e indeferir outro no mesmo pedido.
-- ---------------------------------------------------------------------------

CREATE TABLE contestacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  aberta_por_id BIGINT UNSIGNED NOT NULL,
  julgada_por_id BIGINT UNSIGNED NULL,
  status ENUM('pendente','em_analise','julgada','cancelada') NOT NULL DEFAULT 'pendente',
  -- Consolidado dos itens.
  resultado ENUM('deferida','parcial','indeferida') NULL,
  -- Vem do SLA da campanha no momento da abertura.
  prazo_julgamento DATE NULL,
  score_anterior DECIMAL(6,2) NULL,
  score_final DECIMAL(6,2) NULL,
  motivo TEXT NOT NULL,
  parecer TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  julgada_em DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_contestacoes_avaliacao (avaliacao_id),
  KEY idx_contestacoes_status (status),
  KEY idx_contestacoes_prazo (prazo_julgamento),
  KEY idx_contestacoes_status_data (status, created_at),
  KEY idx_contestacoes_aberta_por (aberta_por_id),
  CONSTRAINT fk_contestacoes_avaliacao
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_contestacoes_aberta_por
    FOREIGN KEY (aberta_por_id) REFERENCES users(id),
  CONSTRAINT fk_contestacoes_julgada_por
    FOREIGN KEY (julgada_por_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contestacao_itens (
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

-- Administração > Operação > "SLA de Contestações — configurar prazos de
-- resposta (SLA) para contestações POR CAMPANHA". Campanha sem linha aqui usa
-- o prazo padrão da aplicação.
CREATE TABLE sla_contestacoes (
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

-- ---------------------------------------------------------------------------
-- Metas mensais de monitoria
--
-- Nota sobre o UNIQUE: `campanha_id` é NULL para meta de cliente inteiro, e o
-- MySQL aceita vários NULL num índice UNIQUE. Duas metas de cliente para o
-- mesmo mês, portanto, não são barradas pelo banco — a aplicação valida.
-- ---------------------------------------------------------------------------

CREATE TABLE metas_monitoria (
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

-- ---------------------------------------------------------------------------
-- Justificativas registradas
--
-- Alimenta os relatórios "Ausência de Monitoria" e "Fichas Excluídas".
-- ---------------------------------------------------------------------------

CREATE TABLE justificativas (
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

-- ---------------------------------------------------------------------------
-- Automações
--
-- Administração > Operação > "Automações — gerenciar REGRAS, TEMPLATES,
-- DESTINOS e EXECUÇÕES automáticas". As quatro palavras são as quatro tabelas.
-- ---------------------------------------------------------------------------

CREATE TABLE automacao_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  canal ENUM('email','whatsapp','webhook','interno') NOT NULL DEFAULT 'email',
  assunto VARCHAR(200) NULL,
  corpo TEXT NOT NULL,
  variaveis_json LONGTEXT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automacao_templates_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE automacoes (
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

CREATE TABLE automacao_destinos (
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

CREATE TABLE automacao_execucoes (
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

-- ---------------------------------------------------------------------------
-- Workflow
--
-- Administração > Operação > "Ver meu Workflow — visualizar o workflow ATIVO
-- em modo de visualização". Só leitura na tela; a definição vem daqui.
-- ---------------------------------------------------------------------------

CREATE TABLE workflows (
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

CREATE TABLE workflow_etapas (
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

-- ---------------------------------------------------------------------------
-- Bug reports (Administração > Operação > Bug Reports)
-- ---------------------------------------------------------------------------

CREATE TABLE bug_reports (
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

-- ---------------------------------------------------------------------------
-- Relatórios
--
-- A estrela de favorito da tela é POR USUÁRIO (é a lista de quem está logado
-- que aparece marcada), por isso `relatorio_favoritos` e não uma coluna
-- `favorito` no tipo de relatório.
-- ---------------------------------------------------------------------------

CREATE TABLE relatorio_tipos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(400) NULL,
  -- 'sistema' = chip "Sistema" da tela; 'ia' = saída em texto interpretado.
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

CREATE TABLE relatorio_favoritos (
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
CREATE TABLE relatorio_execucoes (
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
