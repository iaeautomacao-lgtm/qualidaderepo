import { isMissingSchemaError, one, paraLike, query } from "../db";
import { conflict, notFound } from "../errors";
import { formatarDataIso, inteiro } from "../format";

/**
 * Catálogo de formulários da tela "Gerenciamento de Formulários".
 *
 * Separado de `catalog.js` porque ali `getFormulariosOverview` responde outra
 * pergunta: são os KPIs e os 20 mais recentes do painel. Esta tela precisa da
 * lista inteira, filtrável, com o cadastro completo de cada formulário.
 */

export const STATUS_FORMULARIO = ["ativo", "rascunho", "desenvolvimento", "inativo"];
export const CATEGORIAS_FORMULARIO = ["padrao", "diagnostico"];
export const TIPOS_CALCULO = ["sessao", "criterio"];

const LABEL_STATUS = {
  ativo: "Ativo",
  rascunho: "Rascunho",
  desenvolvimento: "Em desenvolvimento",
  inativo: "Inativo",
};

const LABEL_CATEGORIA = {
  padrao: "Padrão",
  diagnostico: "Diagnóstico",
};

/**
 * Os dois modos do bloco "Tipo de Cálculo".
 *
 * O texto de cada um descreve o que o modo SIGNIFICA, não o que o sistema faz
 * hoje — a nota segue uma fórmula única, e a tela diz isso em voz alta. Ver o
 * cabeçalho da migration 008.
 */
export const MODOS_CALCULO = [
  {
    id: "sessao",
    rotulo: "Sessão",
    titulo: "Soma das seções",
    descricao: "Soma total das notas das seções.",
    exemplo: "Ex: Seção A (80) + Seção B (90) = 170 pontos",
  },
  {
    id: "criterio",
    rotulo: "Critério",
    titulo: "Soma dos critérios",
    descricao: "Soma todos os pontos dos critérios da seção.",
    exemplo: "Ex: A (10) + B (8) = 18 pontos",
  },
];

const cacheColunas = new Map();

/** Coluna presente? Memoizado. Nome de tabela e coluna são literais do módulo. */
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

function montarFiltros(filtros = {}) {
  const condicoes = [];
  const params = {};

  if (filtros.clienteId) {
    condicoes.push("f.cliente_id = :clienteId");
    params.clienteId = filtros.clienteId;
  }
  if (filtros.categoria) {
    condicoes.push("f.categoria = :categoria");
    params.categoria = filtros.categoria;
  }
  if (filtros.status) {
    condicoes.push("f.status = :status");
    params.status = filtros.status;
  }
  // Caixa "Buscar formulário...": nome e cliente. Descrição fica fora de
  // propósito — texto de 3 linhas dá casamento por palavra solta e a lista
  // devolveria formulário que quem buscou não reconhece.
  if (filtros.busca) {
    condicoes.push("(f.nome LIKE :busca OR cl.nome LIKE :busca)");
    params.busca = paraLike(filtros.busca);
  }

  return {
    where: condicoes.length > 0 ? `WHERE ${condicoes.join("\n          AND ")}` : "",
    params,
  };
}

const VAZIO = {
  itens: [],
  contadores: { total: 0, ativos: 0, rascunhos: 0, inativos: 0, perguntas: 0 },
  opcoes: { clientes: [], categorias: [], status: [] },
  modosCalculo: MODOS_CALCULO,
  cadastroCompleto: false,
};

/**
 * Lista os formulários com o cadastro que o cartão mostra.
 *
 * Uma query por informação de conjunto: contagem de perguntas e nomes de
 * campanha saem de agregação na mesma consulta, porque a alternativa — uma
 * consulta por formulário — são 40 idas ao banco numa tela de 40 cartões.
 */
