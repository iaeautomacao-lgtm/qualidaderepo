import { isMissingSchemaError, one, paraLike, query, transaction } from "../db";
import { conflict, notFound } from "../errors";
import { formatarDataHora, formatarDataIso, formatarHora, inteiro } from "../format";

// Os 5 cards da tela de Feedback particionam o total: na captura de
// 14/08/2026, Pendente 142 + Assinatura 134 + Finalizadas 218 + Revisão 0 =
// 494 = Todos. "Finalizadas" é a soma de Concluídas com Justificadas, e é por
// isso que o card mostra o detalhe "Concluídas: 201 · Justificadas: 17".
export const STATUS_FEEDBACK = [
  "pendente",
  "assinatura",
  "concluida",
  "justificada",
  "revisao",
  "dispensado",
];

// Agrupamentos que a tela oferece como filtro além dos status crus.
const GRUPOS_STATUS = {
  finalizadas: ["concluida", "justificada"],
};

export const FILTRO_STATUS = [...STATUS_FEEDBACK, ...Object.keys(GRUPOS_STATUS), "todos"];

const LABEL_STATUS = {
  pendente: "Feedback Pendente",
  assinatura: "Assinatura",
  concluida: "Concluída",
  justificada: "Justificada",
  revisao: "Revisão",
  dispensado: "Dispensado",
};

const ORDENACOES = {
  data_avaliacao: "a.data_avaliacao",
  data_contato: "a.data_contato",
  codigo: "a.codigo",
  cliente: "cl.nome",
  avaliador: "mo.name",
  status: "a.status_feedback",
};

// Monta o WHERE a partir de um conjunto FECHADO de filtros. Nenhum valor do
// usuário entra no texto do SQL: cada condição é um placeholder nomeado, e o
// nome vem daqui, não da query string.
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
  if (filtros.avaliadorId) {
    condicoes.push("a.avaliador_id = :avaliadorId");
    params.avaliadorId = filtros.avaliadorId;
  }
  if (filtros.avaliadoId) {
    condicoes.push("a.avaliado_id = :avaliadoId");
    params.avaliadoId = filtros.avaliadoId;
  }
  if (filtros.supervisorId) {
    condicoes.push("a.supervisor_id = :supervisorId");
    params.supervisorId = filtros.supervisorId;
  }
  if (filtros.dataInicio) {
    condicoes.push("a.data_avaliacao >= :dataInicio");
    params.dataInicio = `${filtros.dataInicio} 00:00:00`;
  }
  if (filtros.dataFim) {
    condicoes.push("a.data_avaliacao <= :dataFim");
    params.dataFim = `${filtros.dataFim} 23:59:59`;
  }
  if (filtros.busca) {
    condicoes.push("(a.codigo LIKE :busca OR a.cod_gravacao LIKE :busca)");
    params.busca = paraLike(filtros.busca);
  }

  return { where: condicoes.join("\n         AND "), params };
}

// Filtro de status aplicado só à LISTA. Os contadores dos cards precisam
// enxergar todos os status para poderem contar cada um deles.
function filtroStatus(status) {
  if (!status || status === "todos") return { clausula: "", params: {} };

  const grupo = GRUPOS_STATUS[status];
  if (grupo) {
    // Os nomes dos placeholders são gerados a partir do índice, e o grupo vem
    // de uma constante do módulo — nada aqui vem da requisição.
    const nomes = grupo.map((_, indice) => `:statusGrupo${indice}`);
    const params = {};
    grupo.forEach((valor, indice) => {
      params[`statusGrupo${indice}`] = valor;
    });
    return { clausula: `AND a.status_feedback IN (${nomes.join(", ")})`, params };
  }

  return { clausula: "AND a.status_feedback = :status", params: { status } };
}

function totalPorStatus(contadores, status, totalDoRecorte) {
  if (!status || status === "todos") return totalDoRecorte;
  if (status === "finalizadas") {
    return inteiro(contadores?.concluida) + inteiro(contadores?.justificada);
  }
  return inteiro(contadores?.[status]);
}

