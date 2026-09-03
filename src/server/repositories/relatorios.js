import { isMissingSchemaError, one, paraLike, query } from "../db";
import { AppError, badRequest, notFound } from "../errors";
import { inteiro } from "../format";
import {
  AVALIADORES_INICIAIS,
  AVALIADOS_INICIAIS,
  CAMPANHAS_INICIAIS,
  CATEGORIAS_INICIAIS,
  OPERACOES_AVALIACAO_INICIAIS,
} from "../catalogo-inicial";

export const FORMATOS = ["tela", "excel", "csv"];

// Teto de linhas por página. O print avisa que "esta base contém milhares de
// registros"; sem teto, um "Carregar tudo" em Base de Monitoria devolve a
// tabela inteira num JSON e derruba o processo antes de chegar ao navegador.
export const LIMITE_MAXIMO = 1000;
export const LIMITE_PADRAO = 100;

/**
 * Traduz um filtro da requisição em condição SQL.
 *
 * `expr` vem SEMPRE do mapa de definição do relatório (constante deste
 * módulo); o valor vai como parâmetro nomeado. Nenhum pedaço de SQL é montado
 * com texto vindo do cliente.
 */
function montarWhere(filtros = {}, mapa = {}) {
  const condicoes = [];
  const params = {};

  for (const [chave, config] of Object.entries(mapa)) {
    const valor = filtros[chave];
    if (valor == null || valor === "") continue;

    const nome = `f_${chave}`;
    if (config.tipo === "like") {
      condicoes.push(`${config.expr} LIKE :${nome}`);
      params[nome] = paraLike(valor);
    } else if (config.tipo === "dataInicio") {
      condicoes.push(`${config.expr} >= :${nome}`);
      params[nome] = `${valor} 00:00:00`;
    } else if (config.tipo === "dataFim") {
      condicoes.push(`${config.expr} <= :${nome}`);
      params[nome] = `${valor} 23:59:59`;
    } else {
      condicoes.push(`${config.expr} = :${nome}`);
      params[nome] = valor;
    }
  }

  return {
    clausula: condicoes.length > 0 ? `AND ${condicoes.join("\n            AND ")}` : "",
    params,
    aplicados: condicoes.length,
  };
}

// Filtros que a tela oferece para os relatórios que partem de `avaliacoes`.
const FILTROS_AVALIACAO = {
  clienteId: { expr: "a.cliente_id" },
  campanhaId: { expr: "a.campanha_id" },
  avaliadoId: { expr: "a.avaliado_id" },
  avaliadorId: { expr: "a.avaliador_id" },
  categoriaId: { expr: "a.categoria_id" },
  codigo: { expr: "a.codigo", tipo: "like" },
  dataInicio: { expr: "a.data_avaliacao", tipo: "dataInicio" },
  dataFim: { expr: "a.data_avaliacao", tipo: "dataFim" },
};

const JOINS_AVALIACAO = `
         JOIN clientes cl ON cl.id = a.cliente_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
         JOIN formularios f ON f.id = a.formulario_id
         JOIN users av ON av.id = a.avaliado_id
         JOIN users mo ON mo.id = a.avaliador_id
         LEFT JOIN users su ON su.id = a.supervisor_id`;

function coluna(chave, titulo, tipo = "texto") {
  return { chave, titulo, tipo };
}

