import { one, query, transaction } from "../db";
import { conflict, notFound } from "../errors";
import { CLIENTES_INICIAIS } from "../catalogo-inicial";

const OPTIONAL_SCHEMA_ERRORS = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"]);

function isOptionalSchemaError(error) {
  return OPTIONAL_SCHEMA_ERRORS.has(error?.code);
}

export function listWallets() {
  return query(
    `SELECT id, name, description, active, created_at
       FROM wallets
      ORDER BY name`
  );
}

export function listOperators() {
  return query(
    `SELECT o.id, o.name, o.external_code, o.active, w.name AS wallet_name
       FROM operators o
       LEFT JOIN wallets w ON w.id = o.wallet_id
      ORDER BY o.name`
  );
}

export function listChecklists() {
  return query(
    `SELECT t.id, t.name, t.version, t.active, w.name AS wallet_name,
            COUNT(i.id) AS items_count
       FROM checklist_templates t
       JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN checklist_items i ON i.template_id = t.id
      GROUP BY t.id, t.name, t.version, t.active, w.name
      ORDER BY w.name, t.name`
  );
}

function slugCliente(nome) {
  return String(nome || "cliente")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110) || `cliente-${Date.now()}`;
}

function ativoCliente(status) {
  return status === "Inativo" || status === "inativo" || status === false ? 0 : 1;
}

function tratarDuplicidadeCliente(error) {
  if (error?.code === "ER_DUP_ENTRY") {
    throw conflict("JÃ¡ existe um cliente com esse nome.");
  }
  throw error;
}

export async function createCliente({ nome, status = "Ativo", contrato = null }) {
  try {
    await query(
      `INSERT INTO clientes (slug, nome, contrato, ativo)
       VALUES (:slug, :nome, :contrato, :ativo)`,
      {
        slug: slugCliente(nome),
        nome,
        contrato: contrato || null,
        ativo: ativoCliente(status),
      },
    );
  } catch (error) {
    tratarDuplicidadeCliente(error);
  }

  return getClientesOverview();
}

export async function updateCliente(id, { nome, status = "Ativo", contrato = null }) {
  const atual = await one("SELECT id FROM clientes WHERE slug = :id OR id = :id LIMIT 1", { id });
  if (!atual) throw notFound("Cliente nÃ£o encontrado.");

  try {
    await query(
      `UPDATE clientes
          SET slug = :slug,
              nome = :nome,
              contrato = :contrato,
              ativo = :ativo
        WHERE id = :id`,
      {
        id: atual.id,
        slug: slugCliente(nome),
        nome,
        contrato: contrato || null,
        ativo: ativoCliente(status),
      },
    );
  } catch (error) {
    tratarDuplicidadeCliente(error);
  }

  return getClientesOverview();
}

export async function deactivateCliente(id) {
  const result = await query(
    `UPDATE clientes
        SET ativo = 0
      WHERE slug = :id OR id = :id`,
    { id },
  );

  if (result.affectedRows === 0) throw notFound("Cliente nÃ£o encontrado.");
  return getClientesOverview();
}

export async function getFormulariosOverview() {
  try {
    const [kpis] = await query(
      `SELECT
          COUNT(*) AS total,
          SUM(status = 'ativo') AS ativos,
          SUM(status = 'desenvolvimento') AS desenvolvimento
         FROM formularios`
    );

    const [questoes] = await query(
      `SELECT COUNT(*) AS total
         FROM formulario_criterios`
    );

    const recentes = await query(
      `SELECT
          f.id,
          f.nome,
          f.categoria,
          f.status,
          f.versao,
          f.created_at,
          f.updated_at,
          cl.nome AS cliente,
          GROUP_CONCAT(DISTINCT ca.nome ORDER BY ca.nome SEPARATOR ', ') AS campanha,
          COUNT(DISTINCT fc.campanha_id) AS campanhas,
          COUNT(DISTINCT i.id) AS questoes
         FROM formularios f
         LEFT JOIN clientes cl ON cl.id = f.cliente_id
         LEFT JOIN formulario_campanhas fc ON fc.formulario_id = f.id
         LEFT JOIN campanhas ca ON ca.id = fc.campanha_id
         LEFT JOIN formulario_secoes s ON s.formulario_id = f.id
         LEFT JOIN formulario_criterios i ON i.secao_id = s.id
        GROUP BY f.id, f.nome, f.categoria, f.status, f.versao, f.created_at, f.updated_at, cl.nome
        ORDER BY f.updated_at DESC, f.id DESC
        LIMIT 20`
    );

    return {
      kpis: {
        total: Number(kpis?.total ?? 0),
        ativos: Number(kpis?.ativos ?? 0),
        desenvolvimento: Number(kpis?.desenvolvimento ?? 0),
        questoes: Number(questoes?.total ?? 0),
      },
      recentes: recentes.map((form) => ({
        id: String(form.id),
        nome: form.nome,
        categoria: form.categoria,
        status: form.status,
        versao: Number(form.versao ?? 1),
        cliente: form.cliente || null,
        campanha: form.campanha || null,
        campanhas: Number(form.campanhas ?? 0),
        questoes: Number(form.questoes ?? 0),
        criadoEm: form.created_at,
      })),
    };
  } catch {
    return {
      kpis: { total: 0, ativos: 0, desenvolvimento: 0, questoes: 0 },
      recentes: [],
    };
  }
}

