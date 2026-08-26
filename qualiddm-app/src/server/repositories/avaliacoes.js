import { conflict, notFound } from "../errors";
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

export async function listarAvaliacoes({ limit = 100, offset = 0, user = null } = {}) {
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
  const filtros = [];
  const params = { limit, offset };
  if (tem("excluida_em")) filtros.push("a.excluida_em IS NULL");
  if (user?.role === "operador") {
    filtros.push("a.avaliado_id = :userId");
    params.userId = user.id;
  }
  const filtro = filtros.length > 0 ? `WHERE ${filtros.join(" AND ")}` : "";

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
      params,
    );
  } catch {
    return [];
  }

  const oficiais = rows.map(mapearAvaliacaoOficial);
  const iaLivres = user?.role === "operador" ? [] : await listarAvaliacoesIaLivres({ limit });

  return [...iaLivres, ...oficiais]
    .sort((a, b) => b.ordenacao - a.ordenacao)
    .slice(0, limit)
    .map(({ ordenacao: _ordenacao, ...item }) => item);
}

const COLUNAS_EXPORTACAO_MONITORIA = [
  { chave: "codigo", titulo: "CODIGO AVALIACAO", largura: 18 },
  { chave: "data_avaliacao", titulo: "DATA/HORA", largura: 22 },
  { chave: "data_contato", titulo: "DATA ATENDIMENTO", largura: 22 },
  { chave: "avaliado", titulo: "AVALIADO", largura: 28 },
  { chave: "login", titulo: "LOGIN", largura: 18 },
  { chave: "superior", titulo: "SUPERIOR", largura: 28 },
  { chave: "cliente", titulo: "CLIENTE", largura: 22 },
  { chave: "campanha", titulo: "CAMPANHA", largura: 26 },
  { chave: "departamento", titulo: "DEPARTAMENTO", largura: 22 },
  { chave: "avaliador", titulo: "AVALIADOR", largura: 28 },
  { chave: "tipo_avaliacao", titulo: "TIPO DE AVALIACAO", largura: 18 },
  { chave: "origem", titulo: "ORIGEM", largura: 12 },
  { chave: "cod_gravacao", titulo: "CODIGO DA GRAVACAO", largura: 26 },
  { chave: "formulario", titulo: "FORMULARIO", largura: 34 },
  { chave: "secao", titulo: "SECAO", largura: 28 },
  { chave: "criterio", titulo: "CRITERIO", largura: 42 },
  { chave: "peso", titulo: "PESO", tipo: "numero", largura: 10 },
  { chave: "resposta", titulo: "RESPOSTA", largura: 18 },
  { chave: "detalhe_resposta", titulo: "DETALHE_RESPOSTA", largura: 48 },
  { chave: "status_avaliacao", titulo: "STATUS AVALIACAO", largura: 20 },
  { chave: "data_inicio_setor", titulo: "DATA DE INICIO NO SETOR", largura: 22 },
  { chave: "obs_avaliador", titulo: "OBS_AVALIADOR", largura: 48 },
  { chave: "nota", titulo: "NOTA", tipo: "numero", largura: 10 },
  { chave: "nota_sem_ncg", titulo: "NOTA SEM NCG", tipo: "numero", largura: 14 },
  { chave: "tipo_resposta", titulo: "TIPO DE RESPOSTA", largura: 20 },
  { chave: "classificacao_eliminatoria", titulo: "CLASSIFICACAO ELIMINATORIA", largura: 26 },
  { chave: "codigo_criterio", titulo: "CODIGO_CRITERIO", largura: 18 },
  { chave: "periodo", titulo: "PERIODO", largura: 14 },
  { chave: "matricula", titulo: "MATRICULA", largura: 18 },
  { chave: "tipo_calculo", titulo: "TIPO DE CALCULO", largura: 18 },
  { chave: "data_feedback", titulo: "DATA FEEDBACK", largura: 22 },
  { chave: "tempo_feedback_aberto", titulo: "TEMPO_FEEDBACK_ABERTO", tipo: "numero", largura: 22 },
  { chave: "peso_calculado", titulo: "PESO_CALCULADO", tipo: "numero", largura: 16 },
  { chave: "telefone", titulo: "TELEFONE", largura: 18 },
  { chave: "data_prazo_feedback", titulo: "DATA PRAZO DE FEEDBACK", largura: 22 },
  { chave: "email_avaliado", titulo: "EMAIL DO AVALIADO", largura: 30 },
  { chave: "pendente_assinatura", titulo: "PENDENTE DE ASSINATURA", largura: 24 },
  { chave: "dias_ate_assinatura", titulo: "DIAS ATE ASSINATURA", tipo: "numero", largura: 20 },
  { chave: "dias_pendentes_assinatura", titulo: "DIAS PENDENTES ATE ASSINATURA", tipo: "numero", largura: 28 },
  { chave: "dados_cabecalho", titulo: "DADOS CABECALHO", largura: 34 },
  { chave: "ia_modelo", titulo: "CABECALHO: ai_model", largura: 22 },
  { chave: "ia_confianca", titulo: "CABECALHO: ai_confidence", tipo: "numero", largura: 24 },
  { chave: "ia_resumo", titulo: "CABECALHO: resumo_ia", largura: 48 },
  { chave: "ia_observacoes", titulo: "CABECALHO: observacoes_ia", largura: 48 },
  { chave: "ia_evidencia", titulo: "IA: evidencia", largura: 48 },
  { chave: "ia_raciocinio", titulo: "IA: raciocinio", largura: 48 },
  { chave: "ia_confianca_criterio", titulo: "IA: confianca_criterio", tipo: "numero", largura: 24 },
  { chave: "cpf_cliente", titulo: "CABECALHO: CPF", largura: 18 },
];

