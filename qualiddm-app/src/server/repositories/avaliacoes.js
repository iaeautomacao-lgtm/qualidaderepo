import { notFound } from "../errors";
import { isMissingSchemaError, one, query } from "../db";
import {
  AVALIADORES_INICIAIS,
  AVALIADOS_INICIAIS,
  CAMPANHAS_INICIAIS,
  CATEGORIAS_INICIAIS,
  DEPARTAMENTOS_INICIAIS,
  OPERACOES_AVALIACAO_INICIAIS,
} from "../catalogo-inicial";
import {
  formatarBytes,
  formatarCategoria,
  codigoAnaliseIa,
  formatarDataHora,
  formatarDataIso,
  formatarDuracao,
  formatarHora,
  formatarScore,
} from "../format";
import { arquivoExiste } from "../services/arquivo-storage";

const STATUS_FEEDBACK = {
  pendente: "Feedback Pendente",
  assinatura: "Assinatura",
  concluida: "Concluída",
  justificada: "Justificada",
  revisao: "Revisão",
  dispensado: "Dispensado",
  // Banco anterior à 003 ainda tem 'aplicado' gravado nas linhas antigas.
  aplicado: "Aplicado",
};

const STATUS_CRITERIO = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  nao_aplicavel: "Não Aplicável",
};

const FORMULARIO_IA_LIVRE = "Ficha genérica de atendimento (análise livre)";

/**
 * Rótulos legíveis das respostas que o sistema já conhece.
 *
 * A ficha devolve a resposta LITERAL do banco em `resposta` e este rótulo em
 * `respostaLabel`. O mapa não filtra nada: rótulo próprio de carteira
 * ("opt_conforme", "Parcial") atravessa intacto, porque a coluna é VARCHAR
 * justamente para permitir isso.
 *
 * "diagnostico" NÃO é penalidade: critério respondido em modo diagnóstico
 * costuma vir com `status = 'conforme'`. Quem decide a cor do badge é
 * `statusChave`, nunca a resposta.
 */
const RESPOSTA_LABEL = {
  sim: "Sim",
  nao: "Não",
  diagnostico: "Diagnóstico",
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  nao_aplicavel: "Não Aplicável",
  opt_conforme: "Conforme",
};

// Valores que a aplicação grava. A coluna é VARCHAR(40) desde a migration 004,
// então a validação de escrita mora aqui — não no banco.
export const RESPOSTAS_CONHECIDAS = ["sim", "nao", "diagnostico"];

/**
 * Normaliza uma resposta antes de gravar.
 *
 * Aceita os valores conhecidos e qualquer rótulo curto de carteira; recusa o que
 * não cabe na coluna. Devolve `null` para vazio, que é o que a coluna aceita
 * quando o critério não tem resposta.
 */
export function normalizarResposta(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  return texto.slice(0, 40);
}

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