function montarItem(row) {
  return {
    id: row.codigo,
    avaliacaoId: String(row.db_id),
    feedbackId: row.feedback_id == null ? null : String(row.feedback_id),
    dataAvaliacao: formatarDataIso(row.data_avaliacao),
    horaAvaliacao: formatarHora(row.data_avaliacao),
    dataAvaliacaoFormatada: formatarDataHora(row.data_avaliacao),
    dataContato: formatarDataIso(row.data_contato),
    dataContatoFormatada: formatarDataHora(row.data_contato),
    status: row.status_feedback,
    statusLabel: LABEL_STATUS[row.status_feedback] || row.status_feedback,
    superior: row.superior || "N/A",
    avaliador: row.avaliador,
    avaliado: row.avaliado,
    cliente: row.cliente,
    campanha: row.campanha || "Sem campanha",
    formulario: row.formulario,
    codGravacao: row.cod_gravacao || "N/A",
    score: row.score == null ? null : Number(row.score),
    prazo: formatarDataIso(row.feedback_prazo || row.prazo_feedback),
    aplicadoEm: formatarDataHora(row.aplicado_em),
    assinadoEm: formatarDataHora(row.assinado_em),
    justificativaMotivo: row.justificativa_motivo || null,
  };
}

function vazio(limit, offset) {
  return {
    contadores: {
      pendente: 0,
      assinatura: 0,
      finalizadas: 0,
      concluidas: 0,
      justificadas: 0,
      revisao: 0,
      dispensado: 0,
      todos: 0,
    },
    paginacao: { limit, offset, total: 0 },
    itens: [],
  };
}

/**
 * Lista os feedbacks e os contadores dos cards.
 *
 * Os contadores saem de UMA query agregada sobre o mesmo recorte de filtros da
 * lista — não de cinco consultas. Como essa query já devolve o total do
 * recorte, ela também serve de COUNT para a paginação: nenhum round-trip
 * extra.
 */
