import { query } from "../db";
import { CLIENTES_INICIAIS } from "../catalogo-inicial";
import { FAIXAS_PERFORMANCE, nomeQuadrante } from "@/lib/faixas";

/**
 * Painel inicial: os números que o gestor procura, na ordem em que ele pergunta.
 *
 * "Como estamos?" -> KPIs com tendência
 * "O que piorou?" -> evolução e distribuição
 * "Onde está?"    -> ofensores e carteiras
 * "O que faço?"   -> prioridades e foco da gestão
 *
 * Duas bases alimentam tudo: `avaliacoes` (monitoria com formulário cadastrado)
 * e a análise IA guardada em `transcricoes.segmentos_json` (upload sem
 * formulário). As duas são somadas porque, para a gestão, as duas são monitoria
 * — separá-las faria o painel mostrar metade da operação.
 */

// Reexportadas para quem já importava daqui. A definição mora em lib/faixas.js
// porque as telas (navegador) usam a mesma tabela que o agregado (servidor).
export { FAIXAS_PERFORMANCE, nomeQuadrante };

function janelaVazia() {
  return { reviews: 0, averageScore: 0, nonConformities: 0, criticalReviews: 0 };
}

function emptyDashboard(period) {
  return {
    period,
    kpis: {
      averageScore: 0,
      reviews: 0,
      feedbackPending: 0,
      nonConformities: 0,
      criticalReviews: 0,
      averageDurationSeconds: 0,
      activeClients: 0,
    },
    anterior: janelaVazia(),
    qualityByDay: [],
    clients: [],
    quadrants: [],
    offenders: [],
    foco: null,
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

/** `null` para filtro ausente, número para id válido. Texto livre não entra em SQL. */
function idOuNulo(valor) {
  const texto = String(valor ?? "").trim();
  return /^\d{1,20}$/.test(texto) && texto !== "0" ? Number(texto) : null;
}

/**
 * Fragmento de WHERE dos filtros globais.
 *
 * Monta o SQL em vez de passar `:clienteId IS NULL OR ...`: com placeholder
 * nomeado o mysql2 exige TODOS os parâmetros presentes, e filtro ausente é o
 * caso normal aqui. `alias` muda porque a mesma regra vale para `avaliacoes` e
 * para `gravacoes`.
 */
function recorte({ clienteId, campanhaId, operadorId }, alias) {
  const partes = [];
  const params = {};

  if (clienteId != null) {
    partes.push(`AND ${alias}.cliente_id = :clienteId`);
    params.clienteId = clienteId;
  }
  if (campanhaId != null) {
    partes.push(`AND ${alias}.campanha_id = :campanhaId`);
    params.campanhaId = campanhaId;
  }
  // Gravação enviada sem operador informado tem `avaliado_id` nulo: filtrar por
  // operador exclui essas análises de propósito, senão o recorte de uma pessoa
  // mostraria monitoria de outra.
  if (operadorId != null) {
    partes.push(`AND ${alias}.avaliado_id = :operadorId`);
    params.operadorId = operadorId;
  }

  return { sql: partes.join("\n            "), params };
}

/**
 * Achados das análises IA, separados por janela (período atual x anterior).
 *
 * A comparação com o período anterior é o que transforma "nota 47,6" em
 * "nota 47,6, caiu 8 pontos" — sem ela o KPI não responde "o que piorou?".
 */
function agregarAnalisesIa(rows = []) {
  const janelas = { atual: contadorVazio(), anterior: contadorVazio() };
  const dias = new Map();
  const clientes = new Map();
  const quadrantes = new Map();
  const ofensores = new Map();
  const recentes = [];
  const prioridades = [];

  for (const row of rows) {
    const analise = parseJson(row.segmentos_json);
    if (!analise) continue;

    const anterior = String(row.janela) === "anterior";
    const alvo = anterior ? janelas.anterior : janelas.atual;

    alvo.reviews += 1;
    const score = numero(analise.nota, NaN);
    const hasScore = Number.isFinite(score);
    if (hasScore) {
      alvo.scoreSum += score;
      alvo.scoreCount += 1;
    }

    const duracao = row.duracao_segundos == null ? null : numero(row.duracao_segundos, NaN);
    if (Number.isFinite(duracao)) {
      alvo.durationSum += duracao;
      alvo.durationCount += 1;
    }

    const resumo = analise.resumoConformidade || {};
    const falhas = numero(resumo.naoConformes);
    alvo.nonConformities += falhas;
    const critica = Boolean(analise.zerada) || score === 0;
    if (critica) alvo.zeroedReviews += 1;

    // Tudo abaixo é detalhe de tela: só o período atual entra.
    if (anterior) continue;

    if (hasScore) {
      const quadrante = nomeQuadrante(score);
      quadrantes.set(quadrante, (quadrantes.get(quadrante) || 0) + 1);
    }

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
        const registro = ofensores.get(nome) || { name: nome, failures: 0, eliminatoria: false };
        registro.failures += 1;
        // Um único critério eliminatório na lista marca o ofensor: é o que muda
        // a recomendação de "reforçar em feedback" para "calibrar equipe".
        if (criterio.eliminatoria) registro.eliminatoria = true;
        ofensores.set(nome, registro);
      }
    }

    const item = {
      public_id: analise.codigo || `MIA-${row.id}`,
      // Aponta para a AVALIAÇÃO, não para a transcrição: quem clica em "revisar
      // monitoria" quer os critérios e a nota, não o texto bruto do áudio.
      href: `/avaliacoes/ia/${row.id}`,
      score: hasScore ? score : 0,
      status: falhas > 0 ? "revisao" : "concluida",
      created_at: row.created_at,
      operator_name: row.operador || "Não informado",
      wallet_name: cliente,
      form_name: analise.formulario || "Análise IA livre",
      origem: "ia",
    };
    recentes.push(item);
    if (falhas > 0 || critica || score < 80) {
      prioridades.push({ ...item, non_conformities: falhas, critica });
    }
  }

  return {
    atual: janelas.atual,
    anterior: janelas.anterior,
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
    offenders: [...ofensores.values()].sort(
      (a, b) => b.failures - a.failures || a.name.localeCompare(b.name),
    ),
    recentReviews: recentes
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8),
    priorities: prioridades.sort(ordemPrioridade).slice(0, 6),
  };
}