export async function createFormulario({ clienteId, nome, categoria = "padrao", status = "rascunho" }) {
  const cliente = await one(
    "SELECT id FROM clientes WHERE id = :clienteId OR slug = :clienteId LIMIT 1",
    { clienteId }
  );
  if (!cliente) {
    throw new Error("Cliente não encontrado.");
  }

  const versao = await one(
    `SELECT COALESCE(MAX(versao), 0) + 1 AS proxima
       FROM formularios
      WHERE cliente_id = :clienteId
        AND nome = :nome`,
    { clienteId: cliente.id, nome }
  );

  await query(
    `INSERT INTO formularios (cliente_id, nome, categoria, status, versao)
     VALUES (:clienteId, :nome, :categoria, :status, :versao)`,
    {
      clienteId: cliente.id,
      nome,
      categoria,
      status,
      versao: Number(versao?.proxima ?? 1),
    }
  );

  return getFormulariosOverview();
}

export async function getFormularioParaAvaliacaoIa({ formularioId = null } = {}) {
  const filtroFormulario = formularioId ? "AND f.id = :formularioId" : "";
  const formulario = await one(
    `SELECT
        f.id,
        f.nome,
        f.categoria,
        f.cliente_id,
        c.nome AS cliente,
        ca.id AS campanha_id,
        ca.nome AS campanha
       FROM formularios f
       JOIN clientes c ON c.id = f.cliente_id
       LEFT JOIN formulario_campanhas fc ON fc.formulario_id = f.id
       LEFT JOIN campanhas ca ON ca.id = fc.campanha_id
      WHERE f.status IN ('ativo', 'desenvolvimento')
        ${filtroFormulario}
      ORDER BY f.status = 'ativo' DESC, f.updated_at DESC, f.id DESC
      LIMIT 1`,
    { formularioId }
  );

  if (!formulario) return null;

  const rows = await query(
    `SELECT
        s.id AS secao_id,
        s.nome AS secao_nome,
        s.descricao AS secao_descricao,
        s.posicao AS secao_posicao,
        c.id AS criterio_id,
        c.nome AS criterio_nome,
        c.enunciado,
        c.peso_pts,
        c.eliminatoria,
        c.posicao AS criterio_posicao
       FROM formulario_secoes s
       JOIN formulario_criterios c ON c.secao_id = s.id
      WHERE s.formulario_id = :formularioId
      ORDER BY s.posicao, c.posicao`,
    { formularioId: formulario.id }
  );

  const secoes = [];
  const porSecao = new Map();
  for (const row of rows) {
    if (!porSecao.has(row.secao_id)) {
      const secao = {
        id: row.secao_id,
        nome: row.secao_nome,
        descricao: row.secao_descricao,
        criterios: [],
      };
      porSecao.set(row.secao_id, secao);
      secoes.push(secao);
    }

    porSecao.get(row.secao_id).criterios.push({
      id: row.criterio_id,
      nome: row.criterio_nome,
      enunciado: row.enunciado,
      peso: row.peso_pts == null ? null : Number(row.peso_pts),
      eliminatoria: Boolean(row.eliminatoria),
    });
  }

  return { ...formulario, secoes };
}

function codigoAvaliacao() {
  const ano = String(new Date().getFullYear()).slice(-2);
  const sufixo = String(Date.now()).slice(-6);
  return `QA-${ano}-${sufixo}`;
}

function respostaPorStatus(status) {
  if (status === "conforme") return "sim";
  if (status === "nao_conforme") return "nao";
  return null;
}

