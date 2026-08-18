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

function numero(valor, fallback = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : fallback;
}

function parseJson(valor) {
  if (!valor) return null;
  try {
    const dados = JSON.parse(valor);
    return dados && typeof dados === "object" ? dados : null;
  } catch {
    return null;
  }
}

function dataCurta(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10);
}

function nomeQuadrante(score) {
  if (score >= 90) return "Excelência";
  if (score >= 80) return "Conforme";
  if (score >= 70) return "Atenção";
  return "Crítico";
}

function mergeContagem(lista, chave, valor = "value") {
  const mapa = new Map();
  for (const item of lista) {
    const nome = item?.[chave];
    if (!nome) continue;
    const atual = mapa.get(nome) || { ...item, [valor]: 0 };
    atual[valor] = numero(atual[valor]) + numero(item[valor]);
    mapa.set(nome, atual);
  }
  return [...mapa.values()];
}

function agregarAnalisesIa(rows = []) {
  const dias = new Map();
  const clientes = new Map();
  const quadrantes = new Map();
  const ofensores = new Map();
  const recentes = [];
  const prioridades = [];

  let reviews = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let durationSum = 0;
  let durationCount = 0;
  let nonConformities = 0;
  let zeroedReviews = 0;

  for (const row of rows) {
    const analise = parseJson(row.segmentos_json);
    if (!analise) continue;

    reviews += 1;
    const score = numero(analise.nota, NaN);
    const hasScore = Number.isFinite(score);
    if (hasScore) {
      scoreSum += score;
      scoreCount += 1;
      const quadrante = nomeQuadrante(score);
      quadrantes.set(quadrante, (quadrantes.get(quadrante) || 0) + 1);
    }

    const duracao = row.duracao_segundos == null ? null : numero(row.duracao_segundos, NaN);
    if (Number.isFinite(duracao)) {
      durationSum += duracao;
      durationCount += 1;
    }

    const resumo = analise.resumoConformidade || {};
    const falhas = numero(resumo.naoConformes);
    nonConformities += falhas;
    if (analise.zerada || score === 0) zeroedReviews += 1;

    const day = dataCurta(row.created_at);
    if (day) {
      const atual = dias.get(day) || { day, scoreSum: 0, scoreCount: 0, reviews: 0 };
      atual.reviews += 1;
      if (hasScore) {
        atual.scoreSum += score;
        atual.scoreCount += 1;
      }
      dias.set(day, atual);
    }

    const cliente = row.cliente || analise.carteira || "Sem carteira";
    const atualCliente = clientes.get(cliente) || { name: cliente, reviews: 0, scoreSum: 0, scoreCount: 0 };
    atualCliente.reviews += 1;
    if (hasScore) {
      atualCliente.scoreSum += score;
      atualCliente.scoreCount += 1;
    }
    clientes.set(cliente, atualCliente);

    for (const secao of Array.isArray(analise.secoes) ? analise.secoes : []) {
      for (const criterio of Array.isArray(secao?.criterios) ? secao.criterios : []) {
        const status = String(criterio?.status || "").toLowerCase();
        if (!["nao_conforme", "não conforme", "nao conforme"].includes(status)) continue;
        const nome = criterio.nome || criterio.titulo || "Critério sem nome";
        ofensores.set(nome, (ofensores.get(nome) || 0) + 1);
      }
    }

    const item = {
      public_id: analise.codigo || `MIA-${row.id}`,
      href: `/transcricoes/${row.id}`,
      score: hasScore ? score : 0,
      status: falhas > 0 ? "revisao" : "concluida",
      created_at: row.created_at,
      operator_name: "IA",
      wallet_name: cliente,
      form_name: analise.formulario || "Análise IA livre",
    };
    recentes.push(item);
    if (falhas > 0 || score < 80) {
      prioridades.push({
        ...item,
        non_conformities: falhas,
      });
    }
  }

  return {
    reviews,
    scoreSum,
    scoreCount,
    durationSum,
    durationCount,
    nonConformities,
    zeroedReviews,
    qualityByDay: [...dias.values()].map((dia) => ({
      day: dia.day,
      score: dia.scoreCount > 0 ? Math.round((dia.scoreSum / dia.scoreCount) * 10) / 10 : 0,
      reviews: dia.reviews,
    })),
    clients: [...clientes.values()].map((cliente) => ({
      name: cliente.name,
      reviews: cliente.reviews,
      score: cliente.scoreCount > 0 ? Math.round((cliente.scoreSum / cliente.scoreCount) * 10) / 10 : 0,
    })),
    quadrants: [...quadrantes.entries()].map(([label, value]) => ({ label, value })),
    offenders: [...ofensores.entries()]
      .map(([name, failures]) => ({ name, failures }))
      .sort((a, b) => b.failures - a.failures || a.name.localeCompare(b.name))
      .slice(0, 10),
    recentReviews: recentes.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8),
    priorities: prioridades.sort((a, b) => a.score - b.score).slice(0, 6),
  };
}

