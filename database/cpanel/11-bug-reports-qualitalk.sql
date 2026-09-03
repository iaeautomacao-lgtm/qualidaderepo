-- QualiDDM - Bug Reports herdados do QualiTalk
-- Importar no phpMyAdmin depois da estrutura principal.
-- Script idempotente: pode rodar mais de uma vez sem duplicar os registros.

ALTER TABLE bug_reports
  MODIFY status ENUM('aberto','em_analise','aguardando_teste','resolvido','nao_corrigir','descartado') NOT NULL DEFAULT 'aberto';

DROP PROCEDURE IF EXISTS qualiddm_add_bug_report_column_if_missing;
DELIMITER //
CREATE PROCEDURE qualiddm_add_bug_report_column_if_missing(
  IN coluna_nome VARCHAR(64),
  IN coluna_definicao TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bug_reports'
       AND COLUMN_NAME = coluna_nome
  ) THEN
    SET @sql = CONCAT('ALTER TABLE bug_reports ADD COLUMN ', coluna_definicao);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL qualiddm_add_bug_report_column_if_missing('tipo', "tipo ENUM('bug','melhoria','feature') NOT NULL DEFAULT 'bug' AFTER severidade");
CALL qualiddm_add_bug_report_column_if_missing('reportado_por_nome', "reportado_por_nome VARCHAR(160) NULL AFTER reportado_por_id");
CALL qualiddm_add_bug_report_column_if_missing('reportado_por_email', "reportado_por_email VARCHAR(180) NULL AFTER reportado_por_nome");
CALL qualiddm_add_bug_report_column_if_missing('referencia', "referencia VARCHAR(40) NULL AFTER rota");
CALL qualiddm_add_bug_report_column_if_missing('contexto_json', "contexto_json LONGTEXT NULL AFTER anexo_path");
CALL qualiddm_add_bug_report_column_if_missing('requisicoes_erro_json', "requisicoes_erro_json LONGTEXT NULL AFTER contexto_json");
CALL qualiddm_add_bug_report_column_if_missing('console_erros_json', "console_erros_json LONGTEXT NULL AFTER requisicoes_erro_json");
CALL qualiddm_add_bug_report_column_if_missing('browser_json', "browser_json LONGTEXT NULL AFTER console_erros_json");
CALL qualiddm_add_bug_report_column_if_missing('usuario_sessao_json', "usuario_sessao_json LONGTEXT NULL AFTER browser_json");
CALL qualiddm_add_bug_report_column_if_missing('acoes_usuario_json', "acoes_usuario_json LONGTEXT NULL AFTER usuario_sessao_json");
CALL qualiddm_add_bug_report_column_if_missing('ultima_interacao', "ultima_interacao DATETIME NULL AFTER acoes_usuario_json");