// Igual à de cima, mas nunca falha: serve para decidir se as colunas da
// migration 004 existem. Num banco que não rodou a 004 a ficha tem de abrir
// sem evidência da IA em vez de estourar 500.
async function colunasOpcionais(tabela) {
  try {
    return (await colunasDaTabela(tabela)) ?? new Set();
  } catch {
    return new Set();
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

  const oficiais = rows.map(mapearAvaliacaoOficial);
  const iaLivres = await listarAvaliacoesIaLivres({ limit });

  return [...iaLivres, ...oficiais]
    .sort((a, b) => b.ordenacao - a.ordenacao)
    .slice(0, limit)
    .map(({ ordenacao: _ordenacao, ...item }) => item);
}

// Colunas da migration 004. Ausentes num banco antigo: cada uma entra no
// SELECT só depois de aparecer no SHOW COLUMNS.
const COLUNAS_IA_FICHA = [
  "ia_persona",
  "ia_modelo",
  "ia_confianca",
  "ia_resumo",
  "ia_observacoes",
  "ia_analise_json",
];
const COLUNAS_IA_RESPOSTA = ["ia_evidencia", "ia_confianca", "ia_raciocinio"];

// `ia_analise_json` é texto serializado (o MySQL do cPanel recusa coluna JSON).
// JSON quebrado não pode derrubar a ficha inteira.
function analiseSalva(valor) {
  if (!valor) return null;
  try {
    const dados = JSON.parse(valor);
    return dados && typeof dados === "object" && !Array.isArray(dados) ? dados : null;
  } catch {
    return null;
  }
}

function listaTexto(valor) {
  return Array.isArray(valor) ? valor.map((item) => String(item)).filter(Boolean) : [];
}

function numeroOuNulo(valor) {
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function analiseIaDaTranscricao(valor) {
  const dados = analiseSalva(valor);
  if (!dados || !Array.isArray(dados.secoes)) return null;
  return dados;
}

function resumoTotalCriterios(analise) {
  const resumo = analise?.resumoConformidade;
  if (resumo?.total != null) return Number(resumo.total) || 0;
  return (analise?.secoes || []).reduce(
    (total, secao) => total + (Array.isArray(secao.criterios) ? secao.criterios.length : 0),
    0,
  );
}

function dataOrdenacao(valor) {
  const timestamp = Date.parse(String(valor || "").replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mapearAvaliacaoOficial(row) {
  return {
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
    origem: "avaliacao",
    href: `/avaliacoes/${encodeURIComponent(row.codigo)}`,
    ordenacao: dataOrdenacao(row.data_avaliacao),
  };
}

async function listarAvaliacoesIaLivres({ limit = 100 } = {}) {
  try {
    const rows = await query(
      `SELECT
          g.id,
          g.nome_arquivo,
          g.duracao_segundos,
          g.created_at,
          cl.nome AS cliente,
          ca.nome AS campanha,
          t.segmentos_json,
          t.confianca
         FROM gravacoes g
         LEFT JOIN clientes cl ON cl.id = g.cliente_id
         LEFT JOIN campanhas ca ON ca.id = g.campanha_id
         JOIN transcricoes t
           ON t.id = (
                SELECT MAX(t2.id)
                  FROM transcricoes t2
                 WHERE t2.gravacao_id = g.id
              )
        WHERE t.status = 'concluida'
          AND t.segmentos_json IS NOT NULL
          AND (g.avaliacao_id IS NULL OR g.avaliacao_id = 0)
        ORDER BY g.created_at DESC, g.id DESC
        LIMIT :limit`,
      { limit },
    );

    return rows
      .map((row) => {
        const analise = analiseIaDaTranscricao(row.segmentos_json);
        if (!analise) return null;
        const codigo = analise.codigo || codigoAnaliseIa(row.id, row.created_at);
        const score = numeroOuNulo(analise.nota);
        const confianca = numeroOuNulo(analise.confianca ?? row.confianca);

        return {
          id: codigo,
          avaliado: analise.avaliado || analise.operador || "Monitoria IA",
          avaliador: "Gemini",
          supervisor: "Revisão humana pendente",
          campanha: row.campanha || analise.campanha || "Sem campanha",
          departamento: row.cliente || analise.carteira || "Monitor IA",
          categoria: "Monitoria IA",
          score: formatarScore(score),
          data: formatarDataIso(row.created_at),
          hora: formatarHora(row.created_at),
          dataContato: formatarDataIso(row.created_at),
          horaContato: formatarHora(row.created_at),
          duracao: analise.duracao || formatarDuracao(row.duracao_segundos),
          duracaoAudio: analise.duracao || formatarDuracao(row.duracao_segundos),
          codGravacao: row.nome_arquivo || codigo,
          campos: resumoTotalCriterios(analise),
          statusFeedback: "Aguardando revisão",
          formulario: analise.formulario || FORMULARIO_IA_LIVRE,
          cliente: row.cliente || analise.carteira || "Sem carteira",
          dataFormatada: formatarDataHora(row.created_at),
          origem: "ia",
          href: `/transcricoes/${row.id}`,
          confianca: confianca == null ? null : Math.round(confianca * 100),
          insights: listaTexto(analise.insights),
          riscos: listaTexto(analise.riscos),
          ordenacao: dataOrdenacao(row.created_at),
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    return [];
  }
}

/**
 * Bloco "ia" da ficha: o que o modelo produziu além do status por critério.
 *
 * Colunas primeiro, `ia_analise_json` como reserva: fichas geradas antes da 004
 * não têm as colunas preenchidas, e o payload da análise, quando existe, é o
 * único lugar onde insights, riscos, próximos passos e transcrição moram.
 */
function blocoIa(ficha) {
  const analise = analiseSalva(ficha.ia_analise_json);

  return {
    persona: ficha.ia_persona || analise?.persona || null,
    modelo: ficha.ia_modelo || analise?.modelo || null,
    confianca: numeroOuNulo(ficha.ia_confianca ?? analise?.confianca),
    resumo: ficha.ia_resumo || analise?.resumo || null,
    observacoes: ficha.ia_observacoes || analise?.observacoes || null,
    insights: listaTexto(analise?.insights),
    riscos: listaTexto(analise?.riscos),
    proximosPassos: listaTexto(analise?.proximosPassos),
    transcricao: analise?.transcricao || null,
    geradoEm: analise?.geradoEm ? formatarDataHora(analise.geradoEm) : null,
  };
}

/**
 * Anexos das respostas, indexados por resposta.
 *
 * Os nomes dos placeholders saem do índice do array, não da requisição: nenhum
 * valor do usuário entra no texto do SQL. Tabela ausente devolve mapa vazio —
 * a ficha abre com `anexos: []`.
 */
async function anexosPorResposta(respostaIds) {
  if (respostaIds.length === 0) return new Map();

  const nomes = respostaIds.map((_, indice) => `:resposta${indice}`);
  const params = {};
  respostaIds.forEach((valor, indice) => {
    params[`resposta${indice}`] = valor;
  });

  let rows;
  try {
    rows = await query(
      `SELECT id, resposta_id, nome_arquivo, tamanho_bytes
         FROM avaliacao_resposta_anexos
        WHERE resposta_id IN (${nomes.join(", ")})
        ORDER BY id`,
      params,
    );
  } catch (error) {
    if (isMissingSchemaError(error)) return new Map();
    throw error;
  }

  const porResposta = new Map();
  for (const row of rows) {
    const chave = String(row.resposta_id);
    if (!porResposta.has(chave)) porResposta.set(chave, []);
    porResposta.get(chave).push({
      id: String(row.id),
      nome: row.nome_arquivo,
      tamanhoBytes: row.tamanho_bytes == null ? null : Number(row.tamanho_bytes),
      tamanhoLabel: formatarBytes(row.tamanho_bytes),
    });
  }
  return porResposta;
}

/**
 * Arquivo de áudio de uma avaliação.
 *
 * `audio_path` é a fonte principal. Quando está vazio a ficha pode ter nascido
 * pela tela de Transcrições, e aí o arquivo pertence à gravação — daí a
 * segunda consulta, que só acontece nesse caso.
 */
async function arquivoDaAvaliacao(ficha) {
  if (ficha.audio_path) {
    return { caminho: ficha.audio_path, nome: ficha.cod_gravacao || "gravacao", mimeType: null };
  }
  if (!ficha.gravacao_id) return null;

  try {
    const gravacao = await one(
      `SELECT nome_arquivo, storage_path, mime_type
         FROM gravacoes
        WHERE id = :gravacaoId
        LIMIT 1`,
      { gravacaoId: ficha.gravacao_id },
    );
    if (!gravacao?.storage_path) return null;
    return {
      caminho: gravacao.storage_path,
      nome: gravacao.nome_arquivo,
      mimeType: gravacao.mime_type,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}

export async function obterAvaliacao(codigo) {
  const [colunasFicha, colunasResposta] = await Promise.all([
    colunasOpcionais("avaliacoes"),
    colunasOpcionais("avaliacao_respostas"),
  ]);
  const temFicha = (coluna) => colunasFicha.size === 0 || colunasFicha.has(coluna);
  const temResposta = (coluna) => colunasResposta.size === 0 || colunasResposta.has(coluna);

  const selectFicha = [
    "a.id AS db_id",
    "a.codigo",
    "a.cod_gravacao",
    "a.categoria",
    "a.score",
    "a.duracao_segundos",
    "a.audio_path",
    "a.data_contato",
    "a.data_avaliacao",
    "a.prazo_feedback",
    "a.prazo_contestacao",
    "a.status_feedback",
    "a.total_conformes",
    "a.total_nao_conformes",
    "a.total_nao_aplicaveis",
    "a.total_criterios",
    temFicha("origem") ? "a.origem" : "'humana' AS origem",
    temFicha("zerada") ? "a.zerada" : "0 AS zerada",
    temFicha("quadrante") ? "a.quadrante" : "NULL AS quadrante",
    temFicha("gravacao_id") ? "a.gravacao_id" : "NULL AS gravacao_id",
    temFicha("cpf_cliente") ? "a.cpf_cliente" : "NULL AS cpf_cliente",
    ...COLUNAS_IA_FICHA.map((coluna) => (temFicha(coluna) ? `a.${coluna}` : `NULL AS ${coluna}`)),
    "cl.nome AS cliente",
    "ca.nome AS campanha",
    "f.nome AS formulario",
    "av.name AS avaliado_nome",
    "av.email AS avaliado_email",
    "mo.name AS avaliador_nome",
    "mo.email AS avaliador_email",
    "su.name AS supervisor_nome",
    "su.email AS supervisor_email",
  ];

  const ficha = await one(
    `SELECT
        ${selectFicha.join(",\n        ")}
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

  const selectRespostas = [
    "r.id AS resposta_id",
    "s.id AS secao_id",
    "s.nome AS secao_nome",
    "s.descricao AS secao_descricao",
    "s.posicao AS secao_posicao",
    "c.nome AS criterio_nome",
    "c.enunciado",
    "c.eliminatoria",
    "c.peso_pts",
    "c.posicao AS criterio_posicao",
    "r.resposta",
    "r.status",
    "r.peso_aplicado",
    "r.observacao_monitor",
    ...COLUNAS_IA_RESPOSTA.map((coluna) => (temResposta(coluna) ? `r.${coluna}` : `NULL AS ${coluna}`)),
  ];

  const [respostas, feedbacks, historico] = await Promise.all([
    query(
      `SELECT
          ${selectRespostas.join(",\n          ")}
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

  const origemIa = ficha.origem === "ia";
  const anexos = await anexosPorResposta(respostas.map((row) => String(row.resposta_id)));

  const secoes = [];
  const porSecao = new Map();
  const pesos = { obtido: 0, total: 0 };

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

    // Mesma conta da nota: eliminatório não soma peso e não aplicável sai do
    // denominador, senão marcar tudo "não aplicável" viraria ficha cheia.
    const pesoCriterio = numeroOuNulo(row.peso_pts);
    if (!row.eliminatoria && row.status !== "nao_aplicavel" && pesoCriterio != null) {
      pesos.total += pesoCriterio;
      pesos.obtido += numeroOuNulo(row.peso_aplicado) ?? 0;
    }

    porSecao.get(row.secao_id).criterios.push({
      nome: row.criterio_nome,
      enunciado: row.enunciado,
      // Resposta LITERAL do banco. Não é normalizada para sim/não: a operação
      // usa "diagnostico" e rótulos próprios por carteira, e reduzir tudo a dois
      // valores apagaria justamente a informação que distingue os casos.
      resposta: row.resposta ?? null,
      respostaLabel: row.resposta == null ? null : RESPOSTA_LABEL[row.resposta] ?? row.resposta,
      status: STATUS_CRITERIO[row.status] || row.status,
      statusChave: row.status,
      peso: numeroOuNulo(row.peso_aplicado),
      // Peso de cadastro do critério. `peso` continua sendo o peso APLICADO
      // (0 quando não conforme), que é o que a ficha já devolvia.
      pesoCriterio,
      eliminatoria: Boolean(row.eliminatoria),
      observacao: row.observacao_monitor,
      anexos: (anexos.get(String(row.resposta_id)) || []).map((anexo) => ({
        ...anexo,
        url: `/api/avaliacoes/${encodeURIComponent(ficha.codigo)}/anexos/${anexo.id}`,
      })),
      ia: origemIa
        ? {
            evidencia: row.ia_evidencia || null,
            confianca: numeroOuNulo(row.ia_confianca),
            raciocinio: row.ia_raciocinio || null,
          }
        : null,
    });
  }

  const arquivo = await arquivoDaAvaliacao(ficha);
  const audioDisponivel = arquivo ? await arquivoExiste(arquivo.caminho) : false;

  return {
    id: ficha.codigo,
    formulario: ficha.formulario,
    cliente: ficha.cliente,
    campanha: ficha.campanha || "Sem campanha",
    codGravacao: ficha.cod_gravacao || "N/A",
    cpfCliente: ficha.cpf_cliente || null,
    score: formatarScore(ficha.score),
    scoreNumero: Number(ficha.score ?? 0),
    duracao: formatarDuracao(ficha.duracao_segundos),
    duracaoAudio: formatarDuracao(ficha.duracao_segundos),
    categoria: formatarCategoria(ficha.categoria),
    origem: ficha.origem || "humana",
    zerada: Boolean(Number(ficha.zerada ?? 0)),
    quadrante: ficha.quadrante || null,
    statusFeedback: STATUS_FEEDBACK[ficha.status_feedback] || ficha.status_feedback,
    statusFeedbackChave: ficha.status_feedback,
    dataAvaliacao: formatarDataHora(ficha.data_avaliacao),
    dataContato: formatarDataHora(ficha.data_contato),
    prazoFeedback: formatarDataHora(ficha.prazo_feedback),
    prazoContestacao: formatarDataHora(ficha.prazo_contestacao),
    audioPath: ficha.audio_path,
    // Rota autenticada com suporte a Range, não caminho de disco. `null`
    // quando o arquivo não está no armazenamento: player quebrado é pior que
    // player ausente.
    audioUrl: audioDisponivel ? `/api/avaliacoes/${encodeURIComponent(ficha.codigo)}/audio` : null,
    avaliado: pessoa("Avaliado", ficha.avaliado_nome, ficha.avaliado_email),
    avaliador: pessoa("Monitor", ficha.avaliador_nome, ficha.avaliador_email),
    supervisor: pessoa("Supervisor", ficha.supervisor_nome, ficha.supervisor_email),
    resumo: {
      conformes: Number(ficha.total_conformes ?? 0),
      naoConformes: Number(ficha.total_nao_conformes ?? 0),
      naoAplicaveis: Number(ficha.total_nao_aplicaveis ?? 0),
      total: Number(ficha.total_criterios ?? respostas.length),
    },
    pesos: {
      obtido: Number(pesos.obtido.toFixed(2)),
      total: Number(pesos.total.toFixed(2)),
    },
    ia: origemIa ? blocoIa(ficha) : null,
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

/** Ponteiro do áudio de uma avaliação, para a rota que serve o arquivo. */
export async function obterArquivoAvaliacao(codigo) {
  const colunas = await colunasOpcionais("avaliacoes");
  const temGravacao = colunas.size === 0 || colunas.has("gravacao_id");

  const ficha = await one(
    `SELECT a.codigo, a.cod_gravacao, a.audio_path,
            ${temGravacao ? "a.gravacao_id" : "NULL AS gravacao_id"}
       FROM avaliacoes a
      WHERE a.codigo = :codigo
      LIMIT 1`,
    { codigo },
  );

  if (!ficha) throw notFound("Avaliação não encontrada.");

  const arquivo = await arquivoDaAvaliacao(ficha);
  if (!arquivo) throw notFound("Esta avaliação não tem áudio associado.");
  return arquivo;
}

/**
 * Ponteiro de um anexo de critério.
 *
 * O anexo é buscado PELO CÓDIGO DA AVALIAÇÃO junto com o id: trocar o id na URL
 * para o anexo de outra ficha não devolve nada. Sem esse vínculo no WHERE,
 * qualquer usuário autenticado baixaria anexo de qualquer avaliação.
 */
export async function obterAnexoAvaliacao(codigo, anexoId) {
  let anexo;
  try {
    anexo = await one(
      `SELECT x.nome_arquivo, x.storage_path, x.mime_type
         FROM avaliacao_resposta_anexos x
         JOIN avaliacao_respostas r ON r.id = x.resposta_id
         JOIN avaliacoes a ON a.id = r.avaliacao_id
        WHERE x.id = :anexoId
          AND a.codigo = :codigo
        LIMIT 1`,
      { anexoId, codigo },
    );
  } catch (error) {
    if (isMissingSchemaError(error)) throw notFound("Anexo não encontrado.");
    throw error;
  }

  if (!anexo) throw notFound("Anexo não encontrado.");
  return { caminho: anexo.storage_path, nome: anexo.nome_arquivo, mimeType: anexo.mime_type };
}
