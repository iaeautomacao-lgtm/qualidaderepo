import { query } from "../db";
import { CLIENTES_INICIAIS } from "../catalogo-inicial";

function emptyDashboard(period) {
  return {
    period,
    kpis: {
      averageScore: 0,
      reviews: 0,
      feedbackPending: 0,
      nonConformities: 0,
      averageDurationSeconds: 0,
      activeClients: 0,
    },
    qualityByDay: [],
    clients: [],
    quadrants: [],
    offenders: [],
    status: {
      feedbackOpen: 0,
      feedbackApplied: 0,
      contestations: 0,
      zeroedReviews: 0,
    },
    recentReviews: [],
    priorities: [],
  };
}

async function safe(label, fallback, work) {
  try {
    return await work();
  } catch (error) {
    console.warn(`[dashboard] ${label}: ${error?.code || "erro"} ${error?.message || error}`);
    return fallback;
  }
}

export async function getDashboardOverview({ period }) {
  const periodDays = period === "weekly" ? 7 : 31;
  const empty = emptyDashboard(period);

  const [kpisRows, clientesRows, qualityByDay, clients, quadrants, offenders, statusRows, recentReviews, priorities] = await Promise.all([
    safe("kpis", [{ reviews: 0, average_score: 0, feedback_pending: 0, non_conformities: 0, average_duration_seconds: 0 }], () =>
      query(
        `SELECT
            COUNT(*) AS reviews,
            ROUND(COALESCE(AVG(score), 0), 1) AS average_score,
            SUM(CASE WHEN status_feedback = 'pendente' THEN 1 ELSE 0 END) AS feedback_pending,
            SUM(COALESCE(total_nao_conformes, 0)) AS non_conformities,
            ROUND(COALESCE(AVG(duracao_segundos), 0), 0) AS average_duration_seconds
           FROM avaliacoes
          WHERE data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)`,
        { periodDays }
      )
    ),
    safe("clientes", [{ active_clients: CLIENTES_INICIAIS.length }], () =>
      query(
        `SELECT COUNT(*) AS active_clients
           FROM clientes
          WHERE ativo = 1`
      )
    ),
    safe("qualityByDay", [], () =>
      query(
        `SELECT DATE(data_avaliacao) AS day, ROUND(AVG(score), 1) AS score, COUNT(*) AS reviews
           FROM avaliacoes
          WHERE data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
          GROUP BY DATE(data_avaliacao)
          ORDER BY day`,
        { periodDays }
      )
    ),
    safe("clients", CLIENTES_INICIAIS.slice(0, 8).map((cliente) => ({ name: cliente.nome, reviews: 0, score: 0 })), () =>
      query(
        `SELECT
            c.nome AS name,
            COUNT(a.id) AS reviews,
            ROUND(COALESCE(AVG(a.score), 0), 1) AS score
           FROM clientes c
           LEFT JOIN avaliacoes a ON a.cliente_id = c.id
            AND a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
          GROUP BY c.id, c.nome
          ORDER BY reviews DESC, score ASC
          LIMIT 8`,
        { periodDays }
      )
    ),
    safe("quadrants", [], () =>
      query(
        `SELECT
            CASE
              WHEN score >= 90 THEN 'Excelência'
              WHEN score >= 80 THEN 'Conforme'
              WHEN score >= 70 THEN 'Atenção'
              ELSE 'Crítico'
            END AS label,
            COUNT(*) AS value
           FROM avaliacoes
          WHERE data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
          GROUP BY label
          ORDER BY MIN(score) DESC`,
        { periodDays }
      )
    ),
    safe("offenders", [], () =>
      query(
        `SELECT
            c.nome AS name,
            COUNT(*) AS failures
           FROM avaliacao_respostas r
           JOIN formulario_criterios c ON c.id = r.criterio_id
           JOIN avaliacoes a ON a.id = r.avaliacao_id
          WHERE r.status = 'nao_conforme'
            AND a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
          GROUP BY c.id, c.nome
          ORDER BY failures DESC, c.nome
          LIMIT 10`,
        { periodDays }
      )
    ),
    safe("status", [{ feedback_open: 0, feedback_applied: 0, contestations: 0, zeroed_reviews: 0 }], () =>
      query(
        `SELECT
            SUM(a.status_feedback IN ('pendente', 'assinatura', 'revisao')) AS feedback_open,
            SUM(a.status_feedback IN ('aplicado', 'concluida', 'justificada')) AS feedback_applied,
            (SELECT COUNT(*)
               FROM contestacoes c
              WHERE c.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)) AS contestations,
            SUM(COALESCE(a.zerada, 0) = 1 OR COALESCE(a.score, 0) = 0) AS zeroed_reviews
           FROM avaliacoes a
          WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)`,
        { periodDays }
      )
    ),
    safe("recentReviews", [], () =>
      query(
        `SELECT
            a.codigo AS public_id,
            a.score,
            a.status_feedback AS status,
            a.data_avaliacao AS created_at,
            av.name AS operator_name,
            c.nome AS wallet_name,
            f.nome AS form_name
           FROM avaliacoes a
           LEFT JOIN users av ON av.id = a.avaliado_id
           LEFT JOIN clientes c ON c.id = a.cliente_id
           LEFT JOIN formularios f ON f.id = a.formulario_id
          ORDER BY a.data_avaliacao DESC
          LIMIT 8`
      )
    ),
    safe("priorities", [], () =>
      query(
        `SELECT
            a.codigo AS public_id,
            a.score,
            a.status_feedback AS status,
            a.total_nao_conformes AS non_conformities,
            av.name AS operator_name,
            c.nome AS wallet_name
           FROM avaliacoes a
           LEFT JOIN users av ON av.id = a.avaliado_id
           LEFT JOIN clientes c ON c.id = a.cliente_id
          WHERE a.status_feedback = 'pendente'
             OR a.score < 80
             OR COALESCE(a.total_nao_conformes, 0) > 0
          ORDER BY a.score ASC, a.data_avaliacao DESC
          LIMIT 6`
      )
    ),
  ]);

  const kpis = kpisRows[0] || {};
  const clientes = clientesRows[0] || {};
  const status = statusRows[0] || {};

  return {
    ...empty,
    kpis: {
      averageScore: Number(kpis.average_score || 0),
      reviews: Number(kpis.reviews || 0),
      feedbackPending: Number(kpis.feedback_pending || 0),
      nonConformities: Number(kpis.non_conformities || 0),
      averageDurationSeconds: Number(kpis.average_duration_seconds || 0),
      activeClients: Number(clientes.active_clients || 0),
    },
    qualityByDay,
    clients,
    quadrants,
    offenders,
    status: {
      feedbackOpen: Number(status.feedback_open || 0),
      feedbackApplied: Number(status.feedback_applied || 0),
      contestations: Number(status.contestations || 0),
      zeroedReviews: Number(status.zeroed_reviews || 0),
    },
    recentReviews,
    priorities,
  };
}
