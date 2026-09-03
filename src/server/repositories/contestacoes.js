import { isMissingSchemaError, one, paraLike, query, transaction } from "../db";
import { badRequest, conflict, notFound } from "../errors";
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
  // `motivo` por item só existe depois da migration 006. Sem a coluna o motivo
  // de cada item vive no `motivo` do pedido, que já vem no cabeçalho.
  const temMotivoItem = await temColuna("contestacao_itens", "motivo");

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
                ${temMotivoItem ? "ci.motivo" : "NULL AS motivo"},
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
        motivo: item.motivo || null,
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

/* ==========================================================================
   Avaliações candidatas, abertura e julgamento
   ========================================================================== */

/**
 * Motivos do select "Motivo da Contestação".
 *
 * Lista FECHADA e no servidor: é ele que valida. Motivo digitado à mão daria um
 * campo livre impossível de agrupar depois — e a pergunta que a supervisão faz
 * ao fim do mês é exatamente "por que estão contestando", que só se responde
 * agrupando.
 */
export const MOTIVOS_CONTESTACAO = [
  "Evidência insuficiente",
  "Critério não aplicável ao contato",
  "Interpretação incorreta do diálogo",
  "Peso ou pontuação aplicados de forma errada",
  "Erro na transcrição",
  "Regra da campanha não prevê o apontamento",
  "Outro motivo",
];

export const RESULTADOS_ITEM = ["deferido", "indeferido"];

// Contador "Justificativa (mín. 20 caracteres)" do print. Vale no servidor
// porque validação no navegador é conveniência, não regra.
export const MIN_CARACTERES_JUSTIFICATIVA = 20;

// Usado quando a campanha não tem linha em `sla_contestacoes`. É o mesmo default
// da coluna `prazo_julgamento_dias`, repetido aqui porque a conta do prazo
// acontece na aplicação e precisa de um número mesmo sem configuração.
const PRAZO_JULGAMENTO_PADRAO_DIAS = 5;

// Status de ficha que ainda admitem contestação: depois de concluída ou
// justificada o ciclo fechou, e reabrir é outro fluxo.
const STATUS_CONTESTAVEIS = ["pendente", "assinatura", "revisao"];

// Rótulo do status de feedback na linha da candidata. Duplica o mapa do
// repositório de feedbacks de propósito: importar de lá acoplaria os dois
// módulos por uma constante de texto.
const LABEL_STATUS_FICHA = {
  pendente: "Feedback Pendente",
  assinatura: "Assinatura",
  concluida: "Concluída",
  justificada: "Justificada",
  revisao: "Revisão",
  dispensado: "Dispensado",
};

const cacheColunas = new Map();

/**
 * Existe a coluna? Memoizado por processo.
 *
 * Mesma convenção do resto do backend: a tela abre num banco atrasado, só sem o
 * campo novo. Nome de tabela e coluna vêm de literais deste módulo — nada da
 * requisição entra no texto do SQL.
 */
async function temColuna(tabela, coluna) {
  const chave = `${tabela}.${coluna}`;
  if (!cacheColunas.has(chave)) {
    cacheColunas.set(
      chave,
      query(`SHOW COLUMNS FROM ${tabela} LIKE :coluna`, { coluna })
        .then((rows) => rows.length > 0)
        .catch(() => false),
    );
  }
  return cacheColunas.get(chave);
}

/**
 * WHERE da tela "Avaliações Candidatas".
 *
 * Separado de `montarFiltros` porque ali o período filtra a data de ABERTURA da
 * contestação, e aqui o campo do print é "Período de Avaliação" — mesma caixa,
 * coluna diferente. Reaproveitar o outro faria o filtro mentir.
 */