export async function getDashboardOverview({ period }) {
  const periodDays = period === "weekly" ? 7 : 31;
  const empty = emptyDashboard(period);

  const [
    kpisRows,
    clientesRows,
    qualityByDay,
    clients,
    quadrants,
    offenders,
    statusRows,
    recentReviews,
    priorities,
    iaRows,
  ] = await Promise.all([
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
            CONCAT('/avaliacoes/', a.codigo) AS href,
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
            CONCAT('/avaliacoes/', a.codigo) AS href,
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
    safe("iaRows", [], () =>
      query(
        `SELECT
            g.id,
            g.nome_arquivo,
            g.duracao_segundos,
            g.created_at,
            cl.nome AS cliente,
            ca.nome AS campanha,
            t.segmentos_json
           FROM gravacoes g
           JOIN transcricoes t
             ON t.id = (
                  SELECT MAX(t2.id)
                    FROM transcricoes t2
                   WHERE t2.gravacao_id = g.id
                )
           LEFT JOIN clientes cl ON cl.id = g.cliente_id
           LEFT JOIN campanhas ca ON ca.id = g.campanha_id
          WHERE g.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            AND t.status = 'concluida'
            AND t.segmentos_json IS NOT NULL
          ORDER BY g.created_at DESC
          LIMIT 500`,
        { periodDays }
      )
    ),
  ]);

  const kpis = kpisRows[0] || {};
  const clientes = clientesRows[0] || {};
  const status = statusRows[0] || {};
  const ia = agregarAnalisesIa(iaRows);
  const officialReviews = Number(kpis.reviews || 0);
  const totalReviews = officialReviews + ia.reviews;
  const totalScoreCount = officialReviews + ia.scoreCount;
  const officialScoreSum = Number(kpis.average_score || 0) * officialReviews;
  const totalDurationCount = officialReviews + ia.durationCount;
  const officialDurationSum = Number(kpis.average_duration_seconds || 0) * officialReviews;
  const mergedClients = mergeContagem([...clients, ...ia.clients], "name", "reviews")
    .map((cliente) => {
      const partes = [
        ...clients.filter((item) => item.name === cliente.name).map((item) => ({
          reviews: numero(item.reviews),
          score: numero(item.score),
        })),
        ...ia.clients.filter((item) => item.name === cliente.name).map((item) => ({
          reviews: numero(item.reviews),
          score: numero(item.score),
        })),
      ];
      const scorePeso = partes.reduce((soma, item) => soma + item.score * item.reviews, 0);
      const reviewsPeso = partes.reduce((soma, item) => soma + item.reviews, 0);
      return {
        ...cliente,
        score: reviewsPeso > 0 ? Math.round((scorePeso / reviewsPeso) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => numero(b.reviews) - numero(a.reviews) || numero(a.score) - numero(b.score))
    .slice(0, 8);
  const mergedDays = mergeContagem([...qualityByDay, ...ia.qualityByDay], "day", "reviews")
    .map((dia) => {
      const partes = [
        ...qualityByDay.filter((item) => item.day === dia.day),
        ...ia.qualityByDay.filter((item) => item.day === dia.day),
      ];
      const scorePeso = partes.reduce((soma, item) => soma + numero(item.score) * numero(item.reviews), 0);
      const reviewsPeso = partes.reduce((soma, item) => soma + numero(item.reviews), 0);
      return {
        ...dia,
        score: reviewsPeso > 0 ? Math.round((scorePeso / reviewsPeso) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const mergedQuadrants = mergeContagem([...quadrants, ...ia.quadrants], "label", "value");
  const mergedOffenders = mergeContagem([...offenders, ...ia.offenders], "name", "failures")
    .sort((a, b) => numero(b.failures) - numero(a.failures) || a.name.localeCompare(b.name))
    .slice(0, 10);

  return {
    ...empty,
    kpis: {
      averageScore:
        totalScoreCount > 0 ? Math.round(((officialScoreSum + ia.scoreSum) / totalScoreCount) * 10) / 10 : 0,
      reviews: totalReviews,
      feedbackPending: Number(kpis.feedback_pending || 0),
      nonConformities: Number(kpis.non_conformities || 0) + ia.nonConformities,
      averageDurationSeconds:
        totalDurationCount > 0 ? Math.round((officialDurationSum + ia.durationSum) / totalDurationCount) : 0,
      activeClients: Number(clientes.active_clients || 0),
    },
    qualityByDay: mergedDays,
    clients: mergedClients,
    quadrants: mergedQuadrants,
    offenders: mergedOffenders,
    status: {
      feedbackOpen: Number(status.feedback_open || 0),
      feedbackApplied: Number(status.feedback_applied || 0),
      contestations: Number(status.contestations || 0),
      zeroedReviews: Number(status.zeroed_reviews || 0) + ia.zeroedReviews,
    },
    recentReviews: [...ia.recentReviews, ...recentReviews]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8),
    priorities: [...ia.priorities, ...priorities].slice(0, 6),
  };
}