DROP PROCEDURE IF EXISTS qualiddm_add_bug_report_column_if_missing;

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Incluir filtro de supervisor e o supervisor no relatorio de Monitoria Detalhada',
  'Cliente solicitou a inclusao de filtro de supervisor, alem de incluir uma coluna com o supervisor do operador avaliado no relatorio Monitoria detalhada.',
  'media', 'feature', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/relatorios/exportacao', 'd54deb9c',
  '{}',
  '[{"status":403,"method":"GET","tempoMs":75,"url":"https://app.qualitalk.com.br/api/tenants/5f210c1f-0f52-467a-9301-4608266e9d06","response":"Forbidden"}]',
  '[{"nivel":"error","mensagem":"Error loading forms: coluna forms.deleted_via_client_id ausente."}]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"2292x1047","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Abriu modal de bug report"]',
  '2026-08-11 10:45:00', '2026-08-11 10:45:00', '2026-08-11 10:45:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = 'd54deb9c');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Processamento em PDF de conversa de texto nao gera transcricao',
  'PDFs de conversa de texto devem gerar conteudo ou transcricao antes da analise IA.',
  'alta', 'bug', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/monitor-ia/avaliacoes', '97d4b417',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Enviou PDF para processamento IA"]',
  '2026-08-10 09:20:00', '2026-08-10 09:20:00', '2026-08-10 09:20:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '97d4b417');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Erro ao tentar alterar cliente do formulario',
  'Ao tentar alterar cliente do formulario, a plataforma apresenta erro quando o cliente ja nao existe na tela de clientes. O formulario deveria permitir troca para outro cliente sem bloquear a edicao.',
  'alta', 'bug', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/formularios/cadastro', '8b8cc4a1',
  '{}',
  '[{"status":500,"method":"PATCH","tempoMs":430,"url":"/api/formularios/cadastro","response":"Cliente vinculado nao encontrado"}]',
  '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Editou formulario","Alterou cliente"]',
  '2026-08-01 17:08:00', '2026-08-01 17:08:00', '2026-08-01 17:08:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '8b8cc4a1');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Processamento do Monitor IA nao esta ocorrendo',
  'O processamento do Monitor IA nao avanca apos envio de gravacoes e nao gera transcricao nem avaliacao.',
  'alta', 'bug', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/monitor-ia/transcricoes', 'bfc38042',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Subiu gravacao","Aguardou processamento"]',
  '2026-07-23 12:10:00', '2026-07-23 12:10:00', '2026-07-23 12:10:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = 'bfc38042');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Melhoria na visualizacao da avaliacao',
  'Cliente pediu para estudar a possibilidade de tornar o cabecalho dos dados da avaliacao recolhivel com botao de expandir e recolher para que as respostas do formulario preencham a tela e facilitem a visualizacao.',
  'media', 'melhoria', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/formularios/avaliacoes', '53455195',
  '{}', '[]', '[{"nivel":"warn","mensagem":"Nenhum conjunto de faixas ativo encontrado"},{"nivel":"warn","mensagem":"Nenhum conjunto de quadrantes ativo encontrado"}]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1698x776","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Visualizou avaliacao","Abriu respostas do formulario"]',
  '2026-07-21 17:08:00', '2026-07-21 17:08:00', '2026-07-21 17:08:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '53455195');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Incluir a opcao de filtrar por avaliado na tela Visao Centralizada',
  'Incluir a opcao de filtrar por avaliado na tela Visao Centralizada.',
  'media', 'feature', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/visao-centralizada', '2f7a2f15',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Acessou visao centralizada"]',
  '2026-07-15 16:20:00', '2026-07-15 16:20:00', '2026-07-15 16:20:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '2f7a2f15');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Incluir opcao de exportar em planilha os resultados das analises diretamente na tela Avaliacoes IA',
  'Incluir opcao de exportar em planilha os resultados das analises diretamente na tela Avaliacoes IA.',
  'media', 'feature', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/monitor-ia/avaliacoes', '924e438c',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Visualizou Avaliacoes IA"]',
  '2026-07-15 16:51:00', '2026-07-15 16:51:00', '2026-07-15 16:51:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '924e438c');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Incluir filtro por cliente e campanha na tela Avaliacoes IA',
  'Incluir filtros por cliente e campanha na tela Avaliacoes IA para facilitar recortes por carteira.',
  'media', 'feature', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/monitor-ia/avaliacoes', '4e2726a8',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Visualizou filtros de Avaliacoes IA"]',
  '2026-07-15 15:30:00', '2026-07-15 15:30:00', '2026-07-15 15:30:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = '4e2726a8');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Incluir nome do Avaliado no relatorio Monitoria Detalhada',
  'Incluir o nome do avaliado no relatorio Monitoria Detalhada para melhorar rastreabilidade operacional.',
  'media', 'melhoria', 'aberto', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/relatorios/exportacao', 'd18f0cd5',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Exportou relatorio detalhado"]',
  '2026-07-03 11:15:00', '2026-07-03 11:15:00', '2026-07-03 11:15:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = 'd18f0cd5');

INSERT INTO bug_reports
  (titulo, descricao, severidade, tipo, status, reportado_por_nome, reportado_por_email, rota, referencia,
   contexto_json, requisicoes_erro_json, console_erros_json, browser_json, usuario_sessao_json, acoes_usuario_json,
   ultima_interacao, created_at, updated_at)
SELECT
  'Plataforma nao apresenta opcao para excluir Monitor IA',
  'Plataforma nao apresenta opcao para excluir Monitor IA.',
  'media', 'bug', 'resolvido', 'Raphael Outstand', 'raphael.ddm@outstand.com.br',
  '/dashboard/monitor-ia', 'd0835acd',
  '{}', '[]', '[]',
  '{"plataforma":"Win32","idioma":"pt-BR","viewport":"1920x1080","tema":"light"}',
  '{"nome":"Raphael Outstand","email":"raphael.ddm@outstand.com.br","perfil":"Administrador","tenant":"DDM"}',
  '["Acessou Monitor IA"]',
  '2026-04-17 09:00:00', '2026-04-17 09:00:00', '2026-04-17 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM bug_reports WHERE referencia = 'd0835acd');

