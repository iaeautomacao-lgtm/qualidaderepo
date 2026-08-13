import { query, one } from "../db";

/**
 * Agregados que alimentam os relatórios de IA.
 *
 * Todo número entregue ao modelo nasce aqui, em SQL. O modelo interpreta, não
 * calcula — ver `src/server/services/relatorios-ia.js`.
 *
 * Depende das tabelas de `database/migrations/002_dominio_qualitalk.sql`.
 */

// Só estes campos viram cláusula SQL. Chave desconhecida é ignorada: assim um
// query string inventado no navegador não consegue montar filtro nenhum.
const FILTROS_SQL = {
  clienteId: "a.cliente_id = :clienteId",
  campanhaId: "a.campanha_id = :campanhaId",
  avaliadoId: "a.avaliado_id = :avaliadoId",
  avaliadorId: "a.avaliador_id = :avaliadorId",
  categoria: "a.categoria = :categoria",
  dataInicio: "a.data_avaliacao >= :dataInicio",
  dataFim: "a.data_avaliacao <= :dataFim",
};

function montarFiltro(filtros) {
  const condicoes = [];
  const params = {};

  for (const [chave, fragmento] of Object.entries(FILTROS_SQL)) {
    const valor = filtros[chave];
    if (valor == null || valor === "" || valor === "todos") continue;
    condicoes.push(fragmento);
    params[chave] = valor;
  }

  return {
    where: condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "",
    params,
  };
}

export async function agregadosParaIa(filtros = {}) {
  const { where, params } = montarFiltro(filtros);

  const geral = await one(
    `SELECT
        COUNT(*) AS totalAvaliacoes,
        ROUND(AVG(a.score), 2) AS scoreMedio,
        SUM(a.zerada) AS totalZeradas,
        SUM(a.status_feedback = 'pendente') AS feedbacksPendentes,
        MIN(a.data_avaliacao) AS inicio,
        MAX(a.data_avaliacao) AS fim
       FROM avaliacoes a
       ${where}`,
    params
  );

  const total = Number(geral?.totalAvaliacoes ?? 0);
  if (total === 0) {
    return { totalAvaliacoes: 0, periodo: null };
  }

  // Ofensores: quantas avaliações reprovaram cada critério. O percentual usa o
  // total de avaliações do recorte, não o total de respostas — é assim que a
  // operação lê ("reprovou em 12% das chamadas").
  const ofensores = await query(
    `SELECT
        c.nome AS criterio,
        s.nome AS secao,
        c.eliminatoria,
        COUNT(*) AS reprovas,
        ROUND(COUNT(*) * 100 / :total, 1) AS percentualAvaliacoes
       FROM avaliacao_respostas r
       JOIN avaliacoes a ON a.id = r.avaliacao_id
       JOIN formulario_criterios c ON c.id = r.criterio_id
       JOIN formulario_secoes s ON s.id = c.secao_id
       ${where ? `${where} AND` : "WHERE"} r.status = 'nao_conforme'
      GROUP BY c.id, c.nome, s.nome, c.eliminatoria
      ORDER BY reprovas DESC
      LIMIT 15`,
    { ...params, total }
  );

  const porCampanha = await query(
    `SELECT
        COALESCE(ca.nome, 'Sem campanha') AS campanha,
        cl.nome AS cliente,
        COUNT(*) AS avaliacoes,
        ROUND(AVG(a.score), 2) AS scoreMedio,
        SUM(a.zerada) AS zeradas
       FROM avaliacoes a
       JOIN clientes cl ON cl.id = a.cliente_id
       LEFT JOIN campanhas ca ON ca.id = a.campanha_id
       ${where}
      GROUP BY ca.id, ca.nome, cl.nome
      ORDER BY avaliacoes DESC
      LIMIT 20`,
    params
  );

  // Corte em 5 avaliações: com menos que isso a média do operador é ruído, e
  // plano de coaching em cima de ruído gera conversa injusta.
  const porOperador = await query(
    `SELECT
        u.name AS operador,
        COUNT(*) AS avaliacoes,
        ROUND(AVG(a.score), 2) AS scoreMedio,
        SUM(a.zerada) AS zeradas,
        SUM(a.total_nao_conformes) AS naoConformes
       FROM avaliacoes a
       JOIN users u ON u.id = a.avaliado_id
       ${where}
      GROUP BY u.id, u.name
     HAVING avaliacoes >= 5
      ORDER BY scoreMedio ASC
      LIMIT 20`,
    params
  );

  const ncg = await query(
    `SELECT
        c.nome AS criterio,
        COUNT(*) AS falhas,
        COUNT(DISTINCT a.avaliado_id) AS operadoresEnvolvidos
       FROM avaliacao_respostas r
       JOIN avaliacoes a ON a.id = r.avaliacao_id
       JOIN formulario_criterios c ON c.id = r.criterio_id
       ${where ? `${where} AND` : "WHERE"} c.eliminatoria = 1
        AND r.status = 'nao_conforme'
      GROUP BY c.id, c.nome
      ORDER BY falhas DESC`,
    params
  );

  const zeradas = Number(geral.totalZeradas ?? 0);

  return {
    periodo: { inicio: geral.inicio, fim: geral.fim },
    totalAvaliacoes: total,
    scoreMedio: Number(geral.scoreMedio ?? 0),
    zeradas: {
      total: zeradas,
      percentual: Number(((zeradas * 100) / total).toFixed(1)),
    },
    feedbacksPendentes: Number(geral.feedbacksPendentes ?? 0),
    topOfensores: ofensores,
    porCampanha,
    porOperador,
    falhasEliminatorias: ncg,
  };
}