export async function createAvaliacaoFromIa({ formulario, resultado, arquivo, avaliadorId }) {
  const avaliado = await one(
    `SELECT id
       FROM users
      WHERE active = 1
        AND role IN ('operador', 'monitor', 'supervisor')
      ORDER BY role = 'operador' DESC, id
      LIMIT 1`
  );

  if (!avaliado) {
    throw new Error("Nenhum usuário ativo encontrado para vincular como avaliado.");
  }

  const codigo = codigoAvaliacao();
  const criteriosPorNome = new Map(
    formulario.secoes.flatMap((secao) => secao.criterios.map((criterio) => [criterio.nome, criterio]))
  );

  return transaction(async (connection) => {
    const [insert] = await connection.execute(
      `INSERT INTO avaliacoes (
          codigo, cod_gravacao, cliente_id, campanha_id, formulario_id,
          avaliado_id, avaliador_id, categoria, origem, score, zerada,
          audio_path, data_contato, data_avaliacao, status_feedback,
          total_conformes, total_nao_conformes, total_nao_aplicaveis, total_criterios
       ) VALUES (
          :codigo, :codGravacao, :clienteId, :campanhaId, :formularioId,
          :avaliadoId, :avaliadorId, :categoria, 'ia', :score, :zerada,
          :audioPath, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pendente',
          :conformes, :naoConformes, :naoAplicaveis, :total
       )`,
      {
        codigo,
        codGravacao: arquivo?.nome?.slice(0, 60) || null,
        clienteId: formulario.cliente_id,
        campanhaId: formulario.campanha_id || null,
        formularioId: formulario.id,
        avaliadoId: avaliado.id,
        avaliadorId,
        categoria: formulario.categoria || "padrao",
        score: resultado.resumo.score,
        zerada: resultado.resumo.zerada ? 1 : 0,
        audioPath: arquivo?.storagePath || arquivo?.nome || null,
        conformes: resultado.resumo.conforme,
        naoConformes: resultado.resumo.nao_conforme,
        naoAplicaveis: resultado.resumo.nao_aplicavel,
        total: resultado.resumo.total,
      }
    );

    const avaliacaoId = insert.insertId;
    for (const secao of resultado.secoes) {
      for (const item of secao.criterios) {
        const criterio = criteriosPorNome.get(item.nome);
        if (!criterio) continue;

        const status = item.status || "nao_aplicavel";
        await connection.execute(
          `INSERT INTO avaliacao_respostas (
              avaliacao_id, criterio_id, resposta, status, peso_aplicado, observacao_monitor
           ) VALUES (
              :avaliacaoId, :criterioId, :resposta, :status, :pesoAplicado, :observacao
           )`,
          {
            avaliacaoId,
            criterioId: criterio.id,
            resposta: respostaPorStatus(status),
            status,
            pesoAplicado: status === "conforme" ? criterio.peso : 0,
            observacao: item.justificativa,
          }
        );
      }
    }

    return { codigo, avaliacaoId };
  });
}

export async function listJustificativas() {
  try {
    return await query(
      `SELECT
          a.codigo AS avaliacao,
          a.data_avaliacao,
          av.name AS avaliado,
          av.email AS avaliado_email,
          mo.name AS avaliador,
          f.nome AS formulario,
          c.nome AS criterio,
          r.observacao_monitor AS justificativa
         FROM avaliacao_respostas r
         JOIN avaliacoes a ON a.id = r.avaliacao_id
         JOIN users av ON av.id = a.avaliado_id
         JOIN users mo ON mo.id = a.avaliador_id
         JOIN formulario_criterios c ON c.id = r.criterio_id
         JOIN formularios f ON f.id = a.formulario_id
        WHERE r.observacao_monitor IS NOT NULL
          AND r.observacao_monitor <> ''
        ORDER BY a.data_avaliacao DESC`
    );
  } catch (error) {
    if (isOptionalSchemaError(error)) return [];
    return [];
  }
}

export async function listMonitoriasEditadas() {
  try {
    return await query(
      `SELECT
          l.acao,
          l.entidade,
          l.entidade_id,
          l.detalhe,
          l.created_at,
          u.name AS usuario
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.entidade IN ('avaliacoes', 'avaliacao_respostas', 'formularios')
           OR l.acao LIKE '%edit%'
           OR l.acao LIKE '%edi%'
        ORDER BY l.created_at DESC
        LIMIT 100`
    );
  } catch (error) {
    if (isOptionalSchemaError(error)) return [];
    return [];
  }
}

export async function getClientesOverview() {
  let clientes;
  let bancoDisponivel = false;
  try {
    clientes = await query(
      `SELECT
          c.slug AS id,
          c.nome,
          c.contrato,
          c.ativo,
          COUNT(DISTINCT f.id) AS formularios,
          COUNT(DISTINCT a.id) AS monitorias,
          ROUND(COALESCE(AVG(a.score), 0), 1) AS score_medio
         FROM clientes c
         LEFT JOIN formularios f ON f.cliente_id = c.id
         LEFT JOIN avaliacoes a ON a.cliente_id = c.id
        WHERE c.ativo = 1
        GROUP BY c.id, c.slug, c.nome, c.contrato, c.ativo
        ORDER BY c.nome`
    );
    bancoDisponivel = true;
  } catch {
    clientes = [];
  }

  const fonte = bancoDisponivel
    ? clientes
    : CLIENTES_INICIAIS.map((cliente) => ({ ...cliente, ativo: 1, formularios: 0, monitorias: 0, score_medio: 0 }));

  const rows = fonte.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nome,
    status: cliente.ativo ? "Ativa" : "Inativa",
    formularios: Number(cliente.formularios ?? 0),
    monitorias: Number(cliente.monitorias ?? 0),
    scoreMedio: Number(cliente.score_medio ?? 0),
    contrato: cliente.contrato || null,
  }));

  const monitorias = rows.reduce((total, cliente) => total + cliente.monitorias, 0);

  return {
    kpis: {
      total: rows.length,
      ativos: rows.filter((cliente) => cliente.status === "Ativa").length,
      formularios: rows.reduce((total, cliente) => total + cliente.formularios, 0),
      contratos: rows.filter((cliente) => cliente.contrato).length,
      monitorias,
      scoreMedio: monitorias > 0
        ? Number((rows.reduce((total, cliente) => total + cliente.scoreMedio * cliente.monitorias, 0) / monitorias).toFixed(1))
        : 0,
    },
    clientes: rows,
  };
}