export async function listarFormularios({ filtros = {} } = {}) {
  const [temDescricao, temTipoCalculo] = await Promise.all([
    temColuna("formularios", "descricao"),
    temColuna("formularios", "tipo_calculo"),
  ]);

  const { where, params } = montarFiltros(filtros);

  try {
    const rows = await query(
      `SELECT
          f.id,
          f.nome,
          ${temDescricao ? "f.descricao" : "NULL AS descricao"},
          f.categoria,
          ${temTipoCalculo ? "f.tipo_calculo" : "NULL AS tipo_calculo"},
          f.status,
          f.versao,
          f.created_at,
          f.updated_at,
          f.cliente_id,
          cl.nome AS cliente,
          GROUP_CONCAT(DISTINCT ca.nome ORDER BY ca.nome SEPARATOR ', ') AS campanhas,
          COUNT(DISTINCT s.id)  AS secoes,
          COUNT(DISTINCT cr.id) AS perguntas
         FROM formularios f
         LEFT JOIN clientes cl ON cl.id = f.cliente_id
         LEFT JOIN formulario_campanhas fc ON fc.formulario_id = f.id
         LEFT JOIN campanhas ca ON ca.id = fc.campanha_id
         LEFT JOIN formulario_secoes s ON s.formulario_id = f.id
         LEFT JOIN formulario_criterios cr ON cr.secao_id = s.id
         ${where}
        GROUP BY f.id
        ORDER BY f.updated_at DESC, f.id DESC`,
      params,
    );

    // Contadores do recorte inteiro — derivados das linhas, não de uma segunda
    // query: a lista não é paginada, então ela JÁ é o recorte todo.
    const contadores = {
      total: rows.length,
      ativos: rows.filter((row) => row.status === "ativo").length,
      rascunhos: rows.filter((row) => row.status === "rascunho").length,
      inativos: rows.filter((row) => row.status === "inativo").length,
      perguntas: rows.reduce((soma, row) => soma + inteiro(row.perguntas), 0),
    };

    return {
      itens: rows.map((row) => ({
        id: String(row.id),
        nome: row.nome,
        descricao: row.descricao || null,
        categoria: row.categoria,
        categoriaLabel: LABEL_CATEGORIA[row.categoria] || row.categoria,
        // Sem a 008 o cartão não mostra o bloco; com ela, o default do banco
        // ('criterio') é o que a conta atual faz.
        tipoCalculo: row.tipo_calculo || null,
        status: row.status,
        statusLabel: LABEL_STATUS[row.status] || row.status,
        versao: inteiro(row.versao, 1),
        clienteId: row.cliente_id == null ? null : String(row.cliente_id),
        cliente: row.cliente || "Sem cliente",
        // String vazia do GROUP_CONCAT quando não há vínculo: virar `null` deixa
        // a tela decidir o texto em vez de mostrar "Campanhas: ".
        campanhas: row.campanhas || null,
        secoes: inteiro(row.secoes),
        perguntas: inteiro(row.perguntas),
        criadoEm: formatarDataIso(row.created_at),
        editadoEm: formatarDataIso(row.updated_at),
      })),
      contadores,
      opcoes: {
        // Opções derivadas das linhas: são os clientes que TÊM formulário, que é
        // o que faz sentido filtrar aqui.
        clientes: [
          ...new Map(
            rows
              .filter((row) => row.cliente_id != null)
              .map((row) => [String(row.cliente_id), { id: String(row.cliente_id), nome: row.cliente }]),
          ).values(),
        ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        categorias: CATEGORIAS_FORMULARIO.map((id) => ({ id, nome: LABEL_CATEGORIA[id] })),
        status: STATUS_FORMULARIO.map((id) => ({ id, nome: LABEL_STATUS[id] })),
      },
      modosCalculo: MODOS_CALCULO,
      // A tela usa isto para decidir se mostra descrição e tipo de cálculo, ou
      // um aviso de migration pendente.
      cadastroCompleto: temDescricao && temTipoCalculo,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return VAZIO;
    return VAZIO;
  }
}

/**
 * Edita o cadastro do formulário: descrição, tipo de cálculo e status.
 *
 * Só estes três. Seções e critérios não entram: mudar peso de formulário que já
 * tem monitoria lançada mudaria a régua sem recalcular as notas antigas, e isso
 * é uma operação de versionamento (a tabela tem `versao` para isso), não de
 * edição em linha.
 */
export async function atualizarFormulario({ id, descricao, tipoCalculo, status }) {
  const [temDescricao, temTipoCalculo] = await Promise.all([
    temColuna("formularios", "descricao"),
    temColuna("formularios", "tipo_calculo"),
  ]);

  const formulario = await one("SELECT id FROM formularios WHERE id = :id LIMIT 1", { id });
  if (!formulario) throw notFound("Formulário não encontrado.");

  const campos = [];
  const params = { id };

  if (descricao !== undefined) {
    if (!temDescricao) {
      throw conflict(
        "A descrição do formulário ainda não está disponível neste banco. Rode a migration 008_formulario_descricao_e_tipo_calculo.sql.",
      );
    }
    campos.push("descricao = :descricao");
    params.descricao = descricao;
  }

  if (tipoCalculo !== undefined) {
    if (!temTipoCalculo) {
      throw conflict(
        "O tipo de cálculo ainda não está disponível neste banco. Rode a migration 008_formulario_descricao_e_tipo_calculo.sql.",
      );
    }
    campos.push("tipo_calculo = :tipoCalculo");
    params.tipoCalculo = tipoCalculo;
  }

  if (status !== undefined) {
    campos.push("status = :status");
    params.status = status;
  }

  if (campos.length === 0) throw conflict("Nada para alterar.");

  await query(`UPDATE formularios SET ${campos.join(", ")} WHERE id = :id`, params);

  return { id: String(id) };
}

/**
 * Exclui o formulário.
 *
 * Mesma política do resto do sistema: formulário com monitoria lançada é
 * DESATIVADO, não apagado. `avaliacoes.formulario_id` não tem cascade, e apagar
 * levaria as fichas daquela carteira — que são o histórico de qualidade dela.
 *
 * Formulário sem nenhuma avaliação é apagado de verdade: cadastro errado feito
 * há cinco minutos não precisa virar linha inativa para sempre.
 */
export async function excluirFormulario(id) {
  const formulario = await one(
    `SELECT f.id, f.nome, f.status,
            (SELECT COUNT(*) FROM avaliacoes a WHERE a.formulario_id = f.id) AS avaliacoes
       FROM formularios f
      WHERE f.id = :id
      LIMIT 1`,
    { id },
  );

  if (!formulario) throw notFound("Formulário não encontrado.");

  const usos = inteiro(formulario.avaliacoes);

  if (usos > 0) {
    if (formulario.status === "inativo") {
      return {
        id: String(formulario.id),
        nome: formulario.nome,
        acao: "desativado",
        avaliacoes: usos,
        jaEstava: true,
      };
    }

    await query("UPDATE formularios SET status = 'inativo' WHERE id = :id", { id });
    return {
      id: String(formulario.id),
      nome: formulario.nome,
      acao: "desativado",
      avaliacoes: usos,
      jaEstava: false,
    };
  }

  // Sem avaliação: apaga. Seções e critérios saem por CASCADE.
  await query("DELETE FROM formularios WHERE id = :id", { id });
  return {
    id: String(formulario.id),
    nome: formulario.nome,
    acao: "excluido",
    avaliacoes: 0,
    jaEstava: false,
  };
}
