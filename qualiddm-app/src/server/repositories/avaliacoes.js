import { notFound } from "../errors";
import { one, query } from "../db";
import {
  AVALIADORES_INICIAIS,
  AVALIADOS_INICIAIS,
  CAMPANHAS_INICIAIS,
  CATEGORIAS_INICIAIS,
  DEPARTAMENTOS_INICIAIS,
  OPERACOES_AVALIACAO_INICIAIS,
} from "../catalogo-inicial";
import {
  formatarCategoria,
  formatarDataHora,
  formatarDataIso,
  formatarDuracao,
  formatarHora,
  formatarScore,
} from "../format";

const STATUS_FEEDBACK = {
  pendente: "Feedback Pendente",
  aplicado: "Aplicado",
  dispensado: "Dispensado",
};

const STATUS_CRITERIO = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  nao_aplicavel: "Não Aplicável",
};

const RESPOSTA = {
  sim: "sim",
  nao: "não",
};

function pessoa(papel, nome, email) {
  return { papel, nome: nome || "N/A", email: email || "" };
}

async function colunasDaTabela(tabela) {
  try {
    const rows = await query(`SHOW COLUMNS FROM ${tabela}`);
    return new Set(rows.map((row) => row.Field));
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

function opcao(nome) {
  return { value: nome, label: nome };
}

async function listarOpcoesNomes(sql, fallback = []) {
  try {
    const rows = await query(sql);
    const opcoes = rows.map((row) => row.nome).filter(Boolean).map(opcao);
    return opcoes.length > 0 ? opcoes : fallback.map(opcao);
  } catch {
    return fallback.map(opcao);
  }
}

export async function listarOpcoesAvaliacoes() {
  const [operacoes, campanhas, avaliadores, avaliados, categorias, departamentos] = await Promise.all([
    listarOpcoesNomes("SELECT nome FROM clientes WHERE ativo = 1 ORDER BY nome", OPERACOES_AVALIACAO_INICIAIS.map((cliente) => cliente.nome)),
    listarOpcoesNomes("SELECT nome FROM campanhas WHERE ativa = 1 ORDER BY nome", CAMPANHAS_INICIAIS),
    listarOpcoesNomes(
      `SELECT name AS nome
         FROM users
        WHERE active = 1 AND role IN ('administrador', 'monitor', 'supervisor')
        ORDER BY name`,
      AVALIADORES_INICIAIS,
    ),
    listarOpcoesNomes(
      `SELECT name AS nome
         FROM users
        WHERE active = 1 AND role IN ('operador', 'monitor', 'supervisor')
        ORDER BY name`,
      AVALIADOS_INICIAIS,
    ),
    listarOpcoesNomes("SELECT nome FROM formulario_categorias WHERE ativo = 1 ORDER BY posicao, nome", CATEGORIAS_INICIAIS),
    listarOpcoesNomes("SELECT nome FROM cargos WHERE ativo = 1 ORDER BY nome", DEPARTAMENTOS_INICIAIS),
  ]);

  return {
    operacoes,
    campanhas,
    avaliadores,
    avaliados,
    categorias,
    departamentos,
  };
}

export async function listarAvaliacoes({ limit = 100, offset = 0 } = {}) {
  let colunas;
  try {
    colunas = await colunasDaTabela("avaliacoes");
  } catch {
    return [];
  }
  if (colunas === null) return [];

  const tem = (coluna) => colunas.has(coluna);
  const select = [
    "a.id AS db_id",
    tem("codigo") ? "a.codigo" : "CAST(a.id AS CHAR) AS codigo",
    tem("score") ? "a.score" : "0 AS score",
    tem("categoria") ? "a.categoria" : "'padrao' AS categoria",
    tem("status_feedback") ? "a.status_feedback" : "'pendente' AS status_feedback",
    tem("cod_gravacao") ? "a.cod_gravacao" : "NULL AS cod_gravacao",
    tem("duracao_segundos") ? "a.duracao_segundos" : "0 AS duracao_segundos",
    tem("data_contato") ? "a.data_contato" : "NULL AS data_contato",
    tem("data_avaliacao") ? "a.data_avaliacao" : "CURRENT_TIMESTAMP AS data_avaliacao",
    tem("total_criterios") ? "a.total_criterios" : "0 AS total_criterios",
    "cl.nome AS cliente",
    "ca.nome AS campanha",
    "f.nome AS formulario",
    "av.name AS avaliado",
    "mo.name AS avaliador",
    tem("supervisor_id") ? "su.name AS supervisor" : "NULL AS supervisor",
  ];

  const joins = [
    "JOIN clientes cl ON cl.id = a.cliente_id",
    tem("campanha_id") ? "LEFT JOIN campanhas ca ON ca.id = a.campanha_id" : "LEFT JOIN campanhas ca ON 1 = 0",
    "JOIN formularios f ON f.id = a.formulario_id",
    "JOIN users av ON av.id = a.avaliado_id",
    "JOIN users mo ON mo.id = a.avaliador_id",
    tem("supervisor_id") ? "LEFT JOIN users su ON su.id = a.supervisor_id" : "",
  ].filter(Boolean);

  const ordenacao = tem("data_avaliacao") ? "a.data_avaliacao" : "a.id";
  // Ficha excluída continua no banco (o relatório "Fichas Excluídas" precisa
  // dela), mas não aparece na listagem de monitorias.
  const filtro = tem("excluida_em") ? "WHERE a.excluida_em IS NULL" : "";

  let rows;
  try {
    rows = await query(
      `SELECT
          ${select.join(",\n        ")}
         FROM avaliacoes a
         ${joins.join("\n       ")}
        ${filtro}
        ORDER BY ${ordenacao} DESC
        LIMIT :limit OFFSET :offset`,
      { limit, offset },
    );
  } catch {
    return [];
  }

  return rows.map((row) => ({
    id: row.codigo,
    avaliado: row.avaliado,
    avaliador: row.avaliador,
    supervisor: row.supervisor || "N/A",
    campanha: row.campanha || "Sem campanha",
    departamento: row.cliente,
    categoria: formatarCategoria(row.categoria),
    score: formatarScore(row.score),
    data: formatarDataIso(row.data_avaliacao),
    hora: formatarHora(row.data_avaliacao),
    dataContato: formatarDataIso(row.data_contato),
    horaContato: formatarHora(row.data_contato),
    duracao: formatarDuracao(row.duracao_segundos),
    duracaoAudio: formatarDuracao(row.duracao_segundos),
    codGravacao: row.cod_gravacao || "N/A",
    campos: Number(row.total_criterios ?? 0),
    statusFeedback: STATUS_FEEDBACK[row.status_feedback] || row.status_feedback,
    formulario: row.formulario,
    cliente: row.cliente,
    dataFormatada: formatarDataHora(row.data_avaliacao),
  }));
}

export async function obterAvaliacao(codigo) {
  const ficha = await one(
    `SELECT
        a.id AS db_id, a.codigo, a.cod_gravacao, a.categoria, a.score,
        a.duracao_segundos, a.audio_path, a.data_contato, a.data_avaliacao,
        a.prazo_feedback, a.prazo_contestacao, a.status_feedback,
        a.total_conformes, a.total_nao_conformes, a.total_nao_aplicaveis,
        a.total_criterios,
        cl.nome AS cliente, ca.nome AS campanha, f.nome AS formulario,
        av.name AS avaliado_nome, av.email AS avaliado_email,
        mo.name AS avaliador_nome, mo.email AS avaliador_email,
        su.name AS supervisor_nome, su.email AS supervisor_email
       FROM avaliacoes a
       JOIN clientes cl ON cl.id = a.cliente_id
       LEFT JOIN campanhas ca ON ca.id = a.campanha_id
       JOIN formularios f ON f.id = a.formulario_id
       JOIN users av ON av.id = a.avaliado_id
       JOIN users mo ON mo.id = a.avaliador_id
       LEFT JOIN users su ON su.id = a.supervisor_id
      WHERE a.codigo = :codigo
      LIMIT 1`,
    { codigo },
  );

  if (!ficha) throw notFound("Avaliação não encontrada.");

  const [respostas, feedbacks, historico] = await Promise.all([
    query(
      `SELECT
          s.id AS secao_id, s.nome AS secao_nome, s.descricao AS secao_descricao, s.posicao AS secao_posicao,
          c.nome AS criterio_nome, c.enunciado, c.eliminatoria, c.posicao AS criterio_posicao,
          r.resposta, r.status, r.peso_aplicado, r.observacao_monitor
         FROM avaliacao_respostas r
         JOIN formulario_criterios c ON c.id = r.criterio_id
         JOIN formulario_secoes s ON s.id = c.secao_id
        WHERE r.avaliacao_id = :avaliacaoId
        ORDER BY s.posicao, c.posicao`,
      { avaliacaoId: ficha.db_id },
    ),
    query(
      `SELECT f.status, f.mensagem, f.prazo, f.aplicado_em, f.created_at, u.name AS autor
         FROM feedbacks f
         LEFT JOIN users u ON u.id = f.autor_id
        WHERE f.avaliacao_id = :avaliacaoId
        ORDER BY f.created_at DESC`,
      { avaliacaoId: ficha.db_id },
    ),
    query(
      `SELECT l.acao, l.entidade, l.entidade_id, l.detalhe, l.ip, l.created_at, u.name AS usuario
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.entidade_id IN (:codigo, :idTexto)
           OR (l.entidade = 'avaliacoes' AND l.entidade_id = :codigo)
        ORDER BY l.created_at DESC
        LIMIT 50`,
      { codigo, idTexto: String(ficha.db_id) },
    ),
  ]);

  const secoes = [];
  const porSecao = new Map();
  for (const row of respostas) {
    if (!porSecao.has(row.secao_id)) {
      const secao = {
        id: `secao-${row.secao_id}`,
        nome: row.secao_nome,
        descricao: row.secao_descricao,
        criterios: [],
      };
      porSecao.set(row.secao_id, secao);
      secoes.push(secao);
    }

    porSecao.get(row.secao_id).criterios.push({
      nome: row.criterio_nome,
      enunciado: row.enunciado,
      resposta: RESPOSTA[row.resposta] ?? row.resposta,
      status: STATUS_CRITERIO[row.status] || row.status,
      peso: row.peso_aplicado == null ? null : Number(row.peso_aplicado),
      eliminatoria: Boolean(row.eliminatoria),
      observacao: row.observacao_monitor,
    });
  }

  return {
    id: ficha.codigo,
    formulario: ficha.formulario,
    cliente: ficha.cliente,
    campanha: ficha.campanha || "Sem campanha",
    codGravacao: ficha.cod_gravacao || "N/A",
    score: formatarScore(ficha.score),
    duracao: formatarDuracao(ficha.duracao_segundos),
    duracaoAudio: formatarDuracao(ficha.duracao_segundos),
    categoria: formatarCategoria(ficha.categoria),
    statusFeedback: STATUS_FEEDBACK[ficha.status_feedback] || ficha.status_feedback,
    dataAvaliacao: formatarDataHora(ficha.data_avaliacao),
    dataContato: formatarDataHora(ficha.data_contato),
    prazoFeedback: formatarDataHora(ficha.prazo_feedback),
    prazoContestacao: formatarDataHora(ficha.prazo_contestacao),
    audioPath: ficha.audio_path,
    avaliado: pessoa("Avaliado", ficha.avaliado_nome, ficha.avaliado_email),
    avaliador: pessoa("Monitor", ficha.avaliador_nome, ficha.avaliador_email),
    supervisor: pessoa("Supervisor", ficha.supervisor_nome, ficha.supervisor_email),
    resumo: {
      conformes: Number(ficha.total_conformes ?? 0),
      naoConformes: Number(ficha.total_nao_conformes ?? 0),
      naoAplicaveis: Number(ficha.total_nao_aplicaveis ?? 0),
      total: Number(ficha.total_criterios ?? respostas.length),
    },
    secoes,
    feedbacks: feedbacks.map((item) => ({
      status: item.status,
      mensagem: item.mensagem,
      prazo: formatarDataHora(item.prazo),
      aplicadoEm: formatarDataHora(item.aplicado_em),
      criadoEm: formatarDataHora(item.created_at),
      autor: item.autor || "N/A",
    })),
    historico: historico.map((item) => ({
      acao: item.acao,
      entidade: item.entidade,
      detalhe: item.detalhe,
      usuario: item.usuario || "Sistema",
      ip: item.ip,
      criadoEm: formatarDataHora(item.created_at),
    })),
  };
}