// ---------------------------------------------------------------------------
// Definições dos relatórios
//
// Cada definição entrega o SQL SEM ORDER BY e SEM LIMIT. A paginação e a
// contagem são montadas em volta pelo executor: a contagem é
// `SELECT COUNT(*) FROM (<sql>) sub`, o que funciona tanto para as consultas
// simples quanto para as agregadas.
// ---------------------------------------------------------------------------
const DEFINICOES = {
  "base-monitoria": {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "a.data_avaliacao DESC, a.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cod_gravacao", "Cód. gravação"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("formulario", "Formulário"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Avaliador"),
      coluna("supervisor", "Superior"),
      coluna("categoria", "Categoria"),
      coluna("origem", "Origem"),
      coluna("score", "Score", "numero"),
      coluna("zerada", "Zerada", "booleano"),
      coluna("quadrante", "Quadrante"),
      coluna("duracao_segundos", "Duração (s)", "numero"),
      coluna("data_contato", "Data contato", "dataHora"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("status_feedback", "Status feedback"),
      coluna("total_conformes", "Conformes", "numero"),
      coluna("total_nao_conformes", "Não conformes", "numero"),
      coluna("total_nao_aplicaveis", "Não aplicáveis", "numero"),
      coluna("total_criterios", "Critérios", "numero"),
    ],
    sql: (where) => `
      SELECT a.codigo, a.cod_gravacao, cl.nome AS cliente, ca.nome AS campanha,
             f.nome AS formulario, av.name AS avaliado, mo.name AS avaliador,
             su.name AS supervisor, a.categoria, a.origem, a.score, a.zerada,
             a.quadrante, a.duracao_segundos, a.data_contato, a.data_avaliacao,
             a.status_feedback, a.total_conformes, a.total_nao_conformes,
             a.total_nao_aplicaveis, a.total_criterios
        FROM avaliacoes a
        ${JOINS_AVALIACAO}
       WHERE a.excluida_em IS NULL
         ${where}`,
  },

  // Mesmo recorte da Base de Monitoria, restrito a `origem = 'ia'`. A gestão
  // de personas saiu do escopo, então não há nome de persona nem modelo/custo
  // para mostrar: o que identifica a ficha automática é a origem.
  "base-monitoria-ia": {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "a.data_avaliacao DESC, a.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cod_gravacao", "Cód. gravação"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("formulario", "Formulário"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Responsável"),
      coluna("score", "Score", "numero"),
      coluna("zerada", "Zerada", "booleano"),
      coluna("duracao_segundos", "Duração (s)", "numero"),
      coluna("data_contato", "Data contato", "dataHora"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("status_feedback", "Status feedback"),
      coluna("total_conformes", "Conformes", "numero"),
      coluna("total_nao_conformes", "Não conformes", "numero"),
      coluna("total_criterios", "Critérios", "numero"),
    ],
    sql: (where) => `
      SELECT a.codigo, a.cod_gravacao, cl.nome AS cliente, ca.nome AS campanha,
             f.nome AS formulario, av.name AS avaliado, mo.name AS avaliador,
             a.score, a.zerada, a.duracao_segundos, a.data_contato,
             a.data_avaliacao, a.status_feedback, a.total_conformes,
             a.total_nao_conformes, a.total_criterios
        FROM avaliacoes a
        ${JOINS_AVALIACAO}
       WHERE a.excluida_em IS NULL
         AND a.origem = 'ia'
         ${where}`,
  },

  usuarios: {
    filtros: {
      clienteId: { expr: "u.cliente_id" },
      cargoId: { expr: "u.cargo_id" },
      papel: { expr: "u.role" },
      ativo: { expr: "u.active" },
      busca: { expr: "u.name", tipo: "like" },
    },
    ordenacao: "u.name",
    colunas: [
      coluna("nome", "Nome"),
      coluna("email", "E-mail"),
      coluna("papel", "Papel"),
      coluna("cargo", "Cargo"),
      coluna("cliente", "Cliente"),
      coluna("turno", "Turno"),
      coluna("superior", "Superior"),
      coluna("matricula", "Matrícula"),
      coluna("ativo", "Ativo", "booleano"),
      coluna("ultimo_acesso_em", "Último acesso", "dataHora"),
      coluna("created_at", "Criado em", "dataHora"),
    ],
    sql: (where) => `
      SELECT u.name AS nome, u.email, u.role AS papel, c.nome AS cargo,
             cl.nome AS cliente, t.nome AS turno, s.name AS superior,
             u.external_code AS matricula, u.active AS ativo,
             u.ultimo_acesso_em, u.created_at
        FROM users u
        LEFT JOIN cargos c ON c.id = u.cargo_id
        LEFT JOIN clientes cl ON cl.id = u.cliente_id
        LEFT JOIN turnos t ON t.id = u.turno_id
        LEFT JOIN users s ON s.id = u.supervisor_id
       WHERE 1 = 1
         ${where}`,
  },

  "fichas-avaliacao": {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "a.data_avaliacao DESC, a.id DESC, s.posicao, cr.posicao",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Avaliador"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("secao", "Seção"),
      coluna("criterio", "Critério"),
      coluna("eliminatoria", "Eliminatório", "booleano"),
      coluna("peso_pts", "Peso", "numero"),
      coluna("resposta", "Resposta"),
      coluna("status", "Status"),
      coluna("peso_aplicado", "Peso aplicado", "numero"),
      coluna("observacao_monitor", "Justificativa do monitor"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, ca.nome AS campanha, av.name AS avaliado,
             mo.name AS avaliador, a.data_avaliacao, s.nome AS secao,
             cr.nome AS criterio, cr.eliminatoria, cr.peso_pts,
             r.resposta, r.status, r.peso_aplicado, r.observacao_monitor,
             s.posicao AS secao_posicao, cr.posicao AS criterio_posicao
        FROM avaliacao_respostas r
        JOIN avaliacoes a ON a.id = r.avaliacao_id
        ${JOINS_AVALIACAO}
        JOIN formulario_criterios cr ON cr.id = r.criterio_id
        JOIN formulario_secoes s ON s.id = cr.secao_id
       WHERE a.excluida_em IS NULL
         ${where}`,
  },

  contestacoes: {
    filtros: {
      clienteId: { expr: "a.cliente_id" },
      campanhaId: { expr: "a.campanha_id" },
      avaliadoId: { expr: "a.avaliado_id" },
      avaliadorId: { expr: "a.avaliador_id" },
      codigo: { expr: "a.codigo", tipo: "like" },
      status: { expr: "c.status" },
      dataInicio: { expr: "c.created_at", tipo: "dataInicio" },
      dataFim: { expr: "c.created_at", tipo: "dataFim" },
    },
    ordenacao: "c.created_at DESC, c.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Monitor"),
      coluna("status", "Status"),
      coluna("resultado", "Resultado"),
      coluna("itens", "Itens contestados", "numero"),
      coluna("motivo", "Motivo"),
      coluna("parecer", "Parecer"),
      coluna("score_anterior", "Score anterior", "numero"),
      coluna("score_final", "Score final", "numero"),
      coluna("aberta_por", "Aberta por"),
      coluna("created_at", "Aberta em", "dataHora"),
      coluna("prazo_julgamento", "Prazo julgamento", "data"),
      coluna("julgada_por", "Julgada por"),
      coluna("julgada_em", "Julgada em", "dataHora"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, ca.nome AS campanha, av.name AS avaliado,
             mo.name AS avaliador, c.status, c.resultado, c.motivo, c.parecer,
             c.score_anterior, c.score_final, ab.name AS aberta_por, c.created_at,
             c.prazo_julgamento, ju.name AS julgada_por, c.julgada_em,
             (SELECT COUNT(*) FROM contestacao_itens ci WHERE ci.contestacao_id = c.id) AS itens
        FROM contestacoes c
        JOIN avaliacoes a ON a.id = c.avaliacao_id
        ${JOINS_AVALIACAO}
        JOIN users ab ON ab.id = c.aberta_por_id
        LEFT JOIN users ju ON ju.id = c.julgada_por_id
       WHERE a.excluida_em IS NULL
         ${where}`,
  },

  "monitoria-analitico": {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "competencia DESC, cliente, campanha",
    colunas: [
      coluna("competencia", "Competência"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliacoes", "Avaliações", "numero"),
      coluna("score_medio", "Score médio", "numero"),
      coluna("zeradas", "Zeradas", "numero"),
      coluna("feedback_pendente", "Feedback pendente", "numero"),
      coluna("feedback_finalizado", "Feedback finalizado", "numero"),
    ],
    sql: (where) => `
      SELECT DATE_FORMAT(a.data_avaliacao, '%Y-%m') AS competencia,
             cl.nome AS cliente, ca.nome AS campanha,
             COUNT(*) AS avaliacoes,
             ROUND(AVG(a.score), 2) AS score_medio,
             SUM(a.zerada) AS zeradas,
             SUM(a.status_feedback = 'pendente') AS feedback_pendente,
             SUM(a.status_feedback IN ('concluida', 'justificada')) AS feedback_finalizado
        FROM avaliacoes a
        JOIN clientes cl ON cl.id = a.cliente_id
        LEFT JOIN campanhas ca ON ca.id = a.campanha_id
       WHERE a.excluida_em IS NULL
         ${where}
       GROUP BY DATE_FORMAT(a.data_avaliacao, '%Y-%m'), cl.nome, ca.nome`,
  },

  "monitoria-detalhada": {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "data_avaliacao DESC, codigo DESC, secao",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Avaliador"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("score", "Score da ficha", "numero"),
      coluna("secao", "Seção"),
      coluna("criterios", "Critérios", "numero"),
      coluna("conformes", "Conformes", "numero"),
      coluna("nao_conformes", "Não conformes", "numero"),
      coluna("nao_aplicaveis", "Não aplicáveis", "numero"),
      coluna("pontos", "Pontos na seção", "numero"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, ca.nome AS campanha, av.name AS avaliado,
             mo.name AS avaliador, a.data_avaliacao, a.score, s.nome AS secao,
             COUNT(*) AS criterios,
             SUM(r.status = 'conforme') AS conformes,
             SUM(r.status = 'nao_conforme') AS nao_conformes,
             SUM(r.status = 'nao_aplicavel') AS nao_aplicaveis,
             COALESCE(SUM(r.peso_aplicado), 0) AS pontos
        FROM avaliacao_respostas r
        JOIN avaliacoes a ON a.id = r.avaliacao_id
        ${JOINS_AVALIACAO}
        JOIN formulario_criterios cr ON cr.id = r.criterio_id
        JOIN formulario_secoes s ON s.id = cr.secao_id
       WHERE a.excluida_em IS NULL
         ${where}
       GROUP BY a.id, a.codigo, cl.nome, ca.nome, av.name, mo.name,
                a.data_avaliacao, a.score, s.id, s.nome, s.posicao`,
  },

  "pesquisa-satisfacao": {
    filtros: {
      clienteId: { expr: "a.cliente_id" },
      campanhaId: { expr: "a.campanha_id" },
      avaliadoId: { expr: "a.avaliado_id" },
      codigo: { expr: "a.codigo", tipo: "like" },
      dataInicio: { expr: "p.respondido_em", tipo: "dataInicio" },
      dataFim: { expr: "p.respondido_em", tipo: "dataFim" },
    },
    ordenacao: "p.respondido_em DESC, p.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("avaliado", "Avaliado"),
      coluna("status_feedback", "Status do feedback"),
      coluna("nota", "Nota", "numero"),
      coluna("concorda", "Concorda", "booleano"),
      coluna("comentario", "Comentário"),
      coluna("respondido_por", "Respondido por"),
      coluna("respondido_em", "Respondido em", "dataHora"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, av.name AS avaliado,
             fb.status AS status_feedback, p.nota, p.concorda, p.comentario,
             ru.name AS respondido_por, p.respondido_em
        FROM feedback_pesquisas p
        JOIN feedbacks fb ON fb.id = p.feedback_id
        JOIN avaliacoes a ON a.id = fb.avaliacao_id
        JOIN clientes cl ON cl.id = a.cliente_id
        JOIN users av ON av.id = a.avaliado_id
        LEFT JOIN users ru ON ru.id = p.respondido_por_id
       WHERE a.excluida_em IS NULL
         ${where}`,
  },

  justificativas: {
    filtros: FILTROS_AVALIACAO,
    ordenacao: "a.data_avaliacao DESC, a.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("cliente", "Cliente"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Avaliador"),
      coluna("formulario", "Formulário"),
      coluna("secao", "Seção"),
      coluna("criterio", "Critério"),
      coluna("status", "Status"),
      coluna("observacao_monitor", "Justificativa"),
    ],
    sql: (where) => `
      SELECT a.codigo, a.data_avaliacao, cl.nome AS cliente, av.name AS avaliado,
             mo.name AS avaliador, f.nome AS formulario, s.nome AS secao,
             cr.nome AS criterio, r.status, r.observacao_monitor
        FROM avaliacao_respostas r
        JOIN avaliacoes a ON a.id = r.avaliacao_id
        ${JOINS_AVALIACAO}
        JOIN formulario_criterios cr ON cr.id = r.criterio_id
        JOIN formulario_secoes s ON s.id = cr.secao_id
       WHERE a.excluida_em IS NULL
         AND r.observacao_monitor IS NOT NULL
         AND r.observacao_monitor <> ''
         ${where}`,
  },

  "fichas-excluidas": {
    filtros: {
      clienteId: { expr: "a.cliente_id" },
      campanhaId: { expr: "a.campanha_id" },
      avaliadoId: { expr: "a.avaliado_id" },
      avaliadorId: { expr: "a.avaliador_id" },
      codigo: { expr: "a.codigo", tipo: "like" },
      dataInicio: { expr: "a.excluida_em", tipo: "dataInicio" },
      dataFim: { expr: "a.excluida_em", tipo: "dataFim" },
    },
    ordenacao: "a.excluida_em DESC, a.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliado", "Avaliado"),
      coluna("avaliador", "Avaliador"),
      coluna("data_avaliacao", "Data avaliação", "dataHora"),
      coluna("score", "Score", "numero"),
      coluna("avulsa", "Avulsa", "booleano"),
      coluna("excluida_em", "Excluída em", "dataHora"),
      coluna("excluida_por", "Excluída por"),
      coluna("exclusao_motivo", "Motivo"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, ca.nome AS campanha, av.name AS avaliado,
             mo.name AS avaliador, a.data_avaliacao, a.score, a.avulsa,
             a.excluida_em, ex.name AS excluida_por, a.exclusao_motivo
        FROM avaliacoes a
        ${JOINS_AVALIACAO}
        LEFT JOIN users ex ON ex.id = a.excluida_por_id
       WHERE (a.excluida_em IS NOT NULL OR a.avulsa = 1)
         ${where}`,
  },

  "ausencia-monitoria": {
    filtros: {
      clienteId: { expr: "j.cliente_id" },
      campanhaId: { expr: "j.campanha_id" },
      avaliadoId: { expr: "j.avaliado_id" },
      motivoId: { expr: "j.motivo_id" },
      dataInicio: { expr: "j.created_at", tipo: "dataInicio" },
      dataFim: { expr: "j.created_at", tipo: "dataFim" },
    },
    ordenacao: "j.competencia DESC, j.created_at DESC",
    colunas: [
      coluna("competencia", "Competência", "data"),
      coluna("cliente", "Cliente"),
      coluna("campanha", "Campanha"),
      coluna("avaliado", "Avaliado"),
      coluna("motivo", "Motivo"),
      coluna("texto", "Detalhe"),
      coluna("criado_por", "Registrado por"),
      coluna("created_at", "Registrado em", "dataHora"),
    ],
    sql: (where) => `
      SELECT j.competencia, cl.nome AS cliente, ca.nome AS campanha,
             av.name AS avaliado, jm.nome AS motivo, j.texto,
             cr.name AS criado_por, j.created_at
        FROM justificativas j
        LEFT JOIN justificativa_motivos jm ON jm.id = j.motivo_id
        LEFT JOIN clientes cl ON cl.id = j.cliente_id
        LEFT JOIN campanhas ca ON ca.id = j.campanha_id
        LEFT JOIN users av ON av.id = j.avaliado_id
        LEFT JOIN users cr ON cr.id = j.criado_por_id
       WHERE j.escopo = 'ausencia_monitoria'
         ${where}`,
  },

  "monitoria-editada": {
    filtros: {
      clienteId: { expr: "a.cliente_id" },
      campanhaId: { expr: "a.campanha_id" },
      avaliadoId: { expr: "a.avaliado_id" },
      codigo: { expr: "a.codigo", tipo: "like" },
      dataInicio: { expr: "e.created_at", tipo: "dataInicio" },
      dataFim: { expr: "e.created_at", tipo: "dataFim" },
    },
    ordenacao: "e.created_at DESC, e.id DESC",
    colunas: [
      coluna("codigo", "ID Monitoria"),
      coluna("cliente", "Cliente"),
      coluna("avaliado", "Avaliado"),
      coluna("campo", "Campo"),
      coluna("valor_anterior", "Valor anterior"),
      coluna("valor_novo", "Valor novo"),
      coluna("motivo", "Motivo"),
      coluna("editado_por", "Editado por"),
      coluna("created_at", "Editado em", "dataHora"),
    ],
    sql: (where) => `
      SELECT a.codigo, cl.nome AS cliente, av.name AS avaliado, e.campo,
             e.valor_anterior, e.valor_novo, e.motivo, u.name AS editado_por,
             e.created_at
        FROM avaliacao_edicoes e
        JOIN avaliacoes a ON a.id = e.avaliacao_id
        JOIN clientes cl ON cl.id = a.cliente_id
        JOIN users av ON av.id = a.avaliado_id
        LEFT JOIN users u ON u.id = e.editado_por_id
       WHERE 1 = 1
         ${where}`,
  },

  "extracao-campanhas": {
    filtros: {
      clienteId: { expr: "cl.id" },
      canal: { expr: "ca.canal" },
    },
    ordenacao: "cliente, campanha",
    colunas: [
      coluna("cliente", "Cliente"),
      coluna("contrato", "Contrato"),
      coluna("cliente_ativo", "Cliente ativo", "booleano"),
      coluna("campanha", "Campanha"),
      coluna("canal", "Canal"),
      coluna("campanha_ativa", "Campanha ativa", "booleano"),
      coluna("favorita", "Favorita", "booleano"),
      coluna("avaliacoes", "Avaliações", "numero"),
    ],
    sql: (where) => `
      SELECT cl.nome AS cliente, cl.contrato, cl.ativo AS cliente_ativo,
             ca.nome AS campanha, ca.canal, ca.ativa AS campanha_ativa, ca.favorita,
             (SELECT COUNT(*) FROM avaliacoes a
               WHERE a.campanha_id = ca.id AND a.excluida_em IS NULL) AS avaliacoes
        FROM clientes cl
        LEFT JOIN campanhas ca ON ca.cliente_id = cl.id
       WHERE 1 = 1
         ${where}`,
  },

  // A Sala de Calibração ainda não tem tabelas no schema; o tipo fica no
  // catálogo (a tela lista ele) mas a execução responde 501 em vez de
  // devolver tabela vazia fingindo que não há sessão de calibração.
  "analitico-calibracao": {
    indisponivel:
      "Relatório de calibração ainda não implementado: o módulo Sala de Calibração não tem tabelas no banco.",
  },
};

// Relatórios que não precisam de filtro obrigatório porque a base é pequena
// por natureza.
const SEM_FILTRO_OBRIGATORIO = new Set(["extracao-campanhas", "usuarios"]);

export function definicaoRelatorio(slug) {
  return DEFINICOES[slug] || null;
}

/** Catálogo da coluna esquerda da tela, com a estrela do usuário logado. */
export async function listarTiposRelatorio(userId) {
  try {
    const rows = await query(
      `SELECT t.id, t.slug, t.nome, t.descricao, t.grupo, t.permissao_slug, t.posicao,
              CASE WHEN fv.user_id IS NULL THEN 0 ELSE 1 END AS favorito
         FROM relatorio_tipos t
         LEFT JOIN relatorio_favoritos fv
                ON fv.relatorio_tipo_id = t.id AND fv.user_id = :userId
        WHERE t.ativo = 1
        ORDER BY t.posicao, t.nome`,
      { userId },
    );

    return rows.map((row) => ({
      id: String(row.id),
      slug: row.slug,
      nome: row.nome,
      descricao: row.descricao,
      grupo: row.grupo,
      sistema: row.grupo === "sistema",
      ia: row.grupo === "ia",
      favorito: Boolean(row.favorito),
      permissao: row.permissao_slug || null,
      // Diz à tela se dá para clicar em "Consultar" ou se o tipo é só vitrine.
      disponivel: row.grupo === "ia" ? true : Boolean(DEFINICOES[row.slug]?.sql),
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}

/** Liga/desliga a estrela. Favorito é por usuário. */
export async function alternarFavorito({ userId, slug }) {
  const tipo = await one("SELECT id FROM relatorio_tipos WHERE slug = :slug LIMIT 1", { slug });
  if (!tipo) throw notFound("Relatório não encontrado.");

  const existente = await one(
    `SELECT user_id FROM relatorio_favoritos
      WHERE user_id = :userId AND relatorio_tipo_id = :tipoId LIMIT 1`,
    { userId, tipoId: tipo.id },
  );

  if (existente) {
    await query(
      `DELETE FROM relatorio_favoritos
        WHERE user_id = :userId AND relatorio_tipo_id = :tipoId`,
      { userId, tipoId: tipo.id },
    );
    return { slug, favorito: false };
  }

  await query(
    `INSERT INTO relatorio_favoritos (user_id, relatorio_tipo_id)
     VALUES (:userId, :tipoId)`,
    { userId, tipoId: tipo.id },
  );
  return { slug, favorito: true };
}

/** Opções dos dropdowns do painel de filtros. */
export async function listarOpcoesFiltro() {
  const [clientes, campanhas, avaliadores, avaliados, categorias] = await Promise.all([
    safeOpcoes(OPERACOES_AVALIACAO_INICIAIS.map((cliente) => ({ id: cliente.id, nome: cliente.nome })), () =>
      query("SELECT id, nome FROM clientes WHERE ativo = 1 ORDER BY nome"),
    ),
    safeOpcoes(CAMPANHAS_INICIAIS.map((nome, indice) => ({ id: `campanha-${indice + 1}`, nome, cliente_id: null })), () =>
      query(
        `SELECT ca.id, ca.nome, ca.cliente_id
           FROM campanhas ca
          WHERE ca.ativa = 1
          ORDER BY ca.nome`,
      ),
    ),
    safeOpcoes(AVALIADORES_INICIAIS.map((nome, indice) => ({ id: `avaliador-${indice + 1}`, nome })), () =>
      query(
        `SELECT id, name AS nome
           FROM users
          WHERE active = 1 AND role IN ('monitor', 'administrador', 'supervisor')
          ORDER BY name`,
      ),
    ),
    safeOpcoes(AVALIADOS_INICIAIS.map((nome, indice) => ({ id: `avaliado-${indice + 1}`, nome })), () =>
      query(
        `SELECT id, name AS nome
           FROM users
          WHERE active = 1 AND role = 'operador'
          ORDER BY name`,
      ),
    ),
    listarCategorias(),
  ]);

  return {
    clientes: clientes.map((row) => ({ id: String(row.id), nome: row.nome })),
    campanhas: campanhas.map((row) => ({
      id: String(row.id),
      nome: row.nome,
      clienteId: row.cliente_id == null ? null : String(row.cliente_id),
    })),
    avaliadores: avaliadores.map((row) => ({ id: String(row.id), nome: row.nome })),
    avaliados: avaliados.map((row) => ({ id: String(row.id), nome: row.nome })),
    categorias,
  };
}

async function listarCategorias() {
  try {
    const rows = await query(
      `SELECT id, nome FROM formulario_categorias WHERE ativo = 1 ORDER BY posicao, nome`,
    );
    const categorias = rows.map((row) => ({ id: String(row.id), nome: row.nome }));
    return categorias.length > 0
      ? categorias
      : CATEGORIAS_INICIAIS.map((nome, indice) => ({ id: `categoria-${indice + 1}`, nome }));
  } catch {
    return CATEGORIAS_INICIAIS.map((nome, indice) => ({ id: `categoria-${indice + 1}`, nome }));
  }
}

async function safeOpcoes(fallback, work) {
  try {
    const rows = await work();
    return rows.length > 0 ? rows : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Executa um relatório do catálogo.
 *
 * Regra de recurso: sem nenhum filtro, a consulta só roda com
 * `carregarTudo`. É o mesmo aviso da tela ("Para evitar carregar toda a base,
 * escolha pelo menos um filtro"), mas imposto no servidor — o aviso do
 * navegador não protege o banco.
 */
export async function executarRelatorio({
  slug,
  filtros = {},
  limit = LIMITE_PADRAO,
  offset = 0,
  carregarTudo = false,
  formato = "tela",
  userId = null,
}) {
  const definicao = DEFINICOES[slug];
  if (!definicao) throw notFound("Relatório não encontrado.");
  if (definicao.indisponivel) {
    throw new AppError(501, "not_implemented", definicao.indisponivel);
  }

  const where = montarWhere(filtros, definicao.filtros);
  if (where.aplicados === 0 && !carregarTudo && !SEM_FILTRO_OBRIGATORIO.has(slug)) {
    throw badRequest(
      "Aplique pelo menos um filtro ou confirme o carregamento total com carregarTudo=1.",
      { filtrosAceitos: Object.keys(definicao.filtros || {}) },
    );
  }

  const base = definicao.sql(where.clausula);
  const inicio = Date.now();

  try {
    const total = await one(`SELECT COUNT(*) AS total FROM (${base}) sub`, where.params);

    const linhas = await query(
      `${base}
       ORDER BY ${definicao.ordenacao}
       LIMIT :limit OFFSET :offset`,
      { ...where.params, limit, offset },
    );

    const resultado = {
      slug,
      colunas: definicao.colunas,
      linhas,
      paginacao: { limit, offset, total: inteiro(total?.total) },
      duracaoMs: Date.now() - inicio,
      filtrosAplicados: where.aplicados,
    };

    await registrarExecucao({
      slug,
      userId,
      filtros,
      formato,
      status: "concluida",
      linhas: linhas.length,
      duracaoMs: resultado.duracaoMs,
    });

    return resultado;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      // Relatório que depende de tabela da migration 003 antes de ela rodar.
      return {
        slug,
        colunas: definicao.colunas,
        linhas: [],
        paginacao: { limit, offset, total: 0 },
        duracaoMs: Date.now() - inicio,
        filtrosAplicados: where.aplicados,
        aviso: "Estruturas deste relatório ainda não existem no banco. Rode a migration 003.",
      };
    }

    await registrarExecucao({
      slug,
      userId,
      filtros,
      formato,
      status: "erro",
      duracaoMs: Date.now() - inicio,
      // Mensagem do driver fica no histórico interno, nunca na resposta HTTP.
      erro: String(error?.sqlMessage || error?.message || error).slice(0, 500),
    });

    throw error;
  }
}

// Histórico de execução/exportação. Nunca derruba a requisição: se o registro
// falhar, o relatório do usuário já foi entregue e não faz sentido perdê-lo.
async function registrarExecucao({
  slug,
  userId,
  filtros,
  formato,
  status,
  linhas = null,
  duracaoMs = null,
  erro = null,
}) {
  try {
    await query(
      `INSERT INTO relatorio_execucoes
         (relatorio_tipo_id, user_id, filtros_json, formato, status, linhas, duracao_ms, erro_mensagem)
       SELECT t.id, :userId, :filtros, :formato, :status, :linhas, :duracaoMs, :erro
         FROM relatorio_tipos t
        WHERE t.slug = :slug`,
      {
        userId,
        filtros: JSON.stringify(filtros ?? {}),
        formato,
        status,
        linhas,
        duracaoMs,
        erro,
        slug,
      },
    );
  } catch (error) {
    if (isMissingSchemaError(error)) return;
    console.error(
      JSON.stringify({
        level: "warn",
        message: "Falha ao registrar execução de relatório",
        slug,
        error: String(error?.code || error?.message || error),
      }),
    );
  }
}
