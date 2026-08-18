import { isMissingSchemaError, one, paraLike, query, transaction } from "../db";
import { notFound } from "../errors";
import { codigoAnaliseIa, formatarDataHora, formatarDuracao, inteiro } from "../format";
import { arquivoExiste } from "../services/arquivo-storage";
import { FORMULARIO_ANALISE_LIVRE } from "../services/avaliacao-ia";

export const STATUS_TRANSCRICAO = [
  "nao_solicitada",
  "pendente",
  "processando",
  "concluida",
  "erro",
];
export const FILTRO_STATUS = [...STATUS_TRANSCRICAO, "todos"];

export const ORIGENS = ["upload", "integracao", "discadora"];

const LABEL_STATUS = {
  nao_solicitada: "Não solicitada",
  pendente: "Na fila",
  processando: "Processando",
  concluida: "Concluída",
  erro: "Erro",
};

const LABEL_ORIGEM = {
  upload: "Upload",
  integracao: "Integração",
  discadora: "Discadora",
};

// Trecho do texto que a coluna "Transcrição" mostra na tabela. O texto
// completo sai só no detalhe ou na exportação — mandar LONGTEXT inteiro numa
// listagem de 200 linhas é payload que ninguém lê.
const TAMANHO_PREVIA = 180;

function montarFiltros(filtros = {}) {
  const condicoes = [];
  const params = {};

  if (filtros.status && filtros.status !== "todos") {
    condicoes.push("g.status_transcricao = :status");
    params.status = filtros.status;
  }
  if (filtros.origem) {
    condicoes.push("g.origem = :origem");
    params.origem = filtros.origem;
  }
  if (filtros.clienteId) {
    condicoes.push("g.cliente_id = :clienteId");
    params.clienteId = filtros.clienteId;
  }
  if (filtros.campanhaId) {
    condicoes.push("g.campanha_id = :campanhaId");
    params.campanhaId = filtros.campanhaId;
  }
  if (filtros.dataInicio) {
    condicoes.push("g.created_at >= :dataInicio");
    params.dataInicio = `${filtros.dataInicio} 00:00:00`;
  }
  if (filtros.dataFim) {
    condicoes.push("g.created_at <= :dataFim");
    params.dataFim = `${filtros.dataFim} 23:59:59`;
  }
  // Caixa "Buscar por nome do arquivo...".
  if (filtros.busca) {
    condicoes.push("g.nome_arquivo LIKE :busca");
    params.busca = paraLike(filtros.busca);
  }

  return {
    where: condicoes.length > 0 ? `WHERE ${condicoes.join("\n          AND ")}` : "",
    params,
  };
}

// A transcrição corrente de uma gravação é a MAIS RECENTE: retranscrever é
// normal e o histórico das tentativas fica na tabela. A subconsulta por
// MAX(id) evita trazer as tentativas antigas na listagem.
const JOIN_TRANSCRICAO_CORRENTE = `
         LEFT JOIN transcricoes t
                ON t.id = (
                     SELECT MAX(t2.id)
                       FROM transcricoes t2
                      WHERE t2.gravacao_id = g.id
                   )`;

function vazio(limit, offset) {
  return {
    contadores: { total: 0, pendentes: 0, processando: 0, concluidas: 0, erros: 0 },
    paginacao: { limit, offset, total: 0 },
    itens: [],
  };
}