function montarFiltrosAvaliacao(filtros = {}) {
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
    condicoes.push("a.data_avaliacao >= :dataInicio");
    params.dataInicio = `${filtros.dataInicio} 00:00:00`;
  }
  if (filtros.dataFim) {
    condicoes.push("a.data_avaliacao <= :dataFim");
    params.dataFim = `${filtros.dataFim} 23:59:59`;
  }
  if (filtros.codigo) {
    condicoes.push("a.codigo LIKE :codigo");
    params.codigo = paraLike(filtros.codigo);
  }
  if (filtros.busca) {
    condicoes.push("(f.nome LIKE :busca OR av.name LIKE :busca OR mo.name LIKE :busca)");
    params.busca = paraLike(filtros.busca);
  }

  return { where: condicoes.join("\n         AND "), params };
}

/**
 * Os cinco cards da faixa superior.
 *
 * Eles PARTICIONAM o total — a soma dos quatro seguintes é "Total de
 * Contestações", e é por isso que "Deliberadas" existe:
 *
 *   Aguardando Revisão = pendente + em_analise  (ainda sem decisão)
 *   Procedentes        = julgada, resultado deferida
 *   Improcedentes      = julgada, resultado indeferida
 *   Deliberadas        = o resto já decidido: resultado parcial, julgada sem
 *                        resultado registrado, e cancelada
 *
 * Sem a última faixa, contestação parcial ou cancelada desapareceria da conta e
 * os cards não fechariam com o total — que é o primeiro número que a supervisão
 * confere.
 */