function contadorVazio() {
  return {
    reviews: 0,
    scoreSum: 0,
    scoreCount: 0,
    durationSum: 0,
    durationCount: 0,
    nonConformities: 0,
    zeroedReviews: 0,
  };
}

/** Zerada primeiro, depois nota mais baixa, depois mais falhas. */
function ordemPrioridade(a, b) {
  if (Boolean(b.critica) !== Boolean(a.critica)) return b.critica ? 1 : -1;
  const notas = numero(a.score) - numero(b.score);
  if (notas !== 0) return notas;
  return numero(b.non_conformities) - numero(a.non_conformities);
}

function mergePorChave(listas, chave, campos) {
  const mapa = new Map();

  for (const item of listas.flat()) {
    const nome = item?.[chave];
    if (!nome) continue;
    const atual = mapa.get(nome) || { ...item, ...Object.fromEntries(campos.map((campo) => [campo, 0])) };
    for (const campo of campos) atual[campo] = numero(atual[campo]) + numero(item[campo]);
    // Flag booleana não soma: uma vez verdadeira, permanece.
    if (item.eliminatoria) atual.eliminatoria = true;
    mapa.set(nome, atual);
  }

  return [...mapa.values()];
}

/** Média ponderada por volume — média de médias mentiria sobre o período. */
function mediaPonderada(partes, campoValor = "score", campoPeso = "reviews") {
  const soma = partes.reduce((total, item) => total + numero(item[campoValor]) * numero(item[campoPeso]), 0);
  const peso = partes.reduce((total, item) => total + numero(item[campoPeso]), 0);
  return peso > 0 ? Math.round((soma / peso) * 10) / 10 : 0;
}

/**
 * Variação contra o período anterior.
 *
 * `direcao` é sempre do ponto de vista do NEGÓCIO, não da aritmética: em
 * "não conformidades" subir é ruim, e a tela precisa disso para escolher a cor
 * e a seta sem repetir a regra em cada KPI.
 */