/** Lista as gravações com o status da transcrição corrente. */
export async function listarGravacoes({ filtros = {}, limit = 50, offset = 0 } = {}) {
  const { where, params } = montarFiltros(filtros);

  try {
    const contadores = await one(
      `SELECT
          COUNT(*) AS total,
          SUM(g.status_transcricao = 'pendente')    AS pendentes,
          SUM(g.status_transcricao = 'processando') AS processando,
          SUM(g.status_transcricao = 'concluida')   AS concluidas,
          SUM(g.status_transcricao = 'erro')        AS erros
         FROM gravacoes g
         ${where}`,
      params,
    );

    const rows = await query(
      `SELECT
          g.id, g.nome_arquivo, g.duracao_segundos, g.tamanho_bytes,
          g.origem, g.status_transcricao, g.created_at, g.storage_path,
          cl.nome AS cliente,
          ca.nome AS campanha,
          av.name  AS avaliado,
          en.name  AS enviado_por,
          a.codigo AS avaliacao,
          t.id AS transcricao_id,
          t.status AS transcricao_status,
          t.confianca,
          t.erro_mensagem,
          LEFT(t.texto, ${TAMANHO_PREVIA}) AS previa,
          CHAR_LENGTH(t.texto) AS tamanho_texto
         FROM gravacoes g
         LEFT JOIN clientes cl ON cl.id = g.cliente_id
         LEFT JOIN campanhas ca ON ca.id = g.campanha_id
         LEFT JOIN users av ON av.id = g.avaliado_id
         LEFT JOIN users en ON en.id = g.enviado_por_id
         LEFT JOIN avaliacoes a ON a.id = g.avaliacao_id
         ${JOIN_TRANSCRICAO_CORRENTE}
         ${where}
        ORDER BY g.created_at DESC, g.id DESC
        LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset },
    );

    return {
      contadores: {
        total: inteiro(contadores?.total),
        pendentes: inteiro(contadores?.pendentes),
        processando: inteiro(contadores?.processando),
        concluidas: inteiro(contadores?.concluidas),
        erros: inteiro(contadores?.erros),
      },
      paginacao: { limit, offset, total: inteiro(contadores?.total) },
      itens: rows.map((row) => ({
        id: String(row.id),
        arquivo: row.nome_arquivo,
        enviadaEm: formatarDataHora(row.created_at),
        duracao: formatarDuracao(row.duracao_segundos),
        duracaoSegundos: row.duracao_segundos == null ? null : inteiro(row.duracao_segundos),
        tamanhoBytes: row.tamanho_bytes == null ? null : inteiro(row.tamanho_bytes),
        origem: row.origem,
        origemLabel: LABEL_ORIGEM[row.origem] || row.origem,
        status: row.status_transcricao,
        statusLabel: LABEL_STATUS[row.status_transcricao] || row.status_transcricao,
        cliente: row.cliente || null,
        campanha: row.campanha || null,
        avaliado: row.avaliado || null,
        enviadoPor: row.enviado_por || null,
        avaliacao: row.avaliacao || null,
        armazenada: Boolean(row.storage_path),
        transcricao: row.transcricao_id
          ? {
              id: String(row.transcricao_id),
              status: row.transcricao_status,
              confianca: row.confianca == null ? null : Number(row.confianca),
              erro: row.erro_mensagem,
              previa: row.previa || "",
              truncada: inteiro(row.tamanho_texto) > TAMANHO_PREVIA,
            }
          : null,
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return vazio(limit, offset);
    return vazio(limit, offset);
  }
}

/** Texto completo e segmentos — usado no detalhe e na exportação JSON. */
export async function obterTranscricao(gravacaoId) {
  const gravacao = await one(
    `SELECT g.id, g.nome_arquivo, g.duracao_segundos, g.origem,
            g.status_transcricao, g.created_at, g.storage_path,
            cl.nome AS cliente,
            ca.nome AS campanha,
            t.id AS transcricao_id, t.provedor, t.modelo, t.idioma,
            t.texto, t.segmentos_json, t.confianca, t.status AS transcricao_status,
            t.erro_mensagem, t.created_at AS transcricao_em
       FROM gravacoes g
       LEFT JOIN clientes cl ON cl.id = g.cliente_id
       LEFT JOIN campanhas ca ON ca.id = g.campanha_id
       ${JOIN_TRANSCRICAO_CORRENTE}
      WHERE g.id = :gravacaoId
      LIMIT 1`,
    { gravacaoId },
  );

  if (!gravacao) throw notFound("Gravação não encontrada.");

  const audioDisponivel = await arquivoExiste(gravacao.storage_path);

  return {
    id: String(gravacao.id),
    arquivo: gravacao.nome_arquivo,
    enviadaEm: formatarDataHora(gravacao.created_at),
    duracao: formatarDuracao(gravacao.duracao_segundos),
    duracaoSegundos: gravacao.duracao_segundos == null ? null : inteiro(gravacao.duracao_segundos),
    origem: gravacao.origem,
    status: gravacao.status_transcricao,
    cliente: gravacao.cliente || null,
    campanha: gravacao.campanha || null,
    armazenada: Boolean(gravacao.storage_path),
    // Rota autenticada com suporte a Range; `null` quando o arquivo não está no
    // armazenamento, para a tela não montar um player que não toca.
    audioUrl: audioDisponivel ? `/api/gravacoes/${gravacao.id}/audio` : null,
    transcricao: gravacao.transcricao_id
      ? {
          id: String(gravacao.transcricao_id),
          provedor: gravacao.provedor,
          modelo: gravacao.modelo,
          idioma: gravacao.idioma,
          status: gravacao.transcricao_status,
          confianca: gravacao.confianca == null ? null : Number(gravacao.confianca),
          erro: gravacao.erro_mensagem,
          texto: gravacao.texto || "",
          segmentos: completarAnalise(parseSegmentos(gravacao.segmentos_json), gravacao),
          geradaEm: formatarDataHora(gravacao.transcricao_em),
        }
      : null,
  };
}

/**
 * Preenche os campos de cabeçalho da análise IA que a tela de detalhes exige.
 *
 * Análises gravadas antes desses campos existirem não têm `codigo`, `persona`,
 * `formulario` nem `duracao` dentro do JSON. Derivar aqui evita reprocessar
 * gravação antiga só para a tela abrir — e nunca sobrescreve o que o modelo
 * mandou.
 */
function completarAnalise(analise, gravacao) {
  if (!analise) return null;

  return {
    ...analise,
    codigo: analise.codigo || codigoAnaliseIa(gravacao.id, gravacao.created_at),
    persona: analise.persona || analise.carteira || gravacao.cliente || null,
    formulario: analise.formulario || FORMULARIO_ANALISE_LIVRE,
    duracao: analise.duracao || formatarDuracao(gravacao.duracao_segundos),
  };
}

/** Ponteiro do arquivo de uma gravação, para a rota que serve o áudio. */
export async function obterArquivoGravacao(gravacaoId) {
  let gravacao;
  try {
    gravacao = await one(
      `SELECT nome_arquivo, storage_path, mime_type
         FROM gravacoes
        WHERE id = :gravacaoId
        LIMIT 1`,
      { gravacaoId },
    );
  } catch (error) {
    if (isMissingSchemaError(error)) throw notFound("Gravação não encontrada.");
    throw error;
  }

  if (!gravacao) throw notFound("Gravação não encontrada.");
  if (!gravacao.storage_path) throw notFound("Esta gravação não tem arquivo armazenado.");

  return {
    caminho: gravacao.storage_path,
    nome: gravacao.nome_arquivo,
    mimeType: gravacao.mime_type,
  };
}

// Segmento gravado é texto (LONGTEXT, por compatibilidade com o MySQL do
// cPanel). JSON quebrado não pode derrubar a listagem: devolve vazio.
function parseSegmentos(valor) {
  if (!valor) return null;
  try {
    const dados = JSON.parse(valor);
    return dados && typeof dados === "object" ? dados : null;
  } catch {
    return null;
  }
}

/**
 * Registra as gravações enviadas.
 *
 * Idempotente por `hash_sha256`: reenviar o mesmo áudio devolve a gravação que
 * já existe em vez de criar outra linha e gastar transcrição de novo. Cada
 * arquivo é uma transação própria — um duplicado no meio do lote não desfaz os
 * que já entraram.
 */
export async function registrarGravacoes({
  arquivos,
  userId,
  transcreverAutomatico = true,
  clienteId = null,
  campanhaId = null,
  avaliadoId = null,
  origem = "upload",
}) {
  const resultados = [];

  for (const arquivo of arquivos) {
    const resultado = await transaction(async (connection) => {
      if (arquivo.hash) {
        const [existentes] = await connection.execute(
          "SELECT id, status_transcricao FROM gravacoes WHERE hash_sha256 = :hash LIMIT 1",
          { hash: arquivo.hash },
        );
        if (existentes.length > 0) {
          return {
            id: String(existentes[0].id),
            arquivo: arquivo.nome,
            status: existentes[0].status_transcricao,
            duplicada: true,
          };
        }
      }

      const statusInicial = transcreverAutomatico ? "pendente" : "nao_solicitada";

      const [insercao] = await connection.execute(
        `INSERT INTO gravacoes
           (nome_arquivo, storage_path, mime_type, tamanho_bytes, duracao_segundos,
            hash_sha256, origem, cliente_id, campanha_id, avaliado_id,
            enviado_por_id, status_transcricao, transcrever_automatico)
         VALUES
           (:nome, :storagePath, :mimeType, :tamanho, :duracao,
            :hash, :origem, :clienteId, :campanhaId, :avaliadoId,
            :userId, :status, :transcrever)`,
        {
          nome: arquivo.nome,
          storagePath: arquivo.storagePath ?? null,
          mimeType: arquivo.mimeType ?? null,
          tamanho: arquivo.tamanho ?? null,
          duracao: arquivo.duracaoSegundos ?? null,
          hash: arquivo.hash ?? null,
          origem,
          clienteId,
          campanhaId,
          avaliadoId,
          userId: userId ?? null,
          status: statusInicial,
          transcrever: transcreverAutomatico ? 1 : 0,
        },
      );

      const gravacaoId = insercao.insertId;

      // A linha em `transcricoes` nasce 'pendente' e é o item de trabalho do
      // transcritor. Sem ela a gravação ficaria marcada como na fila sem que
      // exista fila nenhuma.
      if (transcreverAutomatico) {
        await connection.execute(
          `INSERT INTO transcricoes (gravacao_id, status)
           VALUES (:gravacaoId, 'pendente')`,
          { gravacaoId },
        );
      }

      return {
        id: String(gravacaoId),
        arquivo: arquivo.nome,
        status: statusInicial,
        duplicada: false,
      };
    });

    resultados.push(resultado);
  }

  return resultados;
}

export async function concluirAnaliseGravacao({
  gravacaoId,
  texto,
  modelo = null,
  confianca = null,
  segmentosJson = null,
}) {
  await transaction(async (connection) => {
    const [transcricoes] = await connection.execute(
      `SELECT id
         FROM transcricoes
        WHERE gravacao_id = :gravacaoId
        ORDER BY id DESC
        LIMIT 1`,
      { gravacaoId },
    );

    if (transcricoes.length > 0) {
      await connection.execute(
        `UPDATE transcricoes
            SET modelo = :modelo,
                texto = :texto,
                segmentos_json = :segmentosJson,
                confianca = :confianca,
                status = 'concluida',
                erro_mensagem = NULL
          WHERE id = :id`,
        {
          id: transcricoes[0].id,
          modelo,
          texto,
          segmentosJson,
          confianca,
        },
      );
    } else {
      await connection.execute(
        `INSERT INTO transcricoes (gravacao_id, modelo, texto, segmentos_json, confianca, status)
         VALUES (:gravacaoId, :modelo, :texto, :segmentosJson, :confianca, 'concluida')`,
        { gravacaoId, modelo, texto, segmentosJson, confianca },
      );
    }

    await connection.execute(
      `UPDATE gravacoes
          SET status_transcricao = 'concluida'
        WHERE id = :gravacaoId`,
      { gravacaoId },
    );
  });
}

export async function registrarErroAnaliseGravacao({ gravacaoId, erro }) {
  await transaction(async (connection) => {
    await connection.execute(
      `INSERT INTO transcricoes (gravacao_id, status, erro_mensagem)
       VALUES (:gravacaoId, 'erro', :erro)`,
      { gravacaoId, erro: String(erro || "Erro ao processar arquivo.").slice(0, 500) },
    );
    await connection.execute(
      `UPDATE gravacoes
          SET status_transcricao = 'erro'
        WHERE id = :gravacaoId`,
      { gravacaoId },
    );
  });
}