export async function indicadoresContestacoes(filtros = {}) {
  const { where, params } = montarFiltros(filtros);

  const vazios = { total: 0, aguardando: 0, procedentes: 0, improcedentes: 0, deliberadas: 0 };

  try {
    const linha = await one(
      `SELECT
          COUNT(*) AS total,
          SUM(c.status IN ('pendente', 'em_analise'))              AS aguardando,
          SUM(c.status = 'julgada' AND c.resultado = 'deferida')   AS procedentes,
          SUM(c.status = 'julgada' AND c.resultado = 'indeferida') AS improcedentes,
          SUM(
            c.status = 'cancelada'
            OR (c.status = 'julgada' AND (c.resultado IS NULL OR c.resultado = 'parcial'))
          ) AS deliberadas
         FROM contestacoes c
         ${JOINS}
        WHERE ${where}`,
      params,
    );

    return {
      total: inteiro(linha?.total),
      aguardando: inteiro(linha?.aguardando),
      procedentes: inteiro(linha?.procedentes),
      improcedentes: inteiro(linha?.improcedentes),
      deliberadas: inteiro(linha?.deliberadas),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return vazios;
    return vazios;
  }
}

/**
 * Tela "Avaliações Candidatas": as monitorias que ainda podem ser contestadas.
 *
 * O subtítulo do print define o recorte — "avaliações com não conformidade e
 * status Feedback Pendente". Duas escolhas dentro disso:
 *
 * 1. `zerada` entra no OU do filtro de não conformidade. Ficha zerada por
 *    eliminatório é o caso MAIS contestado que existe, e o contador de não
 *    conformes dela não é necessariamente maior que zero.
 *
 * 2. O filtro de não conformidade é desligável (`somenteNaoConformes: false`).
 *    Num banco onde os contadores não foram preenchidos, forçá-lo deixaria a
 *    tela vazia parecendo defeito; a tela oferece a saída no estado vazio.
 */
export async function listarCandidatas({ filtros = {}, limit = 50, offset = 0 } = {}) {
  const { where, params } = montarFiltrosAvaliacao(filtros);
  const temZerada = await temColuna("avaliacoes", "zerada");

  const condicoes = [where, "a.status_feedback IN ('pendente', 'assinatura', 'revisao')"];
  if (filtros.somenteNaoConformes !== false) {
    condicoes.push(
      temZerada ? "(a.total_nao_conformes > 0 OR a.zerada = 1)" : "a.total_nao_conformes > 0",
    );
  }
  const filtro = condicoes.join("\n         AND ");

  const vazio = { paginacao: { limit, offset, total: 0 }, itens: [] };

  const de = `
         FROM avaliacoes a
         JOIN formularios f ON f.id = a.formulario_id
         JOIN clientes cl ON cl.id = a.cliente_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
         JOIN users av ON av.id = a.avaliado_id
         JOIN users mo ON mo.id = a.avaliador_id`;

  try {
    const [total, rows] = await Promise.all([
      one(`SELECT COUNT(*) AS total ${de} WHERE ${filtro}`, params),
      query(
        `SELECT
            a.id AS db_id,
            a.codigo,
            a.score,
            a.total_nao_conformes,
            a.data_avaliacao,
            a.status_feedback,
            a.prazo_contestacao,
            ${temZerada ? "a.zerada" : "0 AS zerada"},
            f.nome  AS formulario,
            cl.nome AS cliente,
            ca.nome AS campanha,
            av.name AS avaliado,
            mo.name AS avaliador,
            (SELECT COUNT(*) FROM contestacoes c WHERE c.avaliacao_id = a.id) AS contestacoes
          ${de}
          WHERE ${filtro}
          ORDER BY a.data_avaliacao DESC, a.id DESC
          LIMIT :limit OFFSET :offset`,
        { ...params, limit, offset },
      ),
    ]);

    return {
      paginacao: { limit, offset, total: inteiro(total?.total) },
      itens: rows.map((row) => ({
        id: row.codigo,
        avaliacaoId: String(row.db_id),
        formulario: row.formulario,
        cliente: row.cliente,
        campanha: row.campanha || "Sem campanha",
        avaliado: row.avaliado,
        avaliador: row.avaliador,
        score: row.score == null ? null : Number(row.score),
        naoConformes: inteiro(row.total_nao_conformes),
        zerada: Boolean(Number(row.zerada ?? 0)),
        status: row.status_feedback,
        statusLabel: LABEL_STATUS_FICHA[row.status_feedback] || row.status_feedback,
        data: formatarDataIso(row.data_avaliacao),
        dataFormatada: formatarDataHora(row.data_avaliacao),
        prazoContestacao: formatarDataIso(row.prazo_contestacao),
        // Já tem pedido aberto? A tela mostra "Ver contestação" em vez de
        // "Contestar": abrir um segundo pedido para os mesmos itens seria
        // recusado no servidor, e é melhor não oferecer o caminho.
        contestacoes: inteiro(row.contestacoes),
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return vazio;
    return vazio;
  }
}

/**
 * Itens contestáveis de uma avaliação: as respostas NÃO CONFORMES, agrupadas
 * por seção, com o peso e a observação do monitor que a tela mostra em cada uma.
 *
 * Só não conformes: contestar critério conforme não faz sentido — não há
 * apontamento para derrubar.
 */
export async function itensContestaveis(codigo) {
  const ficha = await one(
    `SELECT a.id, a.codigo, a.score, a.cod_gravacao, a.data_avaliacao,
            a.status_feedback, a.prazo_contestacao,
            f.nome AS formulario, cl.nome AS cliente, ca.nome AS campanha,
            av.name AS avaliado, mo.name AS avaliador
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

  if (!ficha) throw notFound("Avaliação não encontrada.");

  const avaliacao = {
    id: ficha.codigo,
    formulario: ficha.formulario,
    cliente: ficha.cliente,
    campanha: ficha.campanha || "Sem campanha",
    avaliado: ficha.avaliado,
    avaliador: ficha.avaliador,
    codGravacao: ficha.cod_gravacao || "N/A",
    score: ficha.score == null ? null : Number(ficha.score),
    status: ficha.status_feedback,
    statusLabel: LABEL_STATUS_FICHA[ficha.status_feedback] || ficha.status_feedback,
    data: formatarDataIso(ficha.data_avaliacao),
    dataFormatada: formatarDataHora(ficha.data_avaliacao),
    prazoContestacao: formatarDataIso(ficha.prazo_contestacao),
    contestavel: STATUS_CONTESTAVEIS.includes(ficha.status_feedback),
  };

  const base = {
    avaliacao,
    secoes: [],
    total: 0,
    disponiveis: 0,
    motivos: MOTIVOS_CONTESTACAO,
    minCaracteres: MIN_CARACTERES_JUSTIFICATIVA,
  };

  try {
    const [respostas, contestados] = await Promise.all([
      query(
        `SELECT r.id AS resposta_id, r.status, r.observacao_monitor, r.peso_aplicado,
                cr.nome AS criterio, cr.enunciado, cr.peso_pts, cr.eliminatoria,
                s.id AS secao_id, s.nome AS secao, s.posicao AS secao_posicao,
                cr.posicao
           FROM avaliacao_respostas r
           JOIN formulario_criterios cr ON cr.id = r.criterio_id
           JOIN formulario_secoes s ON s.id = cr.secao_id
          WHERE r.avaliacao_id = :avaliacaoId
            AND r.status = 'nao_conforme'
          ORDER BY s.posicao, cr.posicao`,
        { avaliacaoId: ficha.id },
      ),
      query(
        `SELECT ci.avaliacao_resposta_id, c.status
           FROM contestacao_itens ci
           JOIN contestacoes c ON c.id = ci.contestacao_id
          WHERE c.avaliacao_id = :avaliacaoId
            AND c.status <> 'cancelada'`,
        { avaliacaoId: ficha.id },
      ),
    ]);

    const jaContestado = new Map(
      contestados.map((row) => [String(row.avaliacao_resposta_id), row.status]),
    );

    const secoes = [];
    const porSecao = new Map();

    for (const row of respostas) {
      if (!porSecao.has(row.secao_id)) {
        const secao = { id: `secao-${row.secao_id}`, nome: row.secao, itens: [] };
        porSecao.set(row.secao_id, secao);
        secoes.push(secao);
      }

      const status = jaContestado.get(String(row.resposta_id)) ?? null;
      const peso = row.peso_pts == null ? null : Number(row.peso_pts);

      porSecao.get(row.secao_id).itens.push({
        respostaId: String(row.resposta_id),
        criterio: row.criterio,
        enunciado: row.enunciado,
        eliminatoria: Boolean(row.eliminatoria),
        peso,
        // "Pontuação: 0/3" do print: obtido sobre o peso de cadastro.
        pontuacaoObtida: row.peso_aplicado == null ? 0 : Number(row.peso_aplicado),
        pontuacaoTotal: peso,
        observacao: row.observacao_monitor || null,
        contestadoStatus: status,
        contestadoLabel: status ? LABEL_STATUS[status] || status : null,
      });
    }

    return {
      ...base,
      secoes,
      total: respostas.length,
      disponiveis: respostas.length - jaContestado.size,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return base;
    throw error;
  }
}

/** Prazo de julgamento da campanha, ou o default da aplicação. */
async function prazoJulgamentoDias(connection, campanhaId) {
  if (!campanhaId) return PRAZO_JULGAMENTO_PADRAO_DIAS;

  try {
    const [rows] = await connection.execute(
      `SELECT prazo_julgamento_dias
         FROM sla_contestacoes
        WHERE campanha_id = :campanhaId
          AND ativo = 1
        LIMIT 1`,
      { campanhaId },
    );
    if (rows.length === 0) return PRAZO_JULGAMENTO_PADRAO_DIAS;
    return inteiro(rows[0].prazo_julgamento_dias, PRAZO_JULGAMENTO_PADRAO_DIAS);
  } catch (error) {
    // Banco sem `sla_contestacoes` não pode impedir a abertura do pedido.
    if (isMissingSchemaError(error)) return PRAZO_JULGAMENTO_PADRAO_DIAS;
    throw error;
  }
}

/**
 * Abre UM pedido de contestação com N itens.
 *
 * Um pedido e não N: o julgamento é por item, mas quem abre abre uma vez — e o
 * ADM precisa ver "esta avaliação tem 1 contestação com 3 itens", que é a coluna
 * "Itens Contestados" da Gestão ADM.
 *
 * Tudo em uma transação: pedido gravado sem itens seria um pedido vazio na fila
 * do ADM, sem como saber o que se questiona.
 */
export async function abrirContestacao({ codigo, itens, abertoPorId }) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw badRequest("Marque ao menos um item para contestar.");
  }

  const temMotivoItem = await temColuna("contestacao_itens", "motivo");

  return transaction(async (connection) => {
    const [fichas] = await connection.execute(
      `SELECT id, campanha_id, score, status_feedback
         FROM avaliacoes
        WHERE codigo = :codigo
          AND excluida_em IS NULL
        LIMIT 1`,
      { codigo },
    );

    if (fichas.length === 0) throw notFound("Avaliação não encontrada.");
    const ficha = fichas[0];

    if (!STATUS_CONTESTAVEIS.includes(ficha.status_feedback)) {
      throw conflict(
        "Esta monitoria já foi finalizada e não aceita mais contestação. Peça a reabertura ao administrador.",
      );
    }

    // As respostas precisam ser DESTA avaliação e estar não conformes. Sem a
    // checagem, um id de resposta de outra ficha entraria pelo corpo do POST.
    const nomes = itens.map((_, indice) => `:resposta${indice}`);
    const paramsRespostas = {};
    itens.forEach((item, indice) => {
      paramsRespostas[`resposta${indice}`] = item.respostaId;
    });

    const [respostas] = await connection.execute(
      `SELECT r.id, r.status, cr.nome AS criterio
         FROM avaliacao_respostas r
         JOIN formulario_criterios cr ON cr.id = r.criterio_id
        WHERE r.avaliacao_id = :avaliacaoId
          AND r.id IN (${nomes.join(", ")})`,
      { avaliacaoId: ficha.id, ...paramsRespostas },
    );

    if (respostas.length !== itens.length) {
      throw badRequest("Um dos itens marcados não pertence a esta avaliação.");
    }

    const naoConforme = respostas.filter((row) => row.status !== "nao_conforme");
    if (naoConforme.length > 0) {
      throw badRequest(
        `Só critério não conforme pode ser contestado. Reveja: ${naoConforme
          .map((row) => row.criterio)
          .join(", ")}.`,
      );
    }

    // Item já contestado em pedido vivo: recusa nominal, para quem abriu saber
    // qual critério retirar da marcação.
    const [duplicados] = await connection.execute(
      `SELECT cr.nome AS criterio
         FROM contestacao_itens ci
         JOIN contestacoes c ON c.id = ci.contestacao_id
         JOIN avaliacao_respostas r ON r.id = ci.avaliacao_resposta_id
         JOIN formulario_criterios cr ON cr.id = r.criterio_id
        WHERE c.avaliacao_id = :avaliacaoId
          AND c.status <> 'cancelada'
          AND ci.avaliacao_resposta_id IN (${nomes.join(", ")})`,
      { avaliacaoId: ficha.id, ...paramsRespostas },
    );

    if (duplicados.length > 0) {
      throw conflict(
        `Já existe contestação em andamento para: ${duplicados
          .map((row) => row.criterio)
          .join(", ")}.`,
      );
    }

    const dias = await prazoJulgamentoDias(connection, ficha.campanha_id);

    // `motivo` do pedido resume os itens. Num banco sem a coluna `motivo` em
    // `contestacao_itens` (migration 006 ausente), este texto é o ÚNICO lugar
    // onde o motivo de cada item sobrevive — por isso ele nomeia o critério.
    const resumo = itens
      .map((item, indice) => {
        const alvo = respostas.find((row) => String(row.id) === String(item.respostaId));
        return `${indice + 1}. ${alvo?.criterio ?? "Critério"}: ${item.motivo}`;
      })
      .join("\n");

    const [pedido] = await connection.execute(
      `INSERT INTO contestacoes
          (avaliacao_id, aberta_por_id, status, motivo, prazo_julgamento, score_anterior)
       VALUES
          (:avaliacaoId, :abertoPorId, 'pendente', :motivo,
           DATE_ADD(CURRENT_DATE, INTERVAL :dias DAY), :scoreAnterior)`,
      {
        avaliacaoId: ficha.id,
        abertoPorId,
        motivo: resumo,
        dias,
        scoreAnterior: ficha.score,
      },
    );

    const contestacaoId = pedido.insertId;

    for (const item of itens) {
      await connection.execute(
        `INSERT INTO contestacao_itens
            (contestacao_id, avaliacao_resposta_id, argumento, status_original
             ${temMotivoItem ? ", motivo" : ""})
         VALUES
            (:contestacaoId, :respostaId, :argumento, 'nao_conforme'
             ${temMotivoItem ? ", :motivo" : ""})`,
        temMotivoItem
          ? {
              contestacaoId,
              respostaId: item.respostaId,
              argumento: item.justificativa,
              motivo: item.motivo,
            }
          : { contestacaoId, respostaId: item.respostaId, argumento: item.justificativa },
      );
    }

    return {
      contestacaoId: String(contestacaoId),
      itens: itens.length,
      prazoDias: dias,
      motivoPorItemGravado: temMotivoItem,
    };
  });
}

/**
 * Recalcula a nota da ficha a partir das respostas.
 *
 * A fórmula é a MESMA de `calcularResumo` em services/avaliacao-ia.js: um
 * eliminatório não conforme zera; fora isso é o percentual dos pesos obtidos
 * sobre os pesos aplicáveis, e critério não aplicável sai das duas somas. Se as
 * duas contas divergirem, a mesma ficha passa a ter duas notas — a do lançamento
 * e a do pós-julgamento.
 *
 * Sem peso cadastrado não há nota: `pesoTotal === 0` devolve 0 em vez de inventar
 * um denominador, como manda a regra "nenhuma penalização sem peso configurado".
 */
async function recalcularNota(connection, avaliacaoId) {
  const [rows] = await connection.execute(
    `SELECT r.status, cr.peso_pts, cr.eliminatoria
       FROM avaliacao_respostas r
       JOIN formulario_criterios cr ON cr.id = r.criterio_id
      WHERE r.avaliacao_id = :avaliacaoId`,
    { avaliacaoId },
  );

  let pesoTotal = 0;
  let pesoObtido = 0;
  const contagem = { conforme: 0, nao_conforme: 0, nao_aplicavel: 0 };
  let zerada = false;

  for (const row of rows) {
    if (contagem[row.status] != null) contagem[row.status] += 1;

    if (row.eliminatoria) {
      if (row.status === "nao_conforme") zerada = true;
      continue;
    }
    if (row.status === "nao_aplicavel") continue;

    const peso = Number(row.peso_pts ?? 0);
    pesoTotal += peso;
    if (row.status === "conforme") pesoObtido += peso;
  }

  const score = zerada || pesoTotal === 0 ? 0 : Number(((pesoObtido / pesoTotal) * 100).toFixed(2));
  const temZerada = await temColuna("avaliacoes", "zerada");

  const params = {
    score,
    conformes: contagem.conforme,
    naoConformes: contagem.nao_conforme,
    naoAplicaveis: contagem.nao_aplicavel,
    total: rows.length,
    avaliacaoId,
  };
  if (temZerada) params.zerada = zerada ? 1 : 0;

  await connection.execute(
    `UPDATE avaliacoes
        SET score = :score,
            total_conformes = :conformes,
            total_nao_conformes = :naoConformes,
            total_nao_aplicaveis = :naoAplicaveis,
            total_criterios = :total
            ${temZerada ? ", zerada = :zerada" : ""}
      WHERE id = :avaliacaoId`,
    params,
  );

  return score;
}

/**
 * Julga os itens de um pedido (tela Gestão ADM).
 *
 * Item DEFERIDO muda a resposta na ficha: o critério volta a conforme e o peso é
 * devolvido. Deferir sem mexer na nota seria dizer ao operador "você tinha razão"
 * e deixar o desconto onde estava.
 *
 * O pedido só fecha quando todos os itens têm resultado. Enquanto faltar algum,
 * ele fica `em_analise` — a fila do ADM mostra o que ainda depende dele.
 */
export async function julgarContestacao({ contestacaoId, codigo, decisoes, julgadaPorId }) {
  if (!Array.isArray(decisoes) || decisoes.length === 0) {
    throw badRequest("Informe o resultado de ao menos um item.");
  }

  return transaction(async (connection) => {
    const [pedidos] = await connection.execute(
      `SELECT c.id, c.avaliacao_id, c.status, a.codigo, a.score
         FROM contestacoes c
         JOIN avaliacoes a ON a.id = c.avaliacao_id
        WHERE c.id = :contestacaoId
        LIMIT 1`,
      { contestacaoId },
    );

    if (pedidos.length === 0) throw notFound("Contestação não encontrada.");
    const pedido = pedidos[0];

    // A rota vem com o código da monitoria no caminho. Conferir antes de
    // qualquer UPDATE impede julgar o pedido de OUTRA ficha mandando um id
    // avulso no corpo.
    if (codigo && pedido.codigo !== codigo) {
      throw notFound("Esta contestação não pertence à monitoria informada.");
    }

    if (pedido.status === "julgada") throw conflict("Esta contestação já foi julgada.");
    if (pedido.status === "cancelada") throw conflict("Esta contestação foi cancelada.");

    const [itens] = await connection.execute(
      `SELECT ci.id, ci.avaliacao_resposta_id, ci.resultado
         FROM contestacao_itens ci
        WHERE ci.contestacao_id = :contestacaoId`,
      { contestacaoId },
    );

    const porId = new Map(itens.map((item) => [String(item.id), item]));
    let deferidos = 0;

    for (const decisao of decisoes) {
      const item = porId.get(String(decisao.itemId));
      if (!item) throw badRequest("Um dos itens julgados não pertence a esta contestação.");

      const deferido = decisao.resultado === "deferido";

      await connection.execute(
        `UPDATE contestacao_itens
            SET resultado = :resultado,
                status_final = :statusFinal,
                parecer = :parecer,
                julgada_por_id = :julgadaPorId,
                julgada_em = CURRENT_TIMESTAMP
          WHERE id = :itemId`,
        {
          resultado: decisao.resultado,
          statusFinal: deferido ? "conforme" : "nao_conforme",
          parecer: decisao.parecer,
          julgadaPorId,
          itemId: item.id,
        },
      );

      if (deferido) {
        deferidos += 1;
        // Peso devolvido a partir do CADASTRO do critério, não de um número
        // vindo da requisição: o parecer decide se procede, nunca quanto vale.
        await connection.execute(
          `UPDATE avaliacao_respostas r
             JOIN formulario_criterios cr ON cr.id = r.criterio_id
              SET r.status = 'conforme',
                  r.peso_aplicado = cr.peso_pts
            WHERE r.id = :respostaId`,
          { respostaId: item.avaliacao_resposta_id },
        );
      }

      item.resultado = decisao.resultado;
    }

    const pendentes = [...porId.values()].filter((item) => !item.resultado);
    const scoreFinal = deferidos > 0 ? await recalcularNota(connection, pedido.avaliacao_id) : null;

    if (pendentes.length > 0) {
      await connection.execute(
        `UPDATE contestacoes SET status = 'em_analise' WHERE id = :contestacaoId`,
        { contestacaoId },
      );

      return {
        codigo: pedido.codigo,
        status: "em_analise",
        itensPendentes: pendentes.length,
        itensDeferidos: deferidos,
        scoreFinal,
      };
    }

    // Resultado do pedido a partir dos itens: todos deferidos = deferida, nenhum
    // = indeferida, o meio = parcial. É o mesmo vocabulário que os cards
    // "Procedentes / Improcedentes / Deliberadas" contam.
    const totalItens = porId.size;
    const resultado =
      deferidos === 0 ? "indeferida" : deferidos === totalItens ? "deferida" : "parcial";

    await connection.execute(
      `UPDATE contestacoes
          SET status = 'julgada',
              resultado = :resultado,
              julgada_por_id = :julgadaPorId,
              julgada_em = CURRENT_TIMESTAMP,
              score_final = :scoreFinal
        WHERE id = :contestacaoId`,
      { resultado, julgadaPorId, scoreFinal: scoreFinal ?? pedido.score, contestacaoId },
    );

    return {
      codigo: pedido.codigo,
      status: "julgada",
      resultado,
      itensPendentes: 0,
      itensDeferidos: deferidos,
      scoreFinal: scoreFinal ?? (pedido.score == null ? null : Number(pedido.score)),
    };
  });
}