function tendencia(atual, anterior, { maiorEhMelhor = true } = {}) {
  const a = numero(atual);
  const b = numero(anterior);
  const delta = Math.round((a - b) * 10) / 10;

  if (b === 0 && a === 0) return { delta: 0, direcao: "estavel", anterior: b, comparavel: false };
  if (b === 0) return { delta, direcao: maiorEhMelhor ? "melhora" : "piora", anterior: b, comparavel: false };

  const percentual = Math.round(((a - b) / Math.abs(b)) * 1000) / 10;
  const direcao = delta === 0 ? "estavel" : (delta > 0) === maiorEhMelhor ? "melhora" : "piora";
  return { delta, percentual, direcao, anterior: b, comparavel: true };
}

/**
 * Principal ofensor virado em recomendação.
 *
 * O impacto é uma LEITURA DA TELA a partir da frequência e da flag de
 * eliminatório do próprio formulário — não é regra do POP nem julgamento da IA.
 * Por isso a tela precisa dizer de onde ele veio.
 */
function focoDaGestao(offenders) {
  const principal = offenders[0];
  if (!principal) return null;

  const totalFalhas = offenders.reduce((soma, item) => soma + numero(item.failures), 0);
  const share = totalFalhas > 0 ? Math.round((numero(principal.failures) / totalFalhas) * 100) : 0;

  const impacto = principal.eliminatoria || share >= 30 ? "alto" : share >= 15 ? "medio" : "baixo";
  const acao = principal.eliminatoria
    ? "Critério eliminatório: calibrar a equipe e tratar caso a caso antes de aplicar feedback."
    : impacto === "alto"
      ? "Concentração alta num critério só: treinar o time neste ponto."
      : "Reforçar em feedback individual e acompanhar na próxima leva.";

  return {
    criterio: principal.name,
    ocorrencias: numero(principal.failures),
    share,
    impacto,
    eliminatoria: Boolean(principal.eliminatoria),
    acao,
    totalFalhas,
  };
}

