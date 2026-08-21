-- 05 - Diagnostico de importacao QualiDDM
-- Rode no phpMyAdmin depois de importar os SQLs para confirmar se o banco
-- tem os vinculos que as telas precisam mostrar.

SET NAMES utf8mb4;

SELECT
  'usuarios' AS item,
  COUNT(*) AS total,
  SUM(active = 1) AS ativos,
  SUM(cargo_id IS NOT NULL) AS com_cargo,
  SUM(cliente_id IS NOT NULL) AS com_carteira,
  SUM(turno_id IS NOT NULL) AS com_turno,
  SUM(supervisor_id IS NOT NULL) AS com_superior,
  SUM(login IS NOT NULL AND login <> '') AS com_login,
  SUM(matricula IS NOT NULL AND matricula <> '') AS com_matricula
FROM users;

SELECT
  'escopos_usuario_campanha' AS item,
  COUNT(*) AS total
FROM user_campanhas;

SELECT
  'avaliacoes' AS item,
  COUNT(*) AS total,
  SUM(origem = 'ia') AS origem_ia,
  SUM(score IS NOT NULL) AS com_nota,
  SUM(total_criterios > 0) AS com_criterios,
  SUM(excluida_em IS NULL) AS visiveis
FROM avaliacoes;

SELECT
  'respostas_de_avaliacao' AS item,
  COUNT(*) AS total,
  SUM(status = 'conforme') AS conformes,
  SUM(status = 'nao_conforme') AS nao_conformes,
  SUM(status = 'nao_aplicavel') AS nao_aplicaveis,
  SUM(ia_evidencia IS NOT NULL AND ia_evidencia <> '') AS com_evidencia
FROM avaliacao_respostas;

SELECT
  'gravacoes_transcricoes' AS item,
  COUNT(DISTINCT g.id) AS gravacoes,
  COUNT(DISTINCT t.id) AS transcricoes,
  SUM(g.avaliacao_id IS NOT NULL) AS gravacoes_com_avaliacao,
  SUM(t.segmentos_json IS NOT NULL AND t.segmentos_json <> '') AS transcricoes_com_json
FROM gravacoes g
LEFT JOIN transcricoes t ON t.gravacao_id = g.id;

SELECT
  u.id,
  u.name AS usuario,
  u.email,
  cg.nome AS cargo,
  cl.nome AS carteira,
  tu.nome AS turno,
  sup.name AS superior,
  COUNT(uc.campanha_id) AS campanhas
FROM users u
LEFT JOIN cargos cg ON cg.id = u.cargo_id
LEFT JOIN clientes cl ON cl.id = u.cliente_id
LEFT JOIN turnos tu ON tu.id = u.turno_id
LEFT JOIN users sup ON sup.id = u.supervisor_id
LEFT JOIN user_campanhas uc ON uc.user_id = u.id AND uc.ativo = 1
GROUP BY u.id, u.name, u.email, cg.nome, cl.nome, tu.nome, sup.name
ORDER BY u.active DESC, u.name
LIMIT 30;
