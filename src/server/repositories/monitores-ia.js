import { isMissingSchemaError, one, paraLike, query } from "../db";
import { inteiro } from "../format";
import { MONITORES_IA_INICIAIS } from "../catalogo-inicial";

const PROMPT_PADRAO_FIRJAN = `Você é o Monitor IA configurado para a carteira FIRJAN. Avalie o atendimento com foco em fraseologia Firjan, confirmação de dados, clareza da orientação, cordialidade, encerramento e evidências objetivas na transcrição. Sempre devolva critérios com evidência, confiança e status conforme o formulário vinculado.`;

async function safe(fallback, work) {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

function slug(nome, id) {
  const base = String(nome || "monitor-ia")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "monitor-ia"}-${id}`;
}

async function tabelaConfiguracoesExiste() {
  try {
    const rows = await query("SHOW TABLES LIKE 'monitor_ia_configuracoes'");
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function configuracoesPorCliente() {
  if (!(await tabelaConfiguracoesExiste())) return new Map();
  try {
    const rows = await query(
      `SELECT mic.id, mic.cliente_id, mic.formulario_id, mic.nome, mic.prompt, mic.ativo,
              mic.updated_at, f.nome AS formulario, c.nome AS cliente, u.name AS criado_por
         FROM monitor_ia_configuracoes mic
         LEFT JOIN formularios f ON f.id = mic.formulario_id
         LEFT JOIN clientes c ON c.id = mic.cliente_id
         LEFT JOIN users u ON u.id = mic.criado_por_id
        ORDER BY mic.updated_at DESC, mic.id DESC`,
    );
    const mapa = new Map();
    for (const row of rows) {
      mapa.set(String(row.cliente_id), {
        id: String(row.id),
        clienteId: row.cliente_id == null ? null : String(row.cliente_id),
        cliente: row.cliente || null,
        formularioId: row.formulario_id == null ? null : String(row.formulario_id),
        formulario: row.formulario || null,
        nome: row.nome || "Monitor IA",
        prompt: row.prompt || "",
        ativo: Boolean(Number(row.ativo ?? 1)),
        criadoPor: row.criado_por || null,
        atualizadoEm: row.updated_at || null,
      });
    }
    return mapa;
  } catch (error) {
    if (isMissingSchemaError(error)) return new Map();
    throw error;
  }
}

async function formulariosIaPorCliente() {
  try {
    const rows = await query(
      `SELECT f.id, f.cliente_id, f.nome, c.nome AS cliente,
              COUNT(DISTINCT fc.campanha_id) AS campanhas
         FROM formularios f
         LEFT JOIN clientes c ON c.id = f.cliente_id
         LEFT JOIN formulario_campanhas fc ON fc.formulario_id = f.id
        WHERE f.status IN ('ativo', 'desenvolvimento')
          AND (LOWER(f.nome) LIKE '% ia%' OR LOWER(f.nome) LIKE 'ia %' OR LOWER(f.nome) LIKE '%>>>%')
        GROUP BY f.id, f.cliente_id, f.nome, c.nome
        ORDER BY c.nome, f.nome`,
    );
    const mapa = new Map();
    for (const row of rows) {
      const clienteId = row.cliente_id == null ? null : String(row.cliente_id);
      if (!clienteId) continue;
      if (!mapa.has(clienteId)) mapa.set(clienteId, []);
      mapa.get(clienteId).push({
        id: String(row.id),
        nome: row.nome,
        clienteId,
        cliente: row.cliente || null,
        campanhas: inteiro(row.campanhas),
      });
    }
    return mapa;
  } catch (error) {
    if (isMissingSchemaError(error)) return new Map();
    return new Map();
  }
}

async function clientesComCampanhas() {
  try {
    return await query(
      `SELECT c.id, c.nome,
              GROUP_CONCAT(DISTINCT ca.nome ORDER BY ca.nome SEPARATOR ', ') AS campanhas_nomes,
              COUNT(DISTINCT ca.id) AS campanhas
         FROM clientes c
         LEFT JOIN campanhas ca ON ca.cliente_id = c.id AND ca.ativa = 1
        WHERE c.ativo = 1
        GROUP BY c.id, c.nome
        ORDER BY c.nome`,
    );
  } catch {
    return [];
  }
}

function aplicarConfiguracao(item, configuracao, formularios = []) {
  const formularioPreferido = configuracao?.formulario || formularios[0]?.nome || null;
  const promptPadrao = /firjan/i.test(`${item.nome} ${item.cliente}`) ? PROMPT_PADRAO_FIRJAN : "";
  const prompt = configuracao?.prompt || promptPadrao;
  return {
    ...item,
    configuracao: configuracao || null,
    formulariosIa: formularios,
    formularioIa: formularioPreferido,
    prompt,
    configurado: Boolean((configuracao?.ativo || promptPadrao) && formularioPreferido && prompt),
  };
}

function montarKpis(itens) {
  return {
    total: itens.length,
    ativos: itens.filter((item) => item.status === "ativo").length,
    inativos: itens.filter((item) => item.status !== "ativo").length,
    emConfiguracao: itens.filter((item) => !item.configurado).length,
    campanhasCobertas: new Set(
      itens.flatMap((item) => String(item.campanhasNomes || "").split(",").map((nome) => nome.trim()).filter(Boolean)),
    ).size,
  };
}

export async function listarMonitoresIa({ busca = null, limit = 48, offset = 0 } = {}) {
  const params = {};
  const filtros = ["a.origem = 'ia'"];
  if (busca) {
    filtros.push("(u.name LIKE :busca OR c.nome LIKE :busca OR ca.nome LIKE :busca)");
    params.busca = paraLike(busca);
  }
  const where = `WHERE ${filtros.join(" AND ")}`;

  const [configuracoes, formulariosPorCliente, clientes] = await Promise.all([
    configuracoesPorCliente(),
    formulariosIaPorCliente(),
    clientesComCampanhas(),
  ]);

  const rows = await safe([], () =>
    query(
      `SELECT COALESCE(a.cliente_id, 0) AS id,
              CASE
                WHEN c.nome IS NULL THEN MIN(COALESCE(u.name, CONCAT('Monitor IA ', a.avaliador_id)))
                WHEN LOWER(c.nome) LIKE '%firjan%' THEN 'Monitor IA Firjan'
                ELSE CONCAT('Monitor IA ', c.nome)
              END AS nome,
              1 AS ativo,
              a.cliente_id AS cliente_id,
              COUNT(DISTINCT a.id) AS avaliacoes,
              ROUND(COALESCE(AVG(a.score), 0), 1) AS score_medio,
              COUNT(DISTINCT a.campanha_id) AS campanhas,
              COALESCE(c.nome, 'Sem cliente vinculado') AS clientes,
              GROUP_CONCAT(DISTINCT ca.nome ORDER BY ca.nome SEPARATOR ', ') AS campanhas_nomes,
              MAX(a.data_avaliacao) AS ultima_avaliacao
         FROM avaliacoes a
         LEFT JOIN users u ON u.id = a.avaliador_id
         LEFT JOIN clientes c ON c.id = a.cliente_id
         LEFT JOIN campanhas ca ON ca.id = a.campanha_id
        ${where}
        GROUP BY a.cliente_id, c.nome
        ORDER BY ultima_avaliacao DESC, nome
        LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset },
    ),
  );

  const itens = rows.map((row) => ({
    id: String(row.id),
    slug: slug(row.nome, row.id),
    nome: row.nome,
    avatar: null,
    status: row.ativo ? "ativo" : "inativo",
    statusLabel: row.ativo ? "Ativo" : "Inativo",
    clienteId: row.cliente_id == null ? null : String(row.cliente_id),
    cliente: row.clientes || "Sem cliente vinculado",
    campanhas: inteiro(row.campanhas),
    campanhasNomes: row.campanhas_nomes || "",
    avaliacoes: inteiro(row.avaliacoes),
    scoreMedio: Number(row.score_medio || 0),
    ultimaAvaliacao: row.ultima_avaliacao,
  }));

  const chavesClientes = new Set(itens.map((item) => String(item.clienteId || "")).filter(Boolean));
  for (const cliente of clientes) {
    const clienteId = String(cliente.id);
    if (chavesClientes.has(clienteId)) continue;
    itens.push({
      id: `cliente-${cliente.id}`,
      slug: slug(cliente.nome, cliente.id),
      nome: /firjan/i.test(cliente.nome) ? "Monitor IA Firjan" : `Monitor IA ${cliente.nome}`,
      avatar: null,
      status: "ativo",
      statusLabel: "Ativo",
      clienteId,
      cliente: cliente.nome,
      campanhas: inteiro(cliente.campanhas),
      campanhasNomes: cliente.campanhas_nomes || "",
      avaliacoes: 0,
      scoreMedio: 0,
      ultimaAvaliacao: null,
    });
  }

  const configurados = itens
    .map((item) => aplicarConfiguracao(item, configuracoes.get(String(item.clienteId || "")), formulariosPorCliente.get(String(item.clienteId || "")) || []))
    .filter((item) => {
      if (!busca) return true;
      const alvo = String(busca).toLowerCase();
      return [item.nome, item.cliente, item.campanhasNomes, item.formularioIa].some((campo) => String(campo || "").toLowerCase().includes(alvo));
    });

  return {
    kpis: montarKpis(configurados),
    paginacao: { limit, offset, total: configurados.length },
    itens: configurados.slice(offset, offset + limit),
  };
}

