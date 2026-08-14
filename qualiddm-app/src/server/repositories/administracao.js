import { isMissingSchemaError, one, query } from "../db";
import { formatarDataHora, inteiro } from "../format";

// Os 4 números do bloco "Status do RBAC" da tela Administração > Usuários.
// `usuariosAtivos` e `campanhasAtivas` saem de tabelas que existem desde a
// migration 002; `cargos` e `permissoes` só depois da 003 — por isso as duas
// consultas são separadas: quando o catálogo RBAC ainda não existe, a tela
// mostra 0 nesses dois cards em vez de estourar erro nos quatro.
async function contadoresRbac() {
  const base = await one(
    `SELECT
        (SELECT COUNT(*) FROM users WHERE active = 1)     AS usuarios_ativos,
        (SELECT COUNT(*) FROM campanhas WHERE ativa = 1)  AS campanhas_ativas,
        (SELECT COUNT(*) FROM clientes WHERE ativo = 1)   AS clientes_ativos`,
  );

  let cargos = 0;
  let permissoes = 0;
  try {
    const catalogo = await one(
      `SELECT
          (SELECT COUNT(*) FROM cargos WHERE ativo = 1) AS cargos,
          (SELECT COUNT(*) FROM permissoes)             AS permissoes`,
    );
    cargos = inteiro(catalogo?.cargos);
    permissoes = inteiro(catalogo?.permissoes);
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
  }

  return {
    usuariosAtivos: inteiro(base?.usuarios_ativos),
    cargos,
    permissoes,
    campanhasAtivas: inteiro(base?.campanhas_ativas),
    clientesAtivos: inteiro(base?.clientes_ativos),
  };
}