function valorFiltro(valor) {
  if (valor == null || valor === "" || valor === "todos") return null;
  return String(valor).trim();
}

function statusExportacao(status) {
  return STATUS_FEEDBACK[status] || status || "";
}

function tipoAvaliacaoExportacao(categoria) {
  return formatarCategoria(categoria);
}

function respostaExportacao(status) {
  return STATUS_CRITERIO[status] || status || "";
}

function tipoRespostaExportacao(status) {
  if (status === "nao_conforme") return "NAO CONFORME";
  if (status === "nao_aplicavel") return "NAO APLICAVEL";
  if (status === "conforme") return "CONFORME";
  return status || "";
}

function booleanoExportacao(valor) {
  return Number(valor || 0) ? "Sim" : "Nao";
}

function diasEntre(inicio, fim) {
  const a = Date.parse(String(inicio || "").replace(" ", "T"));
  const b = Date.parse(String(fim || "").replace(" ", "T"));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function periodoExportacao(valor) {
  const data = new Date(String(valor || "").replace(" ", "T"));
  if (Number.isNaN(data.getTime())) return "";
  return `${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
}

function montarFiltrosExportacao(filtros = {}, user = null) {
  const condicoes = ["a.excluida_em IS NULL"];
  const params = {};
  let indice = 0;
  const add = (sql, valor) => {
    indice += 1;
    const chave = `f${indice}`;
    condicoes.push(sql.replace("?", `:${chave}`));
    params[chave] = valor;
  };

  const operacao = valorFiltro(filtros.operacao);
  if (operacao) add("cl.nome = ?", operacao);

  const campanha = valorFiltro(filtros.campanha);
  if (campanha) add("ca.nome = ?", campanha);

  const avaliador = valorFiltro(filtros.avaliador);
  if (avaliador) add("mo.name = ?", avaliador);

  const avaliado = valorFiltro(filtros.avaliado);
  if (avaliado) add("av.name = ?", avaliado);

  const categoria = valorFiltro(filtros.categoria);
  if (categoria) {
    const normalizada = categoria
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    if (normalizada.includes("diagnostico")) {
      add("a.categoria = ?", "diagnostico");
    } else if (normalizada.includes("padrao")) {
      add("a.categoria = ?", "padrao");
    } else {
      add("COALESCE(fc.nome, a.categoria) = ?", categoria);
    }
  }

  const departamento = valorFiltro(filtros.departamento);
  if (departamento) add("cl.nome = ?", departamento);

  const de = valorFiltro(filtros.de);
  if (de) {
    condicoes.push("a.data_avaliacao >= :dataInicio");
    params.dataInicio = `${de} 00:00:00`;
  }

  const ate = valorFiltro(filtros.ate);
  if (ate) {
    condicoes.push("a.data_avaliacao <= :dataFim");
    params.dataFim = `${ate} 23:59:59`;
  }

  const id = valorFiltro(filtros.id);
  if (id) {
    condicoes.push("REPLACE(LOWER(a.codigo), 'qa-', '') LIKE :codigo");
    params.codigo = `%${id.toLowerCase().replace(/^qa-?/, "")}%`;
  }

  const performance = valorFiltro(filtros.performance);
  if (performance === "excelente") condicoes.push("a.score >= 90");
  if (performance === "bom") condicoes.push("a.score >= 80 AND a.score < 90");
  if (performance === "atencao") condicoes.push("a.score >= 70 AND a.score < 80");
  if (performance === "critico") condicoes.push("(a.score < 70 OR a.score IS NULL)");

  const busca = valorFiltro(filtros.busca);
  if (busca) {
    condicoes.push(`(
      a.codigo LIKE :busca OR f.nome LIKE :busca OR av.name LIKE :busca OR mo.name LIKE :busca OR
      su.name LIKE :busca OR cl.nome LIKE :busca OR ca.nome LIKE :busca OR a.cod_gravacao LIKE :busca OR
      a.origem LIKE :busca
    )`);
    params.busca = paraLike(busca);
  }

  if (user?.role === "operador") {
    condicoes.push("a.avaliado_id = :usuarioLogadoId");
    params.usuarioLogadoId = user.id;
  }

  return { where: condicoes.join("\n       AND "), params };
}

export async function exportarAvaliacoesDetalhadas({ filtros = {}, limit = 50000, user = null } = {}) {
  const [colunasAvaliacao, colunasResposta, colunasFormulario] = await Promise.all([
    colunasOpcionais("avaliacoes"),
    colunasOpcionais("avaliacao_respostas"),
    colunasOpcionais("formularios"),
  ]);
  const temAvaliacao = (coluna) => colunasAvaliacao.size === 0 || colunasAvaliacao.has(coluna);
  const temResposta = (coluna) => colunasResposta.size === 0 || colunasResposta.has(coluna);
  const temFormulario = (coluna) => colunasFormulario.size === 0 || colunasFormulario.has(coluna);
  const { where, params } = montarFiltrosExportacao(filtros, user);

  const rows = await query(
    `SELECT
        a.codigo,
        a.cod_gravacao,
        ${temAvaliacao("cpf_cliente") ? "a.cpf_cliente" : "NULL AS cpf_cliente"},
        a.categoria,
        ${temAvaliacao("origem") ? "a.origem" : "'humana' AS origem"},
        ${temAvaliacao("ia_modelo") ? "a.ia_modelo" : "NULL AS ia_modelo"},
        ${temAvaliacao("ia_confianca") ? "a.ia_confianca" : "NULL AS ia_confianca"},
        ${temAvaliacao("ia_resumo") ? "a.ia_resumo" : "NULL AS ia_resumo"},
        ${temAvaliacao("ia_observacoes") ? "a.ia_observacoes" : "NULL AS ia_observacoes"},
        a.score,
        a.zerada,
        a.data_contato,
        a.data_avaliacao,
        ${temAvaliacao("prazo_feedback") ? "a.prazo_feedback" : "NULL AS prazo_feedback"},
        a.status_feedback,
        cl.nome AS cliente,
        ca.nome AS campanha,
        f.nome AS formulario,
        ${temFormulario("tipo_calculo") ? "f.tipo_calculo" : "NULL AS tipo_calculo"},
        fc.nome AS categoria_nome,
        av.name AS avaliado,
        av.email AS email_avaliado,
        av.login,
        av.matricula,
        av.external_code,
        av.data_inicio_produto,
        mo.name AS avaliador,
        su.name AS superior,
        cg.nome AS departamento,
        fb.aplicado_em AS data_feedback,
        fb.assinado_em,
        fb.status AS feedback_status,
        s.nome AS secao,
        cr.id AS codigo_criterio,
        cr.nome AS criterio,
        cr.eliminatoria,
        cr.peso_pts,
        r.status,
        r.resposta,
        r.peso_aplicado,
        r.observacao_monitor,
        ${temResposta("ia_evidencia") ? "r.ia_evidencia" : "NULL AS ia_evidencia"},
        ${temResposta("ia_raciocinio") ? "r.ia_raciocinio" : "NULL AS ia_raciocinio"},
        ${temResposta("ia_confianca") ? "r.ia_confianca" : "NULL AS ia_confianca_criterio"},
        (
          SELECT ROUND(
            CASE
              WHEN SUM(CASE WHEN cr2.eliminatoria = 0 AND r2.status <> 'nao_aplicavel' THEN cr2.peso_pts ELSE 0 END) = 0
              THEN 0
              ELSE 100 * SUM(CASE WHEN cr2.eliminatoria = 0 AND r2.status = 'conforme' THEN cr2.peso_pts ELSE 0 END)
                / SUM(CASE WHEN cr2.eliminatoria = 0 AND r2.status <> 'nao_aplicavel' THEN cr2.peso_pts ELSE 0 END)
            END,
            2
          )
          FROM avaliacao_respostas r2
          JOIN formulario_criterios cr2 ON cr2.id = r2.criterio_id
          WHERE r2.avaliacao_id = a.id
        ) AS nota_sem_ncg
       FROM avaliacao_respostas r
       JOIN avaliacoes a ON a.id = r.avaliacao_id
       JOIN clientes cl ON cl.id = a.cliente_id
       LEFT JOIN campanhas ca ON ca.id = a.campanha_id
       JOIN formularios f ON f.id = a.formulario_id
       LEFT JOIN formulario_categorias fc ON fc.id = a.categoria_id
       JOIN users av ON av.id = a.avaliado_id
       JOIN users mo ON mo.id = a.avaliador_id
       LEFT JOIN users su ON su.id = a.supervisor_id
       LEFT JOIN cargos cg ON cg.id = av.cargo_id
       LEFT JOIN feedbacks fb ON fb.avaliacao_id = a.id
       JOIN formulario_criterios cr ON cr.id = r.criterio_id
       JOIN formulario_secoes s ON s.id = cr.secao_id
      WHERE ${where}
      ORDER BY a.data_avaliacao DESC, a.id DESC, s.posicao, cr.posicao
      LIMIT :limit`,
    { ...params, limit },
  );

  return {
    colunas: COLUNAS_EXPORTACAO_MONITORIA,
    linhas: rows.map((row) => {
      const dataFeedback = row.data_feedback || null;
      const pendenteAssinatura = row.feedback_status === "assinatura" && !row.assinado_em;
      return {
        codigo: row.codigo,
        data_avaliacao: row.data_avaliacao,
        data_contato: row.data_contato,
        avaliado: row.avaliado,
        login: row.login || row.external_code || "",
        superior: row.superior || "",
        cliente: row.cliente,
        campanha: row.campanha || "",
        departamento: row.departamento || row.cliente,
        avaliador: row.avaliador,
        tipo_avaliacao: tipoAvaliacaoExportacao(row.categoria),
        origem: row.origem,
        cod_gravacao: row.cod_gravacao || "",
        formulario: row.formulario,
        secao: row.secao,
        criterio: row.criterio,
        peso: row.peso_pts,
        resposta: row.resposta || respostaExportacao(row.status),
        detalhe_resposta: row.ia_evidencia || row.observacao_monitor || "",
        status_avaliacao: statusExportacao(row.status_feedback),
        data_inicio_setor: row.data_inicio_produto || "",
        obs_avaliador: row.observacao_monitor || "",
        nota: row.score,
        nota_sem_ncg: row.nota_sem_ncg,
        tipo_resposta: tipoRespostaExportacao(row.status),
        classificacao_eliminatoria: booleanoExportacao(row.eliminatoria),
        codigo_criterio: String(row.codigo_criterio),
        periodo: periodoExportacao(row.data_avaliacao),
        matricula: row.matricula || row.external_code || "",
        tipo_calculo: row.tipo_calculo || "",
        data_feedback: dataFeedback || "",
        tempo_feedback_aberto: dataFeedback ? diasEntre(row.data_avaliacao, dataFeedback) : "",
        peso_calculado: row.peso_aplicado,
        telefone: "",
        data_prazo_feedback: row.prazo_feedback || "",
        email_avaliado: row.email_avaliado || "",
        pendente_assinatura: pendenteAssinatura ? "Sim" : "Nao",
        dias_ate_assinatura: row.assinado_em ? diasEntre(row.data_avaliacao, row.assinado_em) : "",
        dias_pendentes_assinatura: pendenteAssinatura ? diasEntre(row.data_avaliacao, new Date().toISOString()) : "",
        dados_cabecalho: row.cpf_cliente ? `CPF: ${row.cpf_cliente}` : "",
        ia_modelo: row.ia_modelo || "",
        ia_confianca: row.ia_confianca,
        ia_resumo: row.ia_resumo || "",
        ia_observacoes: row.ia_observacoes || "",
        ia_evidencia: row.ia_evidencia || "",
        ia_raciocinio: row.ia_raciocinio || "",
        ia_confianca_criterio: row.ia_confianca_criterio,
        cpf_cliente: row.cpf_cliente || "",
      };
    }),
  };
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
  // Gravação excluída sai da lista. Sem este filtro a exclusão gravava no banco e
  // a tela mostrava o cartão de novo no F5 — o botão parecia não funcionar.
  const colunasGravacao = await colunasOpcionais("gravacoes");
  const filtroExcluida =
    colunasGravacao.size === 0 || colunasGravacao.has("excluida_em")
      ? "AND g.excluida_em IS NULL"
      : "";

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
          ${filtroExcluida}
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
          avaliador: "Acordito",
          supervisor: "Revisão humana pendente",
          campanha: row.campanha || analise.campanha || "Sem campanha",
          departamento: row.cliente || analise.carteira || "Acordito",
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
          // A ficha da análise IA agora vive em Avaliações; /transcricoes/[id]
          // ficou só com o áudio e o texto.
          href: `/avaliacoes/ia/${row.id}`,
          hrefTranscricao: `/transcricoes/${row.id}`,
          // Id da gravação exposto porque o código MIA-… não é chave de nada:
          // ele é derivado. Excluir a análise precisa do id real, e extraí-lo
          // do href por regex seria frágil.
          gravacaoId: String(row.id),
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

export async function obterAvaliacao(codigo, { user = null } = {}) {
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
        ${user?.role === "operador" ? "AND a.avaliado_id = :userId" : ""}
      LIMIT 1`,
    { codigo, ...(user?.role === "operador" ? { userId: user.id } : {}) },
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
export async function obterArquivoAvaliacao(codigo, { user = null } = {}) {
  const colunas = await colunasOpcionais("avaliacoes");
  const temGravacao = colunas.size === 0 || colunas.has("gravacao_id");

  const ficha = await one(
    `SELECT a.codigo, a.cod_gravacao, a.audio_path,
            ${temGravacao ? "a.gravacao_id" : "NULL AS gravacao_id"}
       FROM avaliacoes a
      WHERE a.codigo = :codigo
        ${user?.role === "operador" ? "AND a.avaliado_id = :userId" : ""}
      LIMIT 1`,
    { codigo, ...(user?.role === "operador" ? { userId: user.id } : {}) },
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
export async function obterAnexoAvaliacao(codigo, anexoId, { user = null } = {}) {
  let anexo;
  try {
    anexo = await one(
      `SELECT x.nome_arquivo, x.storage_path, x.mime_type
         FROM avaliacao_resposta_anexos x
         JOIN avaliacao_respostas r ON r.id = x.resposta_id
         JOIN avaliacoes a ON a.id = r.avaliacao_id
        WHERE x.id = :anexoId
          AND a.codigo = :codigo
          ${user?.role === "operador" ? "AND a.avaliado_id = :userId" : ""}
        LIMIT 1`,
      { anexoId, codigo, ...(user?.role === "operador" ? { userId: user.id } : {}) },
    );
  } catch (error) {
    if (isMissingSchemaError(error)) throw notFound("Anexo não encontrado.");
    throw error;
  }

  if (!anexo) throw notFound("Anexo não encontrado.");
  return { caminho: anexo.storage_path, nome: anexo.nome_arquivo, mimeType: anexo.mime_type };
}

/**
 * Exclui a monitoria com formulário (código QA-…).
 *
 * Marcada, não apagada: o relatório "Fichas Excluídas" existe justamente para
 * responder "quem excluiu o quê e por quê", e `DELETE` levaria as respostas, os
 * anexos e o feedback por CASCADE.
 *
 * Idempotente por escolha: excluir o que já está excluído devolve
 * `jaEstava: true` em vez de erro. Dois cliques no botão não podem virar dois
 * resultados diferentes.
 */
export async function excluirAvaliacao({ codigo, userId, motivo = null }) {
  const colunas = await colunasOpcionais("avaliacoes");
  const temSoftDelete = colunas.size === 0 || colunas.has("excluida_em");

  if (!temSoftDelete) {
    throw conflict(
      "Este banco não tem as colunas de exclusão de ficha. Rode a migration 003_telas_operacao_ia_admin.sql.",
    );
  }

  const ficha = await one(
    `SELECT id, codigo, excluida_em
       FROM avaliacoes
      WHERE codigo = :codigo
      LIMIT 1`,
    { codigo },
  );

  if (!ficha) throw notFound("Avaliação não encontrada.");
  if (ficha.excluida_em) {
    return { codigo: ficha.codigo, jaEstava: true };
  }

  const temAutor = colunas.has("excluida_por_id");
  const temMotivo = colunas.has("exclusao_motivo");

  await query(
    `UPDATE avaliacoes
        SET excluida_em = CURRENT_TIMESTAMP
            ${temAutor ? ", excluida_por_id = :userId" : ""}
            ${temMotivo ? ", exclusao_motivo = :motivo" : ""}
      WHERE id = :id`,
    {
      id: ficha.id,
      ...(temAutor ? { userId } : {}),
      ...(temMotivo ? { motivo } : {}),
    },
  );

  return { codigo: ficha.codigo, jaEstava: false };
}