export async function salvarConfiguracaoMonitorIa({ clienteId, formularioId, nome, prompt, ativo = true, userId, role }) {
  if (!(await tabelaConfiguracoesExiste())) {
    throw new Error("Tabela monitor_ia_configuracoes ausente. Rode o SQL de configuração do Monitor IA antes de salvar.");
  }
  const cliente = await one("SELECT id FROM clientes WHERE id = :clienteId LIMIT 1", { clienteId });
  if (!cliente) throw new Error("Cliente não encontrado.");
  if (role === "monitor") {
    const vinculo = await one(
      `SELECT id FROM users WHERE id = :userId AND cliente_id = :clienteId LIMIT 1`,
      { userId, clienteId },
    );
    if (!vinculo) throw new Error("Monitor só pode configurar Monitor IA da própria carteira.");
  }
  const formulario = await one(
    "SELECT id FROM formularios WHERE id = :formularioId AND cliente_id = :clienteId LIMIT 1",
    { formularioId, clienteId },
  );
  if (!formulario) throw new Error("Formulário não encontrado para este cliente.");
  await query(
    `INSERT INTO monitor_ia_configuracoes (cliente_id, formulario_id, nome, prompt, ativo, criado_por_id)
     VALUES (:clienteId, :formularioId, :nome, :prompt, :ativo, :userId)
     ON DUPLICATE KEY UPDATE formulario_id = VALUES(formulario_id), nome = VALUES(nome), prompt = VALUES(prompt), ativo = VALUES(ativo), atualizado_por_id = VALUES(criado_por_id), updated_at = CURRENT_TIMESTAMP`,
    { clienteId, formularioId, nome, prompt, ativo: ativo ? 1 : 0, userId },
  );
  return listarMonitoresIa({ limit: 200, offset: 0 });
}