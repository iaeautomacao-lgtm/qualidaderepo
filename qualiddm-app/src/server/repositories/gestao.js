import { isMissingSchemaError, one, query } from "../db";
import { conflict, notFound } from "../errors";
import { formatarDataHora, inteiro } from "../format";
import { CLIENTES_INICIAIS } from "../catalogo-inicial";

/**
 * Cadastro e desempenho por operação, campanha e avaliado.
 *
 * As três telas fazem a mesma pergunta em recortes diferentes — "como está indo
 * e onde dói" — então elas compartilham a mesma base de agregação aqui, em vez
 * de cada uma inventar sua conta. Se divergissem, a soma das campanhas não
 * fecharia com o total da operação e ninguém saberia em qual acreditar.
 *
 * As duas fontes de monitoria são somadas, como no dashboard: `avaliacoes`
 * (ficha com formulário cadastrado) e a análise IA em
 * `transcricoes.segmentos_json` (upload sem formulário).
 */

/**
 * Canal do atendimento.
 *
 * A fonte primária é `campanhas.canal`, que é cadastro. Quando a gravação subiu
 * sem campanha, o canal sai do tipo do arquivo: áudio é telefone, o resto (PDF
 * de conversa, TXT) é chat. Não é chute — é a única informação disponível, e ela
 * está certa nos dois casos que a operação usa hoje.
 */
export const CANAIS = [
  { id: "telefone", rotulo: "Telefone ativo", icone: "mic" },
  { id: "chat", rotulo: "Chat", icone: "feedback" },
];

const CANAL_POR_ROTULO = new Map(CANAIS.map((canal) => [canal.id, canal.rotulo]));

