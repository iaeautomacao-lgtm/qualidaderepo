import { isMissingSchemaError, one, paraLike, query } from "@/server/db";
import { formatarDataHora } from "@/server/format";

export const BUG_SEVERIDADES = ["baixa", "media", "alta", "critica"];
export const BUG_TIPOS = ["bug", "melhoria", "feature"];
export const BUG_STATUS = ["aberto", "em_analise", "aguardando_teste", "resolvido", "nao_corrigir", "descartado"];

const columnCache = new Map();

const SEVERIDADE_LABEL = {
  baixa: "Baixo",
  media: "Médio",
  alta: "Alto",
  critica: "Crítico",
};

const TIPO_LABEL = {
  bug: "Bug",
  melhoria: "Melhoria",
  feature: "Feature",
};

const STATUS_LABEL = {
  aberto: "Aberto",
  em_analise: "Em andamento",
  aguardando_teste: "Aguardando teste",
  resolvido: "Resolvido",
  nao_corrigir: "Não corrigir",
  descartado: "Descartado",
};

async function temColuna(coluna) {
  if (columnCache.has(coluna)) return columnCache.get(coluna);
  const row = await one(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bug_reports'
        AND COLUMN_NAME = :coluna`,
    { coluna },
  );
  const existe = Number(row?.total ?? 0) > 0;
  columnCache.set(coluna, existe);
  return existe;
}

function parseJson(valor, fallback = null) {
  if (!valor) return fallback;
  if (typeof valor !== "string") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

function normalizarReport(row) {
  const reportadoPor = row.reportado_por_nome || row.reportado_por_usuario || "Sistema";
  const reportadoEmail = row.reportado_por_email || row.reportado_por_usuario_email || null;

  return {
    id: String(row.id),
    titulo: row.titulo,
    descricao: row.descricao,
    severidade: row.severidade,
    severidadeLabel: SEVERIDADE_LABEL[row.severidade] ?? row.severidade,
    tipo: row.tipo || "bug",
    tipoLabel: TIPO_LABEL[row.tipo || "bug"] ?? row.tipo,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    rota: row.rota,
    referencia: row.referencia,
    anexoPath: row.anexo_path,
    resposta: row.resposta,
    reportadoPor,
    reportadoEmail,
    browser: parseJson(row.browser_json) || (row.user_agent ? { userAgent: row.user_agent } : null),
    usuarioSessao: parseJson(row.usuario_sessao_json),
    contexto: parseJson(row.contexto_json),
    requisicoesErro: parseJson(row.requisicoes_erro_json, []),
    consoleErros: parseJson(row.console_erros_json, []),
    acoesUsuario: parseJson(row.acoes_usuario_json, []),
    criadoEm: formatarDataHora(row.created_at),
    atualizadoEm: formatarDataHora(row.updated_at),
    ultimaInteracao: formatarDataHora(row.ultima_interacao || row.updated_at),
    resolvidoEm: formatarDataHora(row.resolvido_em),
  };
}

function contarPorStatus(linhas) {
  const base = {
    total: linhas.length,
    abertos: 0,
    emAndamento: 0,
    aguardandoTeste: 0,
    resolvidos: 0,
    naoCorrigir: 0,
  };
  for (const item of linhas) {
    if (item.status === "aberto") base.abertos += 1;
    if (item.status === "em_analise") base.emAndamento += 1;
    if (item.status === "aguardando_teste") base.aguardandoTeste += 1;
    if (item.status === "resolvido") base.resolvidos += 1;
    if (["nao_corrigir", "descartado"].includes(item.status)) base.naoCorrigir += 1;
  }
  return base;
}

export async function listarBugReports(filtros = {}) {
  try {
    const [
      temTipo,
      temReferencia,
      temContexto,
      temReq,
      temConsole,
      temBrowser,
      temSessao,
      temAcoes,
      temUltima,
      temNome,
      temEmail,
    ] = await Promise.all([
      temColuna("tipo"),
      temColuna("referencia"),
      temColuna("contexto_json"),
      temColuna("requisicoes_erro_json"),
      temColuna("console_erros_json"),
      temColuna("browser_json"),
      temColuna("usuario_sessao_json"),
      temColuna("acoes_usuario_json"),
      temColuna("ultima_interacao"),
      temColuna("reportado_por_nome"),
      temColuna("reportado_por_email"),
    ]);

    const where = [];
    const params = {};

    if (filtros.severidade && filtros.severidade !== "todos") {
      where.push("br.severidade = :severidade");
      params.severidade = filtros.severidade;
    }
    if (filtros.tipo && filtros.tipo !== "todos" && temTipo) {
      where.push("br.tipo = :tipo");
      params.tipo = filtros.tipo;
    }
    if (filtros.status && filtros.status !== "todos") {
      where.push("br.status = :status");
      params.status = filtros.status;
    }
    if (filtros.busca) {
      where.push("(br.titulo LIKE :busca OR br.descricao LIKE :busca OR br.rota LIKE :busca)");
      params.busca = paraLike(filtros.busca);
    }

    const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const linhas = await query(
      `SELECT
          br.id,
          br.titulo,
          br.descricao,
          br.severidade,
          br.status,
          ${temTipo ? "br.tipo" : "'bug' AS tipo"},
          br.rota,
          ${temReferencia ? "br.referencia" : "NULL AS referencia"},
          br.user_agent,
          br.anexo_path,
          br.resposta,
          br.created_at,
          br.updated_at,
          br.resolvido_em,
          ${temContexto ? "br.contexto_json" : "NULL AS contexto_json"},
          ${temReq ? "br.requisicoes_erro_json" : "NULL AS requisicoes_erro_json"},
          ${temConsole ? "br.console_erros_json" : "NULL AS console_erros_json"},
          ${temBrowser ? "br.browser_json" : "NULL AS browser_json"},
          ${temSessao ? "br.usuario_sessao_json" : "NULL AS usuario_sessao_json"},
          ${temAcoes ? "br.acoes_usuario_json" : "NULL AS acoes_usuario_json"},
          ${temUltima ? "br.ultima_interacao" : "NULL AS ultima_interacao"},
          ${temNome ? "br.reportado_por_nome" : "NULL AS reportado_por_nome"},
          ${temEmail ? "br.reportado_por_email" : "NULL AS reportado_por_email"},
          u.name AS reportado_por_usuario,
          u.email AS reportado_por_usuario_email
       FROM bug_reports br
       LEFT JOIN users u ON u.id = br.reportado_por_id
       ${sqlWhere}
       ORDER BY
          FIELD(br.status, 'aberto', 'em_analise', 'aguardando_teste', 'resolvido', 'nao_corrigir', 'descartado'),
          br.created_at DESC,
          br.id DESC
       LIMIT 250`,
      params,
    );

    const itens = linhas.map(normalizarReport);
    return {
      itens,
      contadores: contarPorStatus(itens),
      opcoes: {
        severidades: BUG_SEVERIDADES.map((id) => ({ id, rotulo: SEVERIDADE_LABEL[id] })),
        tipos: BUG_TIPOS.map((id) => ({ id, rotulo: TIPO_LABEL[id] })),
        status: BUG_STATUS.map((id) => ({ id, rotulo: STATUS_LABEL[id] })),
      },
    };
  } catch (erro) {
    if (isMissingSchemaError(erro)) {
      return {
        itens: [],
        contadores: contarPorStatus([]),
        opcoes: { severidades: [], tipos: [], status: [] },
      };
    }
    throw erro;
  }
}

export async function atualizarBugReport(id, alteracoes, userId) {
  const sets = [];
  const params = { id, userId: userId || null };

  if (alteracoes.status) {
    sets.push("status = :status");
    params.status = alteracoes.status;
    if (alteracoes.status === "resolvido") {
      sets.push("resolvido_por_id = :userId", "resolvido_em = NOW()");
    } else {
      sets.push("resolvido_por_id = NULL", "resolvido_em = NULL");
    }
  }
  if (alteracoes.resposta !== undefined) {
    sets.push("resposta = :resposta");
    params.resposta = alteracoes.resposta || null;
  }

  if (sets.length === 0) return listarBugReports();

  sets.push("updated_at = NOW()");
  await query(`UPDATE bug_reports SET ${sets.join(", ")} WHERE id = :id`, params);
  return listarBugReports();
}

export async function anexarBugReport(id, anexoPath) {
  await query(
    `UPDATE bug_reports
        SET anexo_path = :anexoPath,
            updated_at = NOW()
      WHERE id = :id`,
    { id, anexoPath },
  );

  return listarBugReports();
}
