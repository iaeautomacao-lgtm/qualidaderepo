import { paraLike, query } from "../db";
import { inteiro } from "../format";
import { MONITORES_IA_INICIAIS } from "../catalogo-inicial";

function vazio(limit, offset) {
  const itens = MONITORES_IA_INICIAIS.map((monitor) => ({
    ...monitor,
    avatar: null,
    status: "ativo",
    statusLabel: "Ativo",
    avaliacoes: 0,
    scoreMedio: 0,
    ultimaAvaliacao: null,
  }));

  return {
    kpis: {
      total: itens.length,
      ativos: itens.length,
      inativos: 0,
      emConfiguracao: 0,
      campanhasCobertas: new Set(itens.flatMap((item) => item.campanhasNomes.split(",").map((nome) => nome.trim()).filter(Boolean))).size,
    },
    paginacao: { limit, offset, total: itens.length },
    itens: itens.slice(offset, offset + limit),
  };
}

async function safe(fallback, work) {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

function slug(nome, id) {
  const base = String(nome || "monitor-ia")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "monitor-ia"}-${id}`;
}

export async function listarMonitoresIa({ busca = null, limit = 48, offset = 0 } = {}) {
  const params = { limit, offset };
  const filtros = ["a.origem = 'ia'"];

  if (busca) {
    filtros.push("(u.name LIKE :busca OR c.nome LIKE :busca OR ca.nome LIKE :busca)");
    params.busca = paraLike(busca);
  }

  const where = `WHERE ${filtros.join(" AND ")}`;

  const kpiRows = await safe([{ total: 0, campanhas_cobertas: 0 }], () =>
    query(
      `SELECT
          COUNT(DISTINCT avaliador_id) AS total,
          COUNT(DISTINCT campanha_id) AS campanhas_cobertas
         FROM avaliacoes
        WHERE origem = 'ia'`
    )
  );

  const totalRows = await safe([{ total: 0 }], () =>
    query(
      `SELECT COUNT(*) AS total
         FROM (
           SELECT a.avaliador_id
             FROM avaliacoes a
             LEFT JOIN users u ON u.id = a.avaliador_id
             LEFT JOIN clientes c ON c.id = a.cliente_id
             LEFT JOIN campanhas ca ON ca.id = a.campanha_id
            ${where}
            GROUP BY a.avaliador_id
         ) x`,
      params
    )
  );

  const rows = await safe([], () =>
    query(
      `SELECT
          COALESCE(u.id, a.avaliador_id) AS id,
          COALESCE(u.name, CONCAT('Monitor IA ', a.avaliador_id)) AS nome,
          COALESCE(u.active, 1) AS ativo,
          COUNT(DISTINCT a.id) AS avaliacoes,
          ROUND(COALESCE(AVG(a.score), 0), 1) AS score_medio,
          COUNT(DISTINCT a.campanha_id) AS campanhas,
          GROUP_CONCAT(DISTINCT c.nome ORDER BY c.nome SEPARATOR ', ') AS clientes,
          GROUP_CONCAT(DISTINCT ca.nome ORDER BY ca.nome SEPARATOR ', ') AS campanhas_nomes,
          MAX(a.data_avaliacao) AS ultima_avaliacao
         FROM avaliacoes a
         LEFT JOIN users u ON u.id = a.avaliador_id
         LEFT JOIN clientes c ON c.id = a.cliente_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
        ${where}
        GROUP BY COALESCE(u.id, a.avaliador_id), COALESCE(u.name, CONCAT('Monitor IA ', a.avaliador_id)), COALESCE(u.active, 1)
        ORDER BY ultima_avaliacao DESC, nome
        LIMIT :limit OFFSET :offset`,
      params
    )
  );

  const kpis = kpiRows[0] || {};
  const totalizadores = totalRows[0] || {};

  if (inteiro(kpis.total) === 0 && rows.length === 0) return vazio(limit, offset);

  return {
    kpis: {
      total: inteiro(kpis.total),
      ativos: inteiro(kpis.total),
      inativos: 0,
      emConfiguracao: 0,
      campanhasCobertas: inteiro(kpis.campanhas_cobertas),
    },
    paginacao: { limit, offset, total: inteiro(totalizadores.total) },
    itens: rows.map((row) => ({
      id: String(row.id),
      slug: slug(row.nome, row.id),
      nome: row.nome,
      avatar: null,
      status: row.ativo ? "ativo" : "inativo",
      statusLabel: row.ativo ? "Ativo" : "Inativo",
      cliente: row.clientes || "Sem cliente vinculado",
      campanhas: inteiro(row.campanhas),
      campanhasNomes: row.campanhas_nomes || "",
      avaliacoes: inteiro(row.avaliacoes),
      scoreMedio: Number(row.score_medio || 0),
      ultimaAvaliacao: row.ultima_avaliacao,
    })),
  };
}