export async function listarFeedbacks({
  filtros = {},
  limit = 50,
  offset = 0,
  ordenarPor,
  ordem,
} = {}) {
  const { where, params } = montarFiltros(filtros);
  const status = filtroStatus(filtros.status);

  const colunaOrdenacao = ORDENACOES[ordenarPor] || ORDENACOES.data_avaliacao;
  const direcao = ordem === "asc" ? "ASC" : "DESC";

  try {
    const contadores = await one(
      `SELECT
          COUNT(*) AS todos,
          SUM(a.status_feedback = 'pendente')    AS pendente,
          SUM(a.status_feedback = 'assinatura')  AS assinatura,
          SUM(a.status_feedback = 'concluida')   AS concluida,
          SUM(a.status_feedback = 'justificada') AS justificada,
          SUM(a.status_feedback = 'revisao')     AS revisao,
          SUM(a.status_feedback = 'dispensado')  AS dispensado
         FROM avaliacoes a
        WHERE ${where}`,
      params,
    );

    const concluida = inteiro(contadores?.concluida);
    const justificada = inteiro(contadores?.justificada);
    const totalDoRecorte = inteiro(contadores?.todos);

    const rows = await query(
      `SELECT
          a.id AS db_id,
          a.codigo,
          a.cod_gravacao,
          a.data_avaliacao,
          a.data_contato,
          a.status_feedback,
          a.score,
          a.prazo_feedback,
          cl.nome AS cliente,
          ca.nome AS campanha,
          f.nome  AS formulario,
          av.name AS avaliado,
          mo.name AS avaliador,
          su.name AS superior,
          fb.id    AS feedback_id,
          fb.prazo AS feedback_prazo,
          fb.aplicado_em,
          fb.assinado_em,
          jm.nome AS justificativa_motivo
         FROM avaliacoes a
         JOIN clientes cl ON cl.id = a.cliente_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
         JOIN formularios f ON f.id = a.formulario_id
         JOIN users av ON av.id = a.avaliado_id
         JOIN users mo ON mo.id = a.avaliador_id
         LEFT JOIN users su ON su.id = a.supervisor_id
         LEFT JOIN feedbacks fb ON fb.avaliacao_id = a.id
         LEFT JOIN justificativa_motivos jm ON jm.id = fb.justificativa_motivo_id
        WHERE ${where}
          ${status.clausula}
        ORDER BY ${colunaOrdenacao} ${direcao}, a.id DESC
        LIMIT :limit OFFSET :offset`,
      { ...params, ...status.params, limit, offset },
    );

    return {
      contadores: {
        pendente: inteiro(contadores?.pendente),
        assinatura: inteiro(contadores?.assinatura),
        finalizadas: concluida + justificada,
        concluidas: concluida,
        justificadas: justificada,
        revisao: inteiro(contadores?.revisao),
        dispensado: inteiro(contadores?.dispensado),
        todos: totalDoRecorte,
      },
      // `total` é o total do recorte com o filtro de status aplicado — é o
      // número que a paginação da tabela precisa. `contadores.todos` é o
      // total sem filtro de status, que é o que o card "Todos" mostra.
      paginacao: {
        limit,
        offset,
        total: totalPorStatus(contadores, filtros.status, totalDoRecorte),
      },
      itens: rows.map(montarItem),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return vazio(limit, offset);
    return vazio(limit, offset);
  }
}

export const TIPOS_FEEDBACK = ["elogio", "orientacao", "alerta"];
export const ACOES_FEEDBACK = ["aplicar", "justificar"];

// Mínimo que o print da ficha cobra no contador "0 / 20 caracteres". Fica aqui,
// junto da escrita, para a rota e a validação usarem o mesmo número.
export const MIN_CARACTERES_MENSAGEM = 20;

const STATUS_POR_ACAO = { aplicar: "concluida", justificar: "justificada" };

/**
 * Registra o feedback global de uma avaliação e move o status da ficha.
 *
 * Uma transação só: gravar o feedback sem mover `avaliacoes.status_feedback`
 * deixaria a tela de Feedback contando a ficha como pendente para sempre, e o
 * contrário mostraria ficha concluída sem texto nenhum.
 *
 * UPSERT porque `feedbacks` tem UNIQUE por avaliação — reenviar o formulário
 * corrige o texto em vez de estourar ER_DUP_ENTRY.
 */
export async function registrarFeedbackAvaliacao({ codigo, tipo, mensagem, acao, autorId }) {
  const status = STATUS_POR_ACAO[acao];
  if (!status) throw notFound("Ação de feedback desconhecida.");

  return transaction(async (connection) => {
    const [fichas] = await connection.execute(
      `SELECT id, status_feedback
         FROM avaliacoes
        WHERE codigo = :codigo
          AND excluida_em IS NULL
        LIMIT 1`,
      { codigo },
    );

    if (fichas.length === 0) throw notFound("Avaliação não encontrada.");
    const avaliacaoId = fichas[0].id;
    const statusAnterior = fichas[0].status_feedback;

    // `tipo` só entra no INSERT se a migration 004 já rodou: num banco sem a
    // coluna o feedback ainda tem de ser gravado.
    const [colunas] = await connection.execute("SHOW COLUMNS FROM feedbacks LIKE 'tipo'");
    const temTipo = colunas.length > 0;

    await connection.execute(
      `INSERT INTO feedbacks (avaliacao_id, autor_id, aplicado_por_id, status, mensagem, aplicado_em
                              ${temTipo ? ", tipo" : ""})
       VALUES (:avaliacaoId, :autorId, :autorId, :status, :mensagem,
               ${acao === "aplicar" ? "CURRENT_TIMESTAMP" : "NULL"}
               ${temTipo ? ", :tipo" : ""})
       ON DUPLICATE KEY UPDATE
         autor_id = VALUES(autor_id),
         aplicado_por_id = VALUES(aplicado_por_id),
         status = VALUES(status),
         mensagem = VALUES(mensagem),
         aplicado_em = VALUES(aplicado_em)
         ${temTipo ? ", tipo = VALUES(tipo)" : ""}`,
      temTipo
        ? { avaliacaoId, autorId, status, mensagem, tipo }
        : { avaliacaoId, autorId, status, mensagem },
    );

    await connection.execute(
      `UPDATE avaliacoes
          SET status_feedback = :status
        WHERE id = :avaliacaoId`,
      { avaliacaoId, status },
    );

    return { avaliacaoId: String(avaliacaoId), status, statusAnterior };
  });
}

// Cores e prazos que a tela usa nos badges. Vêm do banco porque a tela
// "Configurações de Feedbacks" edita isso em produção.
export async function listarConfiguracoesStatus() {
  try {
    const rows = await query(
      `SELECT status, label, prazo_dias, cor_hex, cor_texto_hex, posicao
         FROM feedback_status_configuracoes
        WHERE ativo = 1
        ORDER BY posicao`,
    );

    return rows.map((row) => ({
      status: row.status,
      label: row.label,
      prazoDias: row.prazo_dias == null ? null : inteiro(row.prazo_dias),
      cor: row.cor_hex,
      corTexto: row.cor_texto_hex,
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    return [];
  }
}

/* ==========================================================================
   Abas "Edições" e "Histórico" da tela compacta de feedback
   ========================================================================== */

// Mínimo do comentário de histórico. Menor que o do feedback formal (20) de
// propósito: "operador ciente" é um comentário legítimo, e cobrar 20 caracteres
// aí só ensinaria a encher linguiça.
export const MIN_CARACTERES_COMENTARIO = 5;

/**
 * Aba "Edições": o que foi alterado nesta monitoria depois de lançada.
 *
 * Lê `avaliacao_edicoes` — a mesma tabela do relatório "Monitorias editadas".
 * Uma linha por campo alterado, com valor anterior e novo, que é o que responde
 * a pergunta da supervisão: "o que mudou e por quê".
 */
export async function listarEdicoesDaAvaliacao(codigo) {
  try {
    const rows = await query(
      `SELECT e.campo, e.valor_anterior, e.valor_novo, e.motivo,
              e.created_at, u.name AS editado_por
         FROM avaliacao_edicoes e
         JOIN avaliacoes a ON a.id = e.avaliacao_id
         LEFT JOIN users u ON u.id = e.editado_por_id
        WHERE a.codigo = :codigo
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 50`,
      { codigo },
    );

    return rows.map((row) => ({
      campo: row.campo,
      valorAnterior: row.valor_anterior,
      valorNovo: row.valor_novo,
      motivo: row.motivo || null,
      // Usuário desligado sai do JOIN com nome nulo. "Usuário removido" e não
      // "N/A": a edição aconteceu e alguém a fez.
      editadoPor: row.editado_por || "Usuário removido",
      editadoEm: formatarDataHora(row.created_at),
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    return [];
  }
}

/**
 * Aba "Histórico": comentários do supervisor sobre a monitoria.
 *
 * `suportado: false` quando a migration 006 ainda não rodou — a tela explica a
 * ausência e desabilita a caixa em vez de mostrar um histórico vazio que
 * pareceria "ninguém comentou nada".
 */
export async function listarComentariosDaAvaliacao(codigo) {
  try {
    const rows = await query(
      `SELECT fc.comentario, fc.created_at, u.name AS autor, u.role AS papel
         FROM feedback_comentarios fc
         JOIN avaliacoes a ON a.id = fc.avaliacao_id
         LEFT JOIN users u ON u.id = fc.autor_id
        WHERE a.codigo = :codigo
        ORDER BY fc.created_at DESC, fc.id DESC
        LIMIT 100`,
      { codigo },
    );

    return {
      suportado: true,
      itens: rows.map((row) => ({
        comentario: row.comentario,
        autor: row.autor || "Usuário removido",
        papel: row.papel || null,
        criadoEm: formatarDataHora(row.created_at),
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return { suportado: false, itens: [] };
    throw error;
  }
}

/**
 * Registra um comentário no histórico.
 *
 * Sem UPDATE nem DELETE: histórico de comentário não se reescreve — corrigir é
 * comentar de novo. Assim quem lê depois vê a conversa como ela aconteceu.
 */
export async function adicionarComentario({ codigo, autorId, comentario }) {
  const ficha = await one(
    `SELECT id FROM avaliacoes WHERE codigo = :codigo AND excluida_em IS NULL LIMIT 1`,
    { codigo },
  );

  if (!ficha) throw notFound("Avaliação não encontrada.");

  try {
    await query(
      `INSERT INTO feedback_comentarios (avaliacao_id, autor_id, comentario)
       VALUES (:avaliacaoId, :autorId, :comentario)`,
      { avaliacaoId: ficha.id, autorId, comentario },
    );
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw conflict(
        "O histórico de comentários ainda não está disponível neste banco. Rode a migration 006_feedback_comentarios_e_motivo_contestacao.sql.",
      );
    }
    throw error;
  }

  return listarComentariosDaAvaliacao(codigo);
}
