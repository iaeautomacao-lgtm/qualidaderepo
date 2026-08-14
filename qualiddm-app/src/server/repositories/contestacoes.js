import { isMissingSchemaError, one, paraLike, query } from "../db";
import { notFound } from "../errors";
import { formatarDataHora, formatarDataIso, inteiro } from "../format";

export const STATUS_CONTESTACAO = ["pendente", "em_analise", "julgada", "cancelada"];
export const FILTRO_STATUS = [...STATUS_CONTESTACAO, "todos"];

const LABEL_STATUS = {
  pendente: "Pendente",
  em_analise: "Em análise",
  julgada: "Julgada",
  cancelada: "Cancelada",
};

const LABEL_RESULTADO = {
  deferida: "Deferida",
  parcial: "Parcial",
  indeferida: "Indeferida",
};

const LABEL_STATUS_CRITERIO = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  nao_aplicavel: "Não Aplicável",
};

// Mesmo contrato do repositório de feedbacks: conjunto fechado de filtros,
// cada um virando um placeholder nomeado.
function montarFiltros(filtros = {}) {
  const condicoes = ["a.excluida_em IS NULL"];
  const params = {};

  if (filtros.clienteId) {
    condicoes.push("a.cliente_id = :clienteId");
    params.clienteId = filtros.clienteId;
  }
  if (filtros.campanhaId) {
    condicoes.push("a.campanha_id = :campanhaId");
    params.campanhaId = filtros.campanhaId;
  }
  if (filtros.avaliadoId) {
    condicoes.push("a.avaliado_id = :avaliadoId");
    params.avaliadoId = filtros.avaliadoId;
  }
  if (filtros.avaliadorId) {
    condicoes.push("a.avaliador_id = :avaliadorId");
    params.avaliadorId = filtros.avaliadorId;
  }
  if (filtros.dataInicio) {
    condicoes.push("c.created_at >= :dataInicio");
    params.dataInicio = `${filtros.dataInicio} 00:00:00`;
  }
  if (filtros.dataFim) {
    condicoes.push("c.created_at <= :dataFim");
    params.dataFim = `${filtros.dataFim} 23:59:59`;
  }
  // Caixa "Buscar por ID (Ex: QA-24-000123 ou 000123)": LIKE por sufixo cobre
  // as duas formas sem a tela ter de saber montar o código completo.
  if (filtros.codigo) {
    condicoes.push("a.codigo LIKE :codigo");
    params.codigo = paraLike(filtros.codigo);
  }
  // Caixa "Buscar por formulário, avaliado ou monitor...".
  if (filtros.busca) {
    condicoes.push("(f.nome LIKE :busca OR av.name LIKE :busca OR mo.name LIKE :busca)");
    params.busca = paraLike(filtros.busca);
  }

  return { where: condicoes.join("\n         AND "), params };
}

const JOINS = `
         JOIN avaliacoes a ON a.id = c.avaliacao_id
         JOIN formularios f ON f.id = a.formulario_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
         JOIN clientes cl ON cl.id = a.cliente_id
         JOIN users av ON av.id = a.avaliado_id
         JOIN users mo ON mo.id = a.avaliador_id`;

function vazio(limit, offset) {
  return {
    contadores: { todas: 0, pendentes: 0, emAnalise: 0, julgadas: 0, canceladas: 0, contestacoes: 0 },
    paginacao: { limit, offset, total: 0 },
    itens: [],
  };
}

/**
 * Lista as AVALIAÇÕES que têm contestação — é assim que a tela Gestão ADM
 * mostra ("Avaliações com Contestações"), com a contagem de itens contestados
 * por avaliação, não uma linha por contestação.
 *
 * Contadores e total de paginação saem de uma única query agregada.
 */