export async function getDashboardOverview({ period, clienteId, campanhaId, operadorId } = {}) {
  const periodDays = period === "weekly" ? 7 : 31;
  // Dobro da janela numa consulta só: o período anterior sai da mesma leitura,
  // separado pela coluna `janela`.
  const janelaDupla = periodDays * 2;
  const empty = emptyDashboard(period);

  const filtro = { clienteId: idOuNulo(clienteId), campanhaId: idOuNulo(campanhaId), operadorId: idOuNulo(operadorId) };
  const avaliacoes = recorte(filtro, "a");
  const gravacoes = recorte(filtro, "g");
  const base = { periodDays, janelaDupla };

  const [
    kpisRows,
    clientesRows,
    qualityByDay,
    clients,
    quadrants,
    offenders,
    contestacoesRows,
    statusRows,
    recentReviews,
    priorities,
    iaRows,
  ] = await Promise.all([
    safe("kpis", [], () =>
      query(
        `SELECT
            CASE WHEN a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
                 THEN 'atual' ELSE 'anterior' END AS janela,
            COUNT(*) AS reviews,
            ROUND(COALESCE(AVG(a.score), 0), 1) AS average_score,
            SUM(a.status_feedback = 'pendente') AS feedback_pending,
            SUM(COALESCE(a.total_nao_conformes, 0)) AS non_conformities,
            SUM(COALESCE(a.zerada, 0) = 1 OR COALESCE(a.score, 0) = 0) AS critical_reviews,
            ROUND(COALESCE(AVG(a.duracao_segundos), 0), 0) AS average_duration_seconds
           FROM avaliacoes a
          WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :janelaDupla DAY)
            ${avaliacoes.sql}
          GROUP BY janela`,
        { ...base, ...avaliacoes.params },
      ),
    ),
    safe("clientes", [{ active_clients: CLIENTES_INICIAIS.length }], () =>
      query(`SELECT COUNT(*) AS active_clients FROM clientes WHERE ativo = 1`),
    ),
    safe("qualityByDay", [], () =>
      query(
        `SELECT DATE(a.data_avaliacao) AS day, ROUND(AVG(a.score), 1) AS score, COUNT(*) AS reviews
           FROM avaliacoes a
          WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            ${avaliacoes.sql}
          GROUP BY DATE(a.data_avaliacao)
          ORDER BY day`,
        { periodDays, ...avaliacoes.params },
      ),
    ),
    safe("clients", [], () =>
      query(
        `SELECT
            c.nome AS name,
            COUNT(a.id) AS reviews,
            ROUND(COALESCE(AVG(a.score), 0), 1) AS score
           FROM clientes c
           JOIN avaliacoes a ON a.cliente_id = c.id
            AND a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            ${avaliacoes.sql}
          GROUP BY c.id, c.nome
          ORDER BY score ASC, reviews DESC
          LIMIT 8`,
        { periodDays, ...avaliacoes.params },
      ),
    ),
    safe("quadrants", [], () =>
      query(
        `SELECT a.score
           FROM avaliacoes a
          WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            AND a.score IS NOT NULL
            ${avaliacoes.sql}`,
        { periodDays, ...avaliacoes.params },
      ),
    ),
    safe("offenders", [], () =>
      query(
        `SELECT
            c.nome AS name,
            COUNT(*) AS failures,
            MAX(c.eliminatoria) AS eliminatoria
           FROM avaliacao_respostas r
           JOIN formulario_criterios c ON c.id = r.criterio_id
           JOIN avaliacoes a ON a.id = r.avaliacao_id
          WHERE r.status = 'nao_conforme'
            AND a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            ${avaliacoes.sql}
          GROUP BY c.id, c.nome
          ORDER BY failures DESC, c.nome
          LIMIT 10`,
        { periodDays, ...avaliacoes.params },
      ),
    ),
    safe("contestacoes", [{ total: 0 }], () =>
      query(
        `SELECT COUNT(*) AS total
           FROM contestacoes
          WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)`,
        { periodDays },
      ),
    ),
    safe("status", [{ feedback_open: 0, feedback_applied: 0 }], () =>
      query(
        `SELECT
            SUM(a.status_feedback IN ('pendente', 'assinatura', 'revisao')) AS feedback_open,
            SUM(a.status_feedback IN ('aplicado', 'concluida', 'justificada')) AS feedback_applied
           FROM avaliacoes a
          WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
            ${avaliacoes.sql}`,
        { periodDays, ...avaliacoes.params },
      ),
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
          WHERE 1 = 1
            ${avaliacoes.sql}
          ORDER BY a.data_avaliacao DESC
          LIMIT 8`,
        { ...avaliacoes.params },
      ),
    ),
    safe("priorities", [], () =>
      query(
        `SELECT
            a.codigo AS public_id,
            CONCAT('/avaliacoes/', a.codigo) AS href,
            a.score,
            a.status_feedback AS status,
            a.total_nao_conformes AS non_conformities,
            COALESCE(a.zerada, 0) = 1 OR COALESCE(a.score, 0) = 0 AS critica,
            av.name AS operator_name,
            c.nome AS wallet_name
           FROM avaliacoes a
           LEFT JOIN users av ON av.id = a.avaliado_id
           LEFT JOIN clientes c ON c.id = a.cliente_id
          WHERE (a.status_feedback = 'pendente'
             OR a.score < 80
             OR COALESCE(a.total_nao_conformes, 0) > 0)
            ${avaliacoes.sql}
          ORDER BY critica DESC, a.score ASC, a.data_avaliacao DESC
          LIMIT 6`,
        { ...avaliacoes.params },
      ),
    ),
    safe("iaRows", [], () =>
      query(
        `SELECT
            g.id,
            g.nome_arquivo,
            g.duracao_segundos,
            g.created_at,
            CASE WHEN g.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
                 THEN 'atual' ELSE 'anterior' END AS janela,
            cl.nome AS cliente,
            ca.nome AS campanha,
            op.name AS operador,
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
           LEFT JOIN users op ON op.id = g.avaliado_id
          WHERE g.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :janelaDupla DAY)
            AND t.status = 'concluida'
            AND t.segmentos_json IS NOT NULL
            ${gravacoes.sql}
          ORDER BY g.created_at DESC
          LIMIT 1000`,
        { ...base, ...gravacoes.params },
      ),
    ),
  ]);

  const porJanela = (nome) => kpisRows.find((row) => String(row.janela) === nome) || {};
  const oficialAtual = porJanela("atual");
  const oficialAnterior = porJanela("anterior");
  const ia = agregarAnalisesIa(iaRows);

  // Cada janela soma as duas bases pelo mesmo caminho, senão a comparação
  // compararia coisas diferentes.
  function consolidar(oficial, analiseIa) {
    const reviewsOficiais = numero(oficial.reviews);
    const reviews = reviewsOficiais + analiseIa.reviews;
    const scoreCount = reviewsOficiais + analiseIa.scoreCount;
    const scoreSum = numero(oficial.average_score) * reviewsOficiais + analiseIa.scoreSum;
    const durationCount = reviewsOficiais + analiseIa.durationCount;
    const durationSum = numero(oficial.average_duration_seconds) * reviewsOficiais + analiseIa.durationSum;

    return {
      reviews,
      averageScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
      nonConformities: numero(oficial.non_conformities) + analiseIa.nonConformities,
      criticalReviews: numero(oficial.critical_reviews) + analiseIa.zeroedReviews,
      averageDurationSeconds: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
    };
  }

  const atual = consolidar(oficialAtual, ia.atual);
  const anterior = consolidar(oficialAnterior, ia.anterior);

  const mergedClients = mergePorChave([clients, ia.clients], "name", ["reviews"])
    .map((cliente) => ({
      ...cliente,
      score: mediaPonderada([
        ...clients.filter((item) => item.name === cliente.name),
        ...ia.clients.filter((item) => item.name === cliente.name),
      ]),
    }))
    // Pior nota primeiro: "carteiras em foco" é lista de problema, não ranking
    // de volume.
    .sort((a, b) => numero(a.score) - numero(b.score) || numero(b.reviews) - numero(a.reviews))
    .slice(0, 8);

  const mergedDays = mergePorChave([qualityByDay, ia.qualityByDay], "day", ["reviews"])
    .map((dia) => ({
      ...dia,
      score: mediaPonderada([
        ...qualityByDay.filter((item) => item.day === dia.day),
        ...ia.qualityByDay.filter((item) => item.day === dia.day),
      ]),
    }))
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));

  // Faixa calculada em JS a partir das notas cruas: com o CASE no SQL, mudar o
  // limite de uma faixa exigia editar a query E a tela.
  const faixasOficiais = new Map();
  for (const row of quadrants) {
    const rotulo = nomeQuadrante(row.score);
    faixasOficiais.set(rotulo, (faixasOficiais.get(rotulo) || 0) + 1);
  }
  const contagemFaixas = mergePorChave(
    [[...faixasOficiais.entries()].map(([label, value]) => ({ label, value })), ia.quadrants],
    "label",
    ["value"],
  );
  const mergedQuadrants = FAIXAS_PERFORMANCE.map((faixa) => ({
    label: faixa.rotulo,
    tom: faixa.tom,
    value: numero(contagemFaixas.find((item) => item.label === faixa.rotulo)?.value),
  }));

  const mergedOffenders = mergePorChave([offenders, ia.offenders], "name", ["failures"])
    .map((item) => ({ ...item, eliminatoria: Boolean(numero(item.eliminatoria)) || Boolean(item.eliminatoria) }))
    .sort((a, b) => numero(b.failures) - numero(a.failures) || a.name.localeCompare(b.name))
    .slice(0, 10);

  return {
    ...empty,
    filtros: filtro,
    kpis: {
      ...atual,
      feedbackPending: numero(oficialAtual.feedback_pending),
      activeClients: numero(clientesRows[0]?.active_clients),
    },
    anterior,
    tendencias: {
      averageScore: tendencia(atual.averageScore, anterior.averageScore),
      reviews: tendencia(atual.reviews, anterior.reviews),
      nonConformities: tendencia(atual.nonConformities, anterior.nonConformities, { maiorEhMelhor: false }),
      criticalReviews: tendencia(atual.criticalReviews, anterior.criticalReviews, { maiorEhMelhor: false }),
    },
    qualityByDay: mergedDays,
    clients: mergedClients,
    quadrants: mergedQuadrants,
    offenders: mergedOffenders,
    foco: focoDaGestao(mergedOffenders),
    status: {
      feedbackOpen: numero(statusRows[0]?.feedback_open),
      feedbackApplied: numero(statusRows[0]?.feedback_applied),
      contestations: numero(contestacoesRows[0]?.total),
      zeroedReviews: atual.criticalReviews,
    },
    recentReviews: [...ia.recentReviews, ...recentReviews]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8),
    priorities: [...ia.priorities, ...priorities.map((item) => ({ ...item, critica: Boolean(numero(item.critica)) }))]
      .sort(ordemPrioridade)
      .slice(0, 6),
  };
}