export function rotuloCanal(canal) {
  return CANAL_POR_ROTULO.get(String(canal)) || "Outros canais";
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

function slugificar(nome) {
  return String(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

async function seguro(rotulo, fallback, trabalho) {
  try {
    return await trabalho();
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      console.warn(`[gestao] ${rotulo}: ${error?.code || "erro"} ${error?.message || error}`);
    }
    return fallback;
  }
}

/** Acumulador de desempenho. Uma instância por recorte (operação, campanha...). */
function contador() {
  return { monitorias: 0, scoreSoma: 0, scoreQtd: 0, naoConformes: 0, criticas: 0 };
}

function fechar(acumulado) {
  return {
    monitorias: acumulado.monitorias,
    score: acumulado.scoreQtd > 0 ? Math.round((acumulado.scoreSoma / acumulado.scoreQtd) * 10) / 10 : null,
    naoConformes: acumulado.naoConformes,
    criticas: acumulado.criticas,
  };
}

function somar(acumulado, { score, naoConformes, critica }) {
  acumulado.monitorias += 1;
  if (Number.isFinite(score)) {
    acumulado.scoreSoma += score;
    acumulado.scoreQtd += 1;
  }
  acumulado.naoConformes += numero(naoConformes);
  if (critica) acumulado.criticas += 1;
}

/**
 * Toda monitoria do período, das duas fontes, num formato só.
 *
 * Uma leitura serve as três telas: buscar por tela multiplicaria a mesma
 * varredura de JSON por três.
 */
async function carregarMonitorias({ periodoDias = 31 } = {}) {
  const temCanal = await temColunaGestao("gravacoes", "canal");
  const selectCanal = temCanal ? "g.canal AS canal_declarado" : "NULL AS canal_declarado";

  const fichas = await seguro("fichas", [], () =>
    query(
      `SELECT a.cliente_id, a.campanha_id, a.avaliado_id, a.score,
              COALESCE(a.zerada, 0) AS zerada,
              COALESCE(a.total_nao_conformes, 0) AS nao_conformes,
              ca.canal,
              g.mime_type,
              ${selectCanal}
         FROM avaliacoes a
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
         LEFT JOIN gravacoes g ON g.avaliacao_id = a.id
        WHERE a.data_avaliacao >= DATE_SUB(CURRENT_DATE, INTERVAL :periodoDias DAY)`,
      { periodoDias },
    ),
  );

  // Mesma regra da lista de Avaliações: análise de gravação excluída não conta
  // no desempenho da operação nem da campanha.
  const filtroExcluida = (await temColunaGestao("gravacoes", "excluida_em"))
    ? "AND g.excluida_em IS NULL"
    : "";

  // Canal declarado no upload (migration 010). Quando existe, ele MANDA — ver a
  // ordem de precedência em `canalDe`.
  const analises = await seguro("analisesIa", [], () =>
    query(
      `SELECT g.cliente_id, g.campanha_id, g.avaliado_id, g.mime_type,
              ca.canal,
              ${selectCanal},
              t.segmentos_json
         FROM gravacoes g
         JOIN transcricoes t
           ON t.id = (SELECT MAX(t2.id) FROM transcricoes t2 WHERE t2.gravacao_id = g.id)
         LEFT JOIN campanhas ca ON ca.id = g.campanha_id
        WHERE g.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodoDias DAY)
          AND t.status = 'concluida'
          AND t.segmentos_json IS NOT NULL
          AND g.avaliacao_id IS NULL
          ${filtroExcluida}
        LIMIT 2000`,
      { periodoDias },
    ),
  );

  /**
   * Canal de uma monitoria, em ordem de confiança:
   *
   *   1. o que a pessoa DECLAROU no upload (`gravacoes.canal`, migration 010)
   *   2. o cadastro da campanha (`campanhas.canal`)
   *   3. palpite pelo tipo do arquivo — último recurso, só para registro antigo
   *
   * A declaração vem primeiro porque é a única das três que não é inferência:
   * um PDF com transcrição de ligação era contado como chat pelo palpite, e o
   * erro entrava calado na média por canal.
   */
  const canalDe = (canal, mimeType, declarado) => {
    if (declarado === "telefone" || declarado === "chat") return declarado;
    if (canal === "telefone" || canal === "chat") return canal;
    if (canal === "whatsapp" || canal === "email") return "chat";
    return String(mimeType || "").startsWith("audio/") ? "telefone" : "chat";
  };

  const lista = fichas.map((row) => ({
    clienteId: row.cliente_id == null ? null : String(row.cliente_id),
    campanhaId: row.campanha_id == null ? null : String(row.campanha_id),
    avaliadoId: row.avaliado_id == null ? null : String(row.avaliado_id),
    canal: canalDe(row.canal, row.mime_type, row.canal_declarado),
    score: numero(row.score, NaN),
    naoConformes: numero(row.nao_conformes),
    critica: numero(row.zerada) === 1 || numero(row.score) === 0,
    origem: "ficha",
  }));

  for (const row of analises) {
    const analise = parseJson(row.segmentos_json);
    if (!analise) continue;
    const score = numero(analise.nota, NaN);
    lista.push({
      clienteId: row.cliente_id == null ? null : String(row.cliente_id),
      campanhaId: row.campanha_id == null ? null : String(row.campanha_id),
      avaliadoId: row.avaliado_id == null ? null : String(row.avaliado_id),
      canal: canalDe(row.canal, row.mime_type, row.canal_declarado),
      score,
      naoConformes: numero(analise.resumoConformidade?.naoConformes),
      critica: Boolean(analise.zerada) || score === 0,
      origem: "ia",
    });
  }

  return lista;
}

/** Desempenho geral + por canal, agrupado pela chave que a tela pedir. */
function agrupar(monitorias, chave) {
  const grupos = new Map();

  for (const item of monitorias) {
    const id = item[chave];
    if (!id) continue;

    const atual =
      grupos.get(id) ||
      { total: contador(), canais: new Map(CANAIS.map((canal) => [canal.id, contador()])) };

    somar(atual.total, item);
    const canal = atual.canais.get(item.canal) ?? contador();
    somar(canal, item);
    atual.canais.set(item.canal, canal);
    grupos.set(id, atual);
  }

  return grupos;
}

function desempenhoDe(grupos, id) {
  const grupo = grupos.get(String(id));
  if (!grupo) {
    return {
      ...fechar(contador()),
      canais: CANAIS.map((canal) => ({ canal: canal.id, rotulo: canal.rotulo, ...fechar(contador()) })),
    };
  }

  return {
    ...fechar(grupo.total),
    canais: CANAIS.map((canal) => ({
      canal: canal.id,
      rotulo: canal.rotulo,
      ...fechar(grupo.canais.get(canal.id) ?? contador()),
    })),
  };
}

/**
 * Leitura em uma linha sobre um recorte.
 *
 * Frase montada em código, a partir dos números — não é texto de IA. O painel
 * precisa dizer algo útil mesmo quando ninguém pediu análise ao modelo.
 */
function insight({ monitorias, score, naoConformes, criticas }, contexto = "esta operação") {
  if (monitorias === 0) return `Sem monitoria no período para ${contexto}.`;
  if (criticas > 0) {
    return `${criticas} avaliação(ões) crítica(s) em ${monitorias} monitoria(s): tratar antes de olhar a média.`;
  }
  if (score == null) return `${monitorias} monitoria(s) sem nota calculada.`;
  if (score < 70) return `Nota ${score} abaixo da faixa de atenção, com ${naoConformes} não conformidade(s).`;
  if (naoConformes > 0) return `Nota ${score} com ${naoConformes} não conformidade(s) a tratar em feedback.`;
  return `Nota ${score} sem não conformidade no período.`;
}

// ===========================================================================
// Operações (clientes)
// ===========================================================================

export async function listarOperacoes({ periodoDias = 31 } = {}) {
  const monitorias = await carregarMonitorias({ periodoDias });
  const porCliente = agrupar(monitorias, "clienteId");

  const clientes = await seguro(
    "clientes",
    CLIENTES_INICIAIS.map((cliente, indice) => ({
      id: indice + 1,
      nome: cliente.nome,
      ativo: 1,
      contrato: null,
      campanhas: 0,
    })),
    () =>
      query(
        `SELECT c.id, c.nome, c.slug, c.contrato, c.ativo,
                (SELECT COUNT(*) FROM campanhas ca WHERE ca.cliente_id = c.id AND ca.ativa = 1) AS campanhas
           FROM clientes c
          ORDER BY c.nome`,
      ),
  );

  const itens = clientes.map((cliente) => {
    const desempenho = desempenhoDe(porCliente, cliente.id);
    return {
      id: String(cliente.id),
      nome: cliente.nome,
      slug: cliente.slug || slugificar(cliente.nome),
      contrato: cliente.contrato || null,
      ativo: numero(cliente.ativo, 1) === 1,
      campanhas: inteiro(cliente.campanhas),
      ...desempenho,
      insight: insight(desempenho, cliente.nome),
    };
  });

  const totalMonitorias = itens.reduce((soma, item) => soma + item.monitorias, 0);
  const pontuados = itens.filter((item) => item.score != null && item.monitorias > 0);
  const scoreGeral =
    totalMonitorias > 0 && pontuados.length > 0
      ? Math.round(
          (pontuados.reduce((soma, item) => soma + item.score * item.monitorias, 0) /
            pontuados.reduce((soma, item) => soma + item.monitorias, 0)) *
            100,
        ) / 100
      : null;

  return {
    kpis: {
      total: itens.length,
      ativos: itens.filter((item) => item.ativo).length,
      monitorias: totalMonitorias,
      score: scoreGeral,
      naoConformes: itens.reduce((soma, item) => soma + item.naoConformes, 0),
      criticas: itens.reduce((soma, item) => soma + item.criticas, 0),
    },
    canais: CANAIS,
    itens,
  };
}

export async function obterOperacao(clienteId, { periodoDias = 31 } = {}) {
  const cliente = await seguro("cliente", null, () =>
    one(
      `SELECT id, nome, slug, contrato, ativo, created_at
         FROM clientes
        WHERE id = :clienteId
        LIMIT 1`,
      { clienteId },
    ),
  );

  if (!cliente) throw notFound("Operação não encontrada.");

  const monitorias = await carregarMonitorias({ periodoDias });
  const porCliente = agrupar(monitorias, "clienteId");
  const porCampanha = agrupar(monitorias, "campanhaId");

  const campanhas = await seguro("campanhas", [], () =>
    query(
      `SELECT ca.id, ca.nome, ca.canal, ca.ativa, ca.favorita, ca.created_at,
              fc.nome AS faixa_conjunto,
              (SELECT m.meta_score
                 FROM metas_monitoria m
                WHERE m.campanha_id = ca.id
                ORDER BY m.ano DESC, m.mes DESC
                LIMIT 1) AS meta_score
         FROM campanhas ca
         LEFT JOIN faixa_conjuntos fc ON fc.id = ca.faixa_conjunto_id
        WHERE ca.cliente_id = :clienteId
        ORDER BY ca.canal, ca.nome`,
      { clienteId },
    ),
  );

  const desempenho = desempenhoDe(porCliente, cliente.id);

  return {
    operacao: {
      id: String(cliente.id),
      nome: cliente.nome,
      slug: cliente.slug || slugificar(cliente.nome),
      contrato: cliente.contrato || null,
      ativo: numero(cliente.ativo, 1) === 1,
      criadaEm: formatarDataHora(cliente.created_at),
      ...desempenho,
      insight: insight(desempenho, cliente.nome),
    },
    campanhas: campanhas.map((campanha) => {
      const dados = desempenhoDe(porCampanha, campanha.id);
      return {
        id: String(campanha.id),
        nome: campanha.nome,
        canal: campanha.canal,
        canalRotulo: rotuloCanal(campanha.canal),
        ativa: numero(campanha.ativa, 1) === 1,
        favorita: numero(campanha.favorita) === 1,
        criadaEm: formatarDataHora(campanha.created_at),
        faixaConjunto: campanha.faixa_conjunto || null,
        metaScore: campanha.meta_score == null ? null : numero(campanha.meta_score),
        ...dados,
        insight: insight(dados, campanha.nome),
      };
    }),
  };
}

export async function criarCliente({ nome, contrato = null }) {
  const slug = slugificar(nome);
  const existente = await seguro("clienteExistente", null, () =>
    one("SELECT id FROM clientes WHERE slug = :slug OR nome = :nome LIMIT 1", { slug, nome }),
  );
  if (existente) throw conflict("Já existe uma operação com este nome.");

  await query(
    `INSERT INTO clientes (slug, nome, contrato, ativo) VALUES (:slug, :nome, :contrato, 1)`,
    { slug, nome, contrato },
  );

  return one("SELECT id, nome, slug, contrato, ativo FROM clientes WHERE slug = :slug LIMIT 1", { slug });
}

/**
 * Exclusão de operação.
 *
 * Desativa quando há monitoria vinculada, apaga quando não há. O motivo é
 * simples: `avaliacoes.cliente_id` não tem ON DELETE CASCADE, e apagar o cliente
 * apagaria o histórico de qualidade dele — ou pior, falharia com erro de chave
 * estrangeira sem explicar nada a quem clicou.
 */
export async function excluirCliente(clienteId) {
  const cliente = await one("SELECT id, nome FROM clientes WHERE id = :clienteId LIMIT 1", { clienteId });
  if (!cliente) throw notFound("Operação não encontrada.");

  const uso = await seguro("usoCliente", { total: 0 }, () =>
    one(
      `SELECT (SELECT COUNT(*) FROM avaliacoes WHERE cliente_id = :clienteId)
            + (SELECT COUNT(*) FROM gravacoes WHERE cliente_id = :clienteId) AS total`,
      { clienteId },
    ),
  );

  if (inteiro(uso?.total) > 0) {
    await query("UPDATE clientes SET ativo = 0 WHERE id = :clienteId", { clienteId });
    return { id: String(clienteId), nome: cliente.nome, removido: false, desativado: true };
  }

  await query("DELETE FROM clientes WHERE id = :clienteId", { clienteId });
  return { id: String(clienteId), nome: cliente.nome, removido: true, desativado: false };
}

// ===========================================================================
// Campanhas
// ===========================================================================

export async function listarCampanhas({ periodoDias = 31, clienteId = null } = {}) {
  const monitorias = await carregarMonitorias({ periodoDias });
  const porCampanha = agrupar(monitorias, "campanhaId");

  const filtro = clienteId ? "WHERE ca.cliente_id = :clienteId" : "";
  const campanhas = await seguro("campanhas", [], () =>
    query(
      `SELECT ca.id, ca.nome, ca.canal, ca.ativa, ca.favorita, ca.created_at,
              ca.cliente_id, c.nome AS cliente,
              (SELECT COUNT(*) FROM formulario_campanhas fc WHERE fc.campanha_id = ca.id) AS formularios
         FROM campanhas ca
         LEFT JOIN clientes c ON c.id = ca.cliente_id
         ${filtro}
        ORDER BY c.nome, ca.nome`,
      clienteId ? { clienteId } : {},
    ),
  );

  const itens = campanhas.map((campanha) => {
    const dados = desempenhoDe(porCampanha, campanha.id);
    return {
      id: String(campanha.id),
      nome: campanha.nome,
      canal: campanha.canal,
      canalRotulo: rotuloCanal(campanha.canal),
      clienteId: campanha.cliente_id == null ? null : String(campanha.cliente_id),
      cliente: campanha.cliente || "Sem operação",
      ativa: numero(campanha.ativa, 1) === 1,
      favorita: numero(campanha.favorita) === 1,
      criadaEm: formatarDataHora(campanha.created_at),
      formularios: inteiro(campanha.formularios),
      ...dados,
      insight: insight(dados, campanha.nome),
    };
  });

  const monitoriasTotal = itens.reduce((soma, item) => soma + item.monitorias, 0);
  const pontuadas = itens.filter((item) => item.score != null && item.monitorias > 0);

  return {
    kpis: {
      total: itens.length,
      ativas: itens.filter((item) => item.ativa).length,
      monitorias: monitoriasTotal,
      score:
        pontuadas.length > 0
          ? Math.round(
              (pontuadas.reduce((soma, item) => soma + item.score * item.monitorias, 0) /
                pontuadas.reduce((soma, item) => soma + item.monitorias, 0)) *
                100,
            ) / 100
          : null,
      semMonitoria: itens.filter((item) => item.monitorias === 0).length,
    },
    canais: CANAIS,
    itens,
  };
}

export async function criarCampanha({ clienteId, nome, canal = "telefone" }) {
  const cliente = await one("SELECT id FROM clientes WHERE id = :clienteId LIMIT 1", { clienteId });
  if (!cliente) throw notFound("Operação não encontrada.");

  // A unicidade é por cliente, não global: "Chat" existe em várias operações.
  const existente = await seguro("campanhaExistente", null, () =>
    one(
      "SELECT id FROM campanhas WHERE cliente_id = :clienteId AND nome = :nome LIMIT 1",
      { clienteId, nome },
    ),
  );
  if (existente) throw conflict("Esta operação já tem uma campanha com este nome.");

  await query(
    `INSERT INTO campanhas (cliente_id, nome, canal, ativa) VALUES (:clienteId, :nome, :canal, 1)`,
    { clienteId, nome, canal },
  );

  return one(
    "SELECT id, nome, canal, cliente_id FROM campanhas WHERE cliente_id = :clienteId AND nome = :nome LIMIT 1",
    { clienteId, nome },
  );
}

export async function atualizarCampanha(campanhaId, { nome, canal, ativa }) {
  const campanha = await one("SELECT id FROM campanhas WHERE id = :campanhaId LIMIT 1", { campanhaId });
  if (!campanha) throw notFound("Campanha não encontrada.");

  await query(
    `UPDATE campanhas
        SET nome = :nome, canal = :canal, ativa = :ativa
      WHERE id = :campanhaId`,
    { campanhaId, nome, canal, ativa: ativa ? 1 : 0 },
  );

  return one("SELECT id, nome, canal, ativa, cliente_id FROM campanhas WHERE id = :campanhaId LIMIT 1", {
    campanhaId,
  });
}

/** Mesma regra do cliente: desativa se houver monitoria, apaga se não houver. */
export async function excluirCampanha(campanhaId) {
  const campanha = await one("SELECT id, nome FROM campanhas WHERE id = :campanhaId LIMIT 1", { campanhaId });
  if (!campanha) throw notFound("Campanha não encontrada.");

  const uso = await seguro("usoCampanha", { total: 0 }, () =>
    one(
      `SELECT (SELECT COUNT(*) FROM avaliacoes WHERE campanha_id = :campanhaId)
            + (SELECT COUNT(*) FROM gravacoes WHERE campanha_id = :campanhaId) AS total`,
      { campanhaId },
    ),
  );

  if (inteiro(uso?.total) > 0) {
    await query("UPDATE campanhas SET ativa = 0 WHERE id = :campanhaId", { campanhaId });
    return { id: String(campanhaId), nome: campanha.nome, removido: false, desativado: true };
  }

  await query("DELETE FROM campanhas WHERE id = :campanhaId", { campanhaId });
  return { id: String(campanhaId), nome: campanha.nome, removido: true, desativado: false };
}

// ===========================================================================
// Avaliados (operadores)
// ===========================================================================

const PAPEIS_AVALIADOS = ["operador", "monitor", "supervisor"];

export async function listarAvaliados({ periodoDias = 31 } = {}) {
  const monitorias = await carregarMonitorias({ periodoDias });
  const porAvaliado = agrupar(monitorias, "avaliadoId");
  const [temTurno, temSupervisor, temExternal, temMatricula, temUserCampanhas, temCliente] = await Promise.all([
    temColunaGestao("users", "turno_id"),
    temColunaGestao("users", "supervisor_id"),
    temColunaGestao("users", "external_code"),
    temColunaGestao("users", "matricula"),
    query("SHOW TABLES LIKE 'user_campanhas'").then((rows) => rows.length > 0).catch(() => false),
    temColunaGestao("users", "cliente_id"),
  ]);

  const pessoas = await seguro("avaliados", [], () =>
    query(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
              ${temExternal ? "u.external_code" : "NULL AS external_code"},
              ${temMatricula ? "u.matricula" : "NULL AS matricula"},
              ${temCliente ? "cl.nome AS cliente" : "NULL AS cliente"},
              ${temTurno ? "tu.nome AS turno" : "NULL AS turno"},
              ${temSupervisor ? "sup.name AS supervisor" : "NULL AS supervisor"},
              ${temUserCampanhas ? "(SELECT COUNT(*) FROM user_campanhas uc WHERE uc.user_id = u.id AND uc.ativo = 1) AS total_campanhas" : "0 AS total_campanhas"}
         FROM users u
         ${temCliente ? "LEFT JOIN clientes cl ON cl.id = u.cliente_id" : ""}
         ${temTurno ? "LEFT JOIN turnos tu ON tu.id = u.turno_id" : ""}
         ${temSupervisor ? "LEFT JOIN users sup ON sup.id = u.supervisor_id" : ""}
        WHERE u.role IN ('operador', 'monitor', 'supervisor')
        ORDER BY u.name`,
    ),
  );

  const itens = pessoas.map((pessoa) => {
    const dados = desempenhoDe(porAvaliado, pessoa.id);
    return {
      id: String(pessoa.id),
      nome: pessoa.name,
      email: pessoa.email,
      papel: pessoa.role,
      matricula: pessoa.matricula || pessoa.external_code || null,
      cliente: pessoa.cliente || null,
      turno: pessoa.turno || null,
      supervisor: pessoa.supervisor || null,
      totalCampanhas: numero(pessoa.total_campanhas),
      ativo: numero(pessoa.active, 1) === 1,
      criadoEm: formatarDataHora(pessoa.created_at),
      ...dados,
      insight: insight(dados, pessoa.name),
    };
  });

  const comMonitoria = itens.filter((item) => item.monitorias > 0);
  const pontuados = comMonitoria.filter((item) => item.score != null);

  return {
    kpis: {
      total: itens.length,
      ativos: itens.filter((item) => item.ativo).length,
      avaliadosNoPeriodo: comMonitoria.length,
      semMonitoria: itens.filter((item) => item.ativo && item.monitorias === 0).length,
      score:
        pontuados.length > 0
          ? Math.round(
              (pontuados.reduce((soma, item) => soma + item.score * item.monitorias, 0) /
                pontuados.reduce((soma, item) => soma + item.monitorias, 0)) *
                100,
            ) / 100
          : null,
    },
    canais: CANAIS,
    itens,
  };
}

export async function criarAvaliado({ nome, email, papel = "operador", senhaHash }) {
  const existente = await seguro("avaliadoExistente", null, () =>
    one("SELECT id FROM users WHERE email = :email LIMIT 1", { email }),
  );
  if (existente) throw conflict("Já existe usuário com este e-mail.");

  /* `trocar_senha = 1` na criação, igual a Gestão de Usuários: a pessoa nasce
     com a senha padrão do sistema e o QualiDDM fica fechado para ela até a
     troca. Cadastrar avaliado por aqui não pode abrir uma porta que o outro
     caminho fecha. */
  const temTrocar = await seguro("colunaTrocarSenha", false, () =>
    query("SHOW COLUMNS FROM users LIKE 'trocar_senha'").then((rows) => rows.length > 0),
  );

  await query(
    `INSERT INTO users (name, email, password_hash, role, active${temTrocar ? ", trocar_senha" : ""})
     VALUES (:nome, :email, :senhaHash, :papel, 1${temTrocar ? ", 1" : ""})`,
    { nome, email, senhaHash, papel },
  );

  return one("SELECT id, name, email, role, active FROM users WHERE email = :email LIMIT 1", { email });
}

/**
 * Exclusão de avaliado.
 *
 * SEMPRE desativa, nunca apaga. A pessoa é referenciada por avaliação, feedback,
 * contestação e log de auditoria: apagar a linha significaria perder a autoria
 * do histórico de qualidade dela — e histórico de monitoria é documento.
 */
export async function excluirAvaliado(userId) {
  const pessoa = await one("SELECT id, name FROM users WHERE id = :userId LIMIT 1", { userId });
  if (!pessoa) throw notFound("Pessoa não encontrada.");

  await query("UPDATE users SET active = 0 WHERE id = :userId", { userId });
  return { id: String(userId), nome: pessoa.name, removido: false, desativado: true };
}

// ===========================================================================
// Metas mensais de monitoria
// ===========================================================================

/**
 * Metas do mês com o realizado ao lado.
 *
 * `meta_avaliacoes` é a meta POR AGENTE, como no print de referência
 * ("Meta/Agente — quantas monitorias cada agente dessa campanha deve receber no
 * mês"). O esperado do mês é meta × agentes com monitoria na campanha, e o
 * progresso é o concluído sobre esse esperado.
 */
export async function listarMetas({ ano, mes }) {
  const metas = await seguro("metas", [], () =>
    query(
      `SELECT m.id, m.cliente_id, m.campanha_id, m.ano, m.mes,
              m.meta_avaliacoes, m.meta_feedbacks, m.meta_score, m.observacao,
              c.nome AS cliente, ca.nome AS campanha, ca.canal
         FROM metas_monitoria m
         LEFT JOIN clientes c ON c.id = m.cliente_id
         LEFT JOIN campanhas ca ON ca.id = m.campanha_id
        WHERE m.ano = :ano AND m.mes = :mes
        ORDER BY c.nome, ca.nome`,
      { ano, mes },
    ),
  );

  const realizado = await seguro("realizadoMes", [], () =>
    query(
      `SELECT a.cliente_id, a.campanha_id,
              COUNT(*) AS concluidas,
              COUNT(DISTINCT a.avaliado_id) AS agentes,
              ROUND(AVG(a.score), 1) AS score
         FROM avaliacoes a
        WHERE YEAR(a.data_avaliacao) = :ano AND MONTH(a.data_avaliacao) = :mes
        GROUP BY a.cliente_id, a.campanha_id`,
      { ano, mes },
    ),
  );

  const chave = (clienteId, campanhaId) => `${clienteId ?? "-"}:${campanhaId ?? "-"}`;
  const porChave = new Map(
    realizado.map((row) => [chave(row.cliente_id, row.campanha_id), row]),
  );

  return {
    ano,
    mes,
    itens: metas.map((meta) => {
      const feito = porChave.get(chave(meta.cliente_id, meta.campanha_id)) || {};
      const agentes = inteiro(feito.agentes);
      const concluidas = inteiro(feito.concluidas);
      const metaAgente = meta.meta_avaliacoes == null ? null : inteiro(meta.meta_avaliacoes);
      const esperado = metaAgente != null && agentes > 0 ? metaAgente * agentes : null;

      return {
        id: String(meta.id),
        clienteId: meta.cliente_id == null ? null : String(meta.cliente_id),
        cliente: meta.cliente || "Sem operação",
        campanhaId: meta.campanha_id == null ? null : String(meta.campanha_id),
        campanha: meta.campanha || "Todas as campanhas",
        canal: meta.canal || null,
        canalRotulo: meta.canal ? rotuloCanal(meta.canal) : null,
        metaAgente,
        metaFeedbacks: meta.meta_feedbacks == null ? null : inteiro(meta.meta_feedbacks),
        metaScore: meta.meta_score == null ? null : numero(meta.meta_score),
        observacao: meta.observacao || null,
        agentes,
        concluidas,
        esperado,
        scoreRealizado: feito.score == null ? null : numero(feito.score),
        // Sem meta por agente ou sem agente medido não existe percentual: mostrar
        // 0% nesse caso leria como "nada foi feito", que é diferente de "não há
        // como calcular".
        progresso: esperado != null && esperado > 0 ? Math.round((concluidas / esperado) * 100) : null,
      };
    }),
  };
}

export async function salvarMeta({ clienteId, campanhaId = null, ano, mes, metaAgente, metaScore = null, observacao = null }) {
  const cliente = await one("SELECT id FROM clientes WHERE id = :clienteId LIMIT 1", { clienteId });
  if (!cliente) throw notFound("Operação não encontrada.");

  // `ON DUPLICATE KEY` casa com a única `uq_metas_monitoria`: salvar a mesma
  // campanha no mesmo mês edita, não duplica.
  await query(
    `INSERT INTO metas_monitoria (cliente_id, campanha_id, ano, mes, meta_avaliacoes, meta_score, observacao)
     VALUES (:clienteId, :campanhaId, :ano, :mes, :metaAgente, :metaScore, :observacao)
     ON DUPLICATE KEY UPDATE
        meta_avaliacoes = VALUES(meta_avaliacoes),
        meta_score = VALUES(meta_score),
        observacao = VALUES(observacao)`,
    { clienteId, campanhaId, ano, mes, metaAgente, metaScore, observacao },
  );

  return listarMetas({ ano, mes });
}

export async function excluirMeta(metaId) {
  const meta = await one("SELECT id, ano, mes FROM metas_monitoria WHERE id = :metaId LIMIT 1", { metaId });
  if (!meta) throw notFound("Meta não encontrada.");
  await query("DELETE FROM metas_monitoria WHERE id = :metaId", { metaId });
  return listarMetas({ ano: inteiro(meta.ano), mes: inteiro(meta.mes) });
}

/* ==========================================================================
   Tela "Gerenciar — {campanha}": configuração e pessoas
   ========================================================================== */

const cacheColunasGestao = new Map();

/** Coluna presente? Memoizado. Tabela e coluna são literais deste módulo. */
async function temColunaGestao(tabela, coluna) {
  const chave = `${tabela}.${coluna}`;
  if (!cacheColunasGestao.has(chave)) {
    cacheColunasGestao.set(
      chave,
      query(`SHOW COLUMNS FROM ${tabela} LIKE :coluna`, { coluna })
        .then((rows) => rows.length > 0)
        .catch(() => false),
    );
  }
  return cacheColunasGestao.get(chave);
}

/**
 * Cadastro, configuração, desempenho e pessoas de uma campanha.
 *
 * A meta de nota lida aqui é a da CAMPANHA (`campanhas.meta_score`, migration
 * 009) — o alvo permanente. A meta do mês vive em `metas_monitoria` e é assunto
 * da tela de Metas Mensais; ver o cabeçalho da 009 sobre por que as duas
 * coexistem.
 */
export async function obterCampanha(campanhaId, { periodoDias = 31 } = {}) {
  const temMeta = await temColunaGestao("campanhas", "meta_score");

  const campanha = await seguro("campanha", null, () =>
    one(
      `SELECT ca.id, ca.nome, ca.canal, ca.ativa, ca.favorita, ca.created_at,
              ca.cliente_id, ca.faixa_conjunto_id,
              ${temMeta ? "ca.meta_score" : "NULL AS meta_score"},
              cl.nome AS cliente,
              fc.nome AS faixa_conjunto
         FROM campanhas ca
         LEFT JOIN clientes cl ON cl.id = ca.cliente_id
         LEFT JOIN faixa_conjuntos fc ON fc.id = ca.faixa_conjunto_id
        WHERE ca.id = :campanhaId
        LIMIT 1`,
      { campanhaId },
    ),
  );

  if (!campanha) throw notFound("Campanha não encontrada.");

  const monitorias = await carregarMonitorias({ periodoDias });
  const desempenho = desempenhoDe(agrupar(monitorias, "campanhaId"), campanha.id);

  /* Pessoas da campanha: quem FOI AVALIADO nela no período, não quem está
     lotado na carteira. `users.cliente_id` diz onde a pessoa está alocada, e
     numa operação com três campanhas isso contaria a mesma equipe três vezes —
     o card "Total de Pessoas" mentiria em todas. */
  const pessoas = new Map();
  for (const item of monitorias) {
    if (String(item.campanhaId ?? "") !== String(campanha.id)) continue;
    if (!item.avaliadoId) continue;

    const atual = pessoas.get(item.avaliadoId) ?? { monitorias: 0, soma: 0, comNota: 0 };
    atual.monitorias += 1;
    // `Number.isFinite` e não `!= null`: `carregarMonitorias` devolve NaN para
    // monitoria sem nota, e NaN passa por qualquer checagem de nulo — uma só
    // envenenaria a média da pessoa inteira.
    if (Number.isFinite(item.score)) {
      atual.soma += item.score;
      atual.comNota += 1;
    }
    pessoas.set(item.avaliadoId, atual);
  }

  const conjuntos = await seguro("faixa_conjuntos", [], () =>
    query(
      `SELECT id, nome, descricao, padrao
         FROM faixa_conjuntos
        WHERE ativo = 1
        ORDER BY padrao DESC, nome`,
    ),
  );

  const ativos = await seguro("pessoas_ativas", [], () =>
    pessoas.size === 0
      ? Promise.resolve([])
      : query(
          `SELECT id, active
             FROM users
            WHERE id IN (${[...pessoas.keys()].map((_, indice) => `:p${indice}`).join(", ")})`,
          Object.fromEntries([...pessoas.keys()].map((id, indice) => [`p${indice}`, id])),
        ),
  );

  const metaScore = campanha.meta_score == null ? null : numero(campanha.meta_score);
  const ativosContagem = ativos.filter((linha) => numero(linha.active, 1) === 1).length;

  /* "Eficiência da Equipe" = quantas pessoas da campanha estão na meta.
     `null` quando não há meta cadastrada: sem alvo não existe atingimento, e
     mostrar 100% aí seria afirmar que todo mundo bateu uma meta inexistente. */
  const naMeta =
    metaScore == null
      ? null
      : [...pessoas.values()].filter(
          (pessoa) => pessoa.comNota > 0 && pessoa.soma / pessoa.comNota >= metaScore,
        ).length;

  const medidas = [...pessoas.values()].filter((pessoa) => pessoa.comNota > 0).length;

  return {
    campanha: {
      id: String(campanha.id),
      nome: campanha.nome,
      canal: campanha.canal,
      canalRotulo: rotuloCanal(campanha.canal),
      ativa: numero(campanha.ativa, 1) === 1,
      favorita: numero(campanha.favorita) === 1,
      criadaEm: formatarDataHora(campanha.created_at),
      clienteId: campanha.cliente_id == null ? null : String(campanha.cliente_id),
      cliente: campanha.cliente || "Sem operação",
      faixaConjuntoId:
        campanha.faixa_conjunto_id == null ? null : String(campanha.faixa_conjunto_id),
      faixaConjunto: campanha.faixa_conjunto || null,
      metaScore,
      ...desempenho,
      insight: insight(desempenho, campanha.nome),
    },
    pessoas: {
      total: pessoas.size,
      ativas: ativosContagem,
      medidas,
      naMeta,
      // Percentual só quando há meta E gente com nota. Denominador zero devolve
      // `null` em vez de 0%: "nenhuma pessoa na meta" e "ninguém foi medido" são
      // leituras diferentes.
      eficiencia:
        naMeta == null || medidas === 0 ? null : Math.round((naMeta / medidas) * 100),
    },
    conjuntosFaixa: conjuntos.map((conjunto) => ({
      id: String(conjunto.id),
      nome: conjunto.nome,
      descricao: conjunto.descricao || null,
      padrao: numero(conjunto.padrao) === 1,
    })),
    metaSuportada: temMeta,
    periodoDias,
  };
}

/**
 * Salva o bloco "Faixa de Performance e Metas".
 *
 * Só os dois campos do bloco. Nome, canal e situação continuam em
 * `atualizarCampanha`, que é o cadastro — separar evita que salvar a meta
 * reescreva o nome com um valor que a tela nem mostrava.
 */
export async function salvarConfiguracaoCampanha(campanhaId, { faixaConjuntoId, metaScore }) {
  const campanha = await one("SELECT id FROM campanhas WHERE id = :campanhaId LIMIT 1", {
    campanhaId,
  });
  if (!campanha) throw notFound("Campanha não encontrada.");

  const campos = ["faixa_conjunto_id = :faixaConjuntoId"];
  const params = { campanhaId, faixaConjuntoId: faixaConjuntoId || null };

  if (metaScore !== undefined) {
    if (!(await temColunaGestao("campanhas", "meta_score"))) {
      throw conflict(
        "A meta de nota da campanha ainda não está disponível neste banco. Rode a migration 009_campanha_meta_score.sql.",
      );
    }
    campos.push("meta_score = :metaScore");
    params.metaScore = metaScore;
  }

  // Conjunto inexistente entraria como FK inválida e estouraria em ER_NO_REFERENCED_ROW.
  if (params.faixaConjuntoId) {
    const conjunto = await one("SELECT id FROM faixa_conjuntos WHERE id = :id LIMIT 1", {
      id: params.faixaConjuntoId,
    });
    if (!conjunto) throw notFound("Conjunto de faixas não encontrado.");
  }

  await query(`UPDATE campanhas SET ${campos.join(", ")} WHERE id = :campanhaId`, params);

  return obterCampanha(campanhaId);
}