export async function listarContestacoes({ filtros = {}, limit = 50, offset = 0 } = {}) {
  const { where, params } = montarFiltros(filtros);
  const status = filtros.status && filtros.status !== "todos" ? filtros.status : null;
  const clausulaStatus = status ? "AND c.status = :status" : "";
  const paramsStatus = status ? { status } : {};

  try {
    const contadores = await one(
      `SELECT
          COUNT(DISTINCT c.avaliacao_id) AS todas,
          COUNT(*)                       AS contestacoes,
          SUM(c.status = 'pendente')     AS pendentes,
          SUM(c.status = 'em_analise')   AS em_analise,
          SUM(c.status = 'julgada')      AS julgadas,
          SUM(c.status = 'cancelada')    AS canceladas,
          COUNT(DISTINCT CASE WHEN c.status = 'pendente'   THEN c.avaliacao_id END) AS av_pendentes,
          COUNT(DISTINCT CASE WHEN c.status = 'em_analise' THEN c.avaliacao_id END) AS av_em_analise,
          COUNT(DISTINCT CASE WHEN c.status = 'julgada'    THEN c.avaliacao_id END) AS av_julgadas,
          COUNT(DISTINCT CASE WHEN c.status = 'cancelada'  THEN c.avaliacao_id END) AS av_canceladas
         FROM contestacoes c
         ${JOINS}
        WHERE ${where}`,
      params,
    );

    const totalPorStatus = {
      pendente: inteiro(contadores?.av_pendentes),
      em_analise: inteiro(contadores?.av_em_analise),
      julgada: inteiro(contadores?.av_julgadas),
      cancelada: inteiro(contadores?.av_canceladas),
    };

    const rows = await query(
      `SELECT
          a.id AS db_id,
          a.codigo,
          a.score,
          f.nome  AS formulario,
          ca.nome AS campanha,
          cl.nome AS cliente,
          av.name AS avaliado,
          mo.name AS avaliador,
          COUNT(DISTINCT ci.id) AS itens_contestados,
          COUNT(DISTINCT c.id)  AS contestacoes,
          MAX(c.created_at)     AS ultima_abertura,
          MIN(c.prazo_julgamento) AS prazo,
          SUM(c.status = 'pendente')   AS pendentes,
          SUM(c.status = 'em_analise') AS em_analise,
          SUM(c.status = 'julgada')    AS julgadas
         FROM contestacoes c
         ${JOINS}
         LEFT JOIN contestacao_itens ci ON ci.contestacao_id = c.id
        WHERE ${where}
          ${clausulaStatus}
        GROUP BY a.id, a.codigo, a.score, f.nome, ca.nome, cl.nome, av.name, mo.name
        ORDER BY MAX(c.created_at) DESC, a.id DESC
        LIMIT :limit OFFSET :offset`,
      { ...params, ...paramsStatus, limit, offset },
    );

    return {
      contadores: {
        todas: inteiro(contadores?.todas),
        contestacoes: inteiro(contadores?.contestacoes),
        pendentes: inteiro(contadores?.pendentes),
        emAnalise: inteiro(contadores?.em_analise),
        julgadas: inteiro(contadores?.julgadas),
        canceladas: inteiro(contadores?.canceladas),
      },
      paginacao: {
        limit,
        offset,
        total: status ? totalPorStatus[status] ?? 0 : inteiro(contadores?.todas),
      },
      itens: rows.map((row) => {
        // Status mostrado na linha é o estado agregado da avaliação: se ainda
        // existe pedido sem julgar, a linha está pendente.
        const pendentes = inteiro(row.pendentes);
        const emAnalise = inteiro(row.em_analise);
        const statusLinha = pendentes > 0 ? "pendente" : emAnalise > 0 ? "em_analise" : "julgada";

        return {
          id: row.codigo,
          avaliacaoId: String(row.db_id),
          formulario: row.formulario,
          campanha: row.campanha || "Sem campanha",
          cliente: row.cliente,
          avaliado: row.avaliado,
          avaliador: row.avaliador,
          itensContestados: inteiro(row.itens_contestados),
          contestacoes: inteiro(row.contestacoes),
          score: row.score == null ? null : Number(row.score),
          status: statusLinha,
          statusLabel: LABEL_STATUS[statusLinha],
          prazo: formatarDataIso(row.prazo),
          ultimaAbertura: formatarDataHora(row.ultima_abertura),
        };
      }),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return vazio(limit, offset);
    return vazio(limit, offset);
  }
}

/**
 * Detalhe: as contestações de uma avaliação com os itens contestados,
 * o critério de cada item e o parecer do julgamento.
 */
export async function obterContestacoesDaAvaliacao(codigo) {
  const avaliacao = await one(
    `SELECT a.id, a.codigo, a.score, f.nome AS formulario, cl.nome AS cliente,
            ca.nome AS campanha, av.name AS avaliado, mo.name AS avaliador
       FROM avaliacoes a
       JOIN formularios f ON f.id = a.formulario_id
       JOIN clientes cl ON cl.id = a.cliente_id
       LEFT JOIN campanhas ca ON ca.id = a.campanha_id
       JOIN users av ON av.id = a.avaliado_id
       JOIN users mo ON mo.id = a.avaliador_id
      WHERE a.codigo = :codigo
        AND a.excluida_em IS NULL
      LIMIT 1`,
    { codigo },
  );

  if (!avaliacao) throw notFound("Avaliação não encontrada.");

  try {
    const [cabecalhos, itens] = await Promise.all([
      query(
        `SELECT c.id, c.status, c.resultado, c.motivo, c.parecer,
                c.prazo_julgamento, c.score_anterior, c.score_final,
                c.created_at, c.julgada_em,
                ab.name AS aberta_por, ju.name AS julgada_por
           FROM contestacoes c
           JOIN users ab ON ab.id = c.aberta_por_id
           LEFT JOIN users ju ON ju.id = c.julgada_por_id
          WHERE c.avaliacao_id = :avaliacaoId
          ORDER BY c.created_at DESC`,
        { avaliacaoId: avaliacao.id },
      ),
      query(
        `SELECT ci.id, ci.contestacao_id, ci.argumento, ci.status_original,
                ci.status_final, ci.resultado, ci.parecer, ci.julgada_em,
                cr.nome AS criterio, cr.enunciado, cr.eliminatoria,
                cr.peso_pts, s.nome AS secao,
                ju.name AS julgada_por
           FROM contestacao_itens ci
           JOIN contestacoes c ON c.id = ci.contestacao_id
           JOIN avaliacao_respostas r ON r.id = ci.avaliacao_resposta_id
           JOIN formulario_criterios cr ON cr.id = r.criterio_id
           JOIN formulario_secoes s ON s.id = cr.secao_id
           LEFT JOIN users ju ON ju.id = ci.julgada_por_id
          WHERE c.avaliacao_id = :avaliacaoId
          ORDER BY s.posicao, cr.posicao`,
        { avaliacaoId: avaliacao.id },
      ),
    ]);

    const itensPorContestacao = new Map();
    for (const item of itens) {
      const chave = String(item.contestacao_id);
      if (!itensPorContestacao.has(chave)) itensPorContestacao.set(chave, []);
      itensPorContestacao.get(chave).push({
        id: String(item.id),
        secao: item.secao,
        criterio: item.criterio,
        enunciado: item.enunciado,
        eliminatoria: Boolean(item.eliminatoria),
        peso: item.peso_pts == null ? null : Number(item.peso_pts),
        argumento: item.argumento,
        statusOriginal: LABEL_STATUS_CRITERIO[item.status_original] || item.status_original,
        statusFinal: LABEL_STATUS_CRITERIO[item.status_final] || item.status_final,
        resultado: item.resultado,
        parecer: item.parecer,
        julgadaPor: item.julgada_por || null,
        julgadaEm: formatarDataHora(item.julgada_em),
      });
    }

    return {
      avaliacao: {
        id: avaliacao.codigo,
        formulario: avaliacao.formulario,
        cliente: avaliacao.cliente,
        campanha: avaliacao.campanha || "Sem campanha",
        avaliado: avaliacao.avaliado,
        avaliador: avaliacao.avaliador,
        score: avaliacao.score == null ? null : Number(avaliacao.score),
      },
      contestacoes: cabecalhos.map((row) => ({
        id: String(row.id),
        status: row.status,
        statusLabel: LABEL_STATUS[row.status] || row.status,
        resultado: row.resultado,
        resultadoLabel: LABEL_RESULTADO[row.resultado] || null,
        motivo: row.motivo,
        parecer: row.parecer,
        prazo: formatarDataIso(row.prazo_julgamento),
        scoreAnterior: row.score_anterior == null ? null : Number(row.score_anterior),
        scoreFinal: row.score_final == null ? null : Number(row.score_final),
        abertaPor: row.aberta_por,
        abertaEm: formatarDataHora(row.created_at),
        julgadaPor: row.julgada_por || null,
        julgadaEm: formatarDataHora(row.julgada_em),
        itens: itensPorContestacao.get(String(row.id)) || [],
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return {
        avaliacao: {
          id: avaliacao.codigo,
          formulario: avaliacao.formulario,
          cliente: avaliacao.cliente,
          campanha: avaliacao.campanha || "Sem campanha",
          avaliado: avaliacao.avaliado,
          avaliador: avaliacao.avaliador,
          score: avaliacao.score == null ? null : Number(avaliacao.score),
        },
        contestacoes: [],
      };
    }
    return [];
  }
}

/** SLA de contestação por campanha (tela Administração > Operação). */
export async function listarSlaContestacoes() {
  try {
    const rows = await query(
      `SELECT s.id, s.campanha_id, s.prazo_abertura_dias, s.prazo_julgamento_dias, s.ativo,
              ca.nome AS campanha, cl.nome AS cliente
         FROM sla_contestacoes s
         JOIN campanhas ca ON ca.id = s.campanha_id
         LEFT JOIN clientes cl ON cl.id = ca.cliente_id
        ORDER BY cl.nome, ca.nome`,
    );

    return rows.map((row) => ({
      id: String(row.id),
      campanhaId: String(row.campanha_id),
      campanha: row.campanha,
      cliente: row.cliente || "Sem cliente",
      prazoAberturaDias: inteiro(row.prazo_abertura_dias),
      prazoJulgamentoDias: inteiro(row.prazo_julgamento_dias),
      ativo: Boolean(row.ativo),
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    return [];
  }
}