// Bloco "Atividade Recente". O print mostra e-mail + módulo + ação + entidade,
// que é exatamente o que audit_logs guarda depois da 003.
async function atividadeRecente(limite) {
  try {
    const rows = await query(
      `SELECT l.id, l.acao, l.modulo, l.entidade, l.entidade_id,
              l.resultado, l.severidade, l.detalhe, l.ip, l.created_at,
              u.email, u.name
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT :limite`,
      { limite },
    );

    return rows.map((row) => ({
      id: String(row.id),
      usuario: row.email || row.name || "Sistema",
      nome: row.name || null,
      acao: row.acao,
      modulo: row.modulo || null,
      entidade: row.entidade || null,
      entidadeId: row.entidade_id || null,
      resultado: row.resultado || "sucesso",
      severidade: row.severidade || "info",
      detalhe: row.detalhe || null,
      ip: row.ip || null,
      quando: formatarDataHora(row.created_at),
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}

// Contagem por funcionalidade da aba Operação. Uma query só, e toda ela
// dentro do try: se a 003 não rodou, os cards mostram zero.
async function contadoresOperacao() {
  try {
    return await one(
      `SELECT
          (SELECT COUNT(*) FROM automacoes WHERE ativo = 1)        AS automacoes,
          (SELECT COUNT(*) FROM automacao_templates WHERE ativo = 1) AS templates,
          (SELECT COUNT(*) FROM faixa_conjuntos WHERE ativo = 1)   AS faixa_conjuntos,
          (SELECT COUNT(*) FROM sla_contestacoes WHERE ativo = 1)  AS sla_contestacoes,
          (SELECT COUNT(*) FROM metas_monitoria)                   AS metas,
          (SELECT COUNT(*) FROM formulario_categorias WHERE ativo = 1) AS categorias,
          (SELECT COUNT(*) FROM justificativa_motivos WHERE ativo = 1) AS motivos_justificativa,
          (SELECT COUNT(*) FROM turnos WHERE ativo = 1)            AS turnos,
          (SELECT COUNT(*) FROM workflows WHERE ativo = 1)         AS workflows_ativos,
          (SELECT COUNT(*) FROM bug_reports WHERE status = 'aberto') AS bugs_abertos`,
    );
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}

/** Alimenta a tela Administração (abas Operação e Usuários). */
export async function getAdministracaoMetricas({ limiteAtividade = 20 } = {}) {
  const [rbac, atividade, operacao] = await Promise.all([
    contadoresRbac(),
    atividadeRecente(limiteAtividade),
    contadoresOperacao(),
  ]);

  return {
    rbac,
    atividadeRecente: atividade,
    operacao: {
      automacoes: inteiro(operacao?.automacoes),
      templates: inteiro(operacao?.templates),
      faixaConjuntos: inteiro(operacao?.faixa_conjuntos),
      slaContestacoes: inteiro(operacao?.sla_contestacoes),
      metas: inteiro(operacao?.metas),
      categorias: inteiro(operacao?.categorias),
      motivosJustificativa: inteiro(operacao?.motivos_justificativa),
      turnos: inteiro(operacao?.turnos),
      workflowsAtivos: inteiro(operacao?.workflows_ativos),
      bugsAbertos: inteiro(operacao?.bugs_abertos),
    },
  };
}

/** Sessões e presença — quem está com sessão viva agora. */
export async function listarSessoes({ limit = 50, offset = 0, apenasAtivas = true } = {}) {
  const condicoes = ["s.revogada_em IS NULL"];
  if (apenasAtivas) condicoes.push("s.expires_at > CURRENT_TIMESTAMP");
  const where = `WHERE ${condicoes.join(" AND ")}`;

  try {
    const total = await one(`SELECT COUNT(*) AS total FROM user_sessions s ${where}`);

    const rows = await query(
      `SELECT s.id, s.ip, s.user_agent, s.expires_at, s.last_seen_at, s.created_at,
              u.id AS user_id, u.name, u.email, u.role, c.nome AS cargo
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN cargos c ON c.id = u.cargo_id
         ${where}
        ORDER BY COALESCE(s.last_seen_at, s.created_at) DESC, s.id DESC
        LIMIT :limit OFFSET :offset`,
      { limit, offset },
    );

    return {
      paginacao: { limit, offset, total: inteiro(total?.total) },
      itens: rows.map((row) => ({
        id: String(row.id),
        usuarioId: String(row.user_id),
        nome: row.name,
        email: row.email,
        papel: row.role,
        cargo: row.cargo || null,
        ip: row.ip || null,
        // Guardado íntegro no banco; na listagem vai truncado só para não
        // inflar o payload da tabela.
        dispositivo: row.user_agent ? String(row.user_agent).slice(0, 120) : null,
        vistoEm: formatarDataHora(row.last_seen_at || row.created_at),
        expiraEm: formatarDataHora(row.expires_at),
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return { paginacao: { limit, offset, total: 0 }, itens: [] };
    }
    throw error;
  }
}

/** Trilha de auditoria paginada (aba Usuários > Trilha de Auditoria). */
export async function listarAuditoria({ filtros = {}, limit = 50, offset = 0 } = {}) {
  const condicoes = [];
  const params = {};

  if (filtros.usuarioId) {
    condicoes.push("l.user_id = :usuarioId");
    params.usuarioId = filtros.usuarioId;
  }
  if (filtros.modulo) {
    condicoes.push("l.modulo = :modulo");
    params.modulo = filtros.modulo;
  }
  if (filtros.resultado) {
    condicoes.push("l.resultado = :resultado");
    params.resultado = filtros.resultado;
  }
  if (filtros.dataInicio) {
    condicoes.push("l.created_at >= :dataInicio");
    params.dataInicio = `${filtros.dataInicio} 00:00:00`;
  }
  if (filtros.dataFim) {
    condicoes.push("l.created_at <= :dataFim");
    params.dataFim = `${filtros.dataFim} 23:59:59`;
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";

  try {
    const total = await one(`SELECT COUNT(*) AS total FROM audit_logs l ${where}`, params);

    const rows = await query(
      `SELECT l.id, l.acao, l.modulo, l.entidade, l.entidade_id, l.resultado,
              l.severidade, l.detalhe, l.ip, l.created_at, u.email, u.name
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ${where}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset },
    );

    return {
      paginacao: { limit, offset, total: inteiro(total?.total) },
      itens: rows.map((row) => ({
        id: String(row.id),
        usuario: row.email || row.name || "Sistema",
        acao: row.acao,
        modulo: row.modulo || null,
        entidade: row.entidade || null,
        entidadeId: row.entidade_id || null,
        resultado: row.resultado || "sucesso",
        severidade: row.severidade || "info",
        detalhe: row.detalhe || null,
        ip: row.ip || null,
        quando: formatarDataHora(row.created_at),
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return { paginacao: { limit, offset, total: 0 }, itens: [] };
    }
    throw error;
  }
}

/** Cargos com a contagem de permissões e de usuários. */
export async function listarCargos() {
  try {
    const rows = await query(
      `SELECT c.id, c.slug, c.nome, c.descricao, c.role_base, c.nivel, c.sistema, c.ativo,
              COUNT(DISTINCT cp.permissao_id) AS permissoes,
              COUNT(DISTINCT u.id) AS usuarios
         FROM cargos c
         LEFT JOIN cargo_permissoes cp ON cp.cargo_id = c.id
         LEFT JOIN users u ON u.cargo_id = c.id AND u.active = 1
        GROUP BY c.id, c.slug, c.nome, c.descricao, c.role_base, c.nivel, c.sistema, c.ativo
        ORDER BY c.nivel DESC, c.nome`,
    );

    return rows.map((row) => ({
      id: String(row.id),
      slug: row.slug,
      nome: row.nome,
      descricao: row.descricao,
      papelBase: row.role_base,
      nivel: inteiro(row.nivel),
      sistema: Boolean(row.sistema),
      ativo: Boolean(row.ativo),
      permissoes: inteiro(row.permissoes),
      usuarios: inteiro(row.usuarios),
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}

/** Workflow ativo, em modo de visualização (card "Ver meu Workflow"). */
export async function obterWorkflowAtivo() {
  try {
    const workflow = await one(
      `SELECT id, slug, nome, descricao, versao
         FROM workflows
        WHERE ativo = 1
        ORDER BY versao DESC
        LIMIT 1`,
    );

    if (!workflow) return null;

    const etapas = await query(
      `SELECT e.chave, e.nome, e.descricao, e.ordem, e.prazo_dias, e.obrigatoria,
              c.nome AS cargo
         FROM workflow_etapas e
         LEFT JOIN cargos c ON c.id = e.cargo_id
        WHERE e.workflow_id = :workflowId
        ORDER BY e.ordem`,
      { workflowId: workflow.id },
    );

    return {
      id: String(workflow.id),
      slug: workflow.slug,
      nome: workflow.nome,
      descricao: workflow.descricao,
      versao: inteiro(workflow.versao, 1),
      etapas: etapas.map((etapa) => ({
        chave: etapa.chave,
        nome: etapa.nome,
        descricao: etapa.descricao,
        ordem: inteiro(etapa.ordem),
        prazoDias: etapa.prazo_dias == null ? null : inteiro(etapa.prazo_dias),
        obrigatoria: Boolean(etapa.obrigatoria),
        cargo: etapa.cargo || null,
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}
