import { config } from "../config";
import { isMissingSchemaError, one, paraLike, query } from "../db";
import { badRequest, conflict, notFound } from "../errors";
import { formatarDataHora, inteiro } from "../format";
import { hashPassword, verifyPassword } from "../security/passwords";

export const PAPEIS = [
  "administrador",
  "supervisor",
  "monitor",
  "operador",
  "viewer",
];

const LABEL_PAPEL = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  monitor: "Monitor",
  operador: "Operador",
  viewer: "Visualizador",
};

const cacheColunas = new Map();

const COLUNAS_USERS_CONHECIDAS = new Set([
  "cargo_id",
  "cliente_id",
  "ultimo_acesso_em",
  "turno_id",
  "supervisor_id",
  "external_code",
  "matricula",
  "login",
  "cpf",
  "data_inicio_produto",
  "hierarquia_vigencia",
  "hierarquia_motivo",
  "cliente_nome_importado",
  "campanhas_importadas",
  "superior_nome_importado",
  "turno_nome_importado",
  "trocar_senha",
  "senha_alterada_em",
]);

async function temColuna(tabela, coluna) {
  const chave = `${tabela}.${coluna}`;
  if (!cacheColunas.has(chave)) {
    cacheColunas.set(
      chave,
      query(
        `SELECT 1
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :tabela
            AND COLUMN_NAME = :coluna
          LIMIT 1`,
        { tabela, coluna },
      )
        .then((rows) => rows.length > 0)
        .catch((error) => {
          const fallback = tabela === "users" && COLUNAS_USERS_CONHECIDAS.has(coluna);
          console.warn(
            `[usuarios] falha ao verificar coluna ${tabela}.${coluna}: ${error?.code || "erro"} ${error?.message || error}. fallback=${fallback}`,
          );
          return fallback;
        }),
    );
  }
  return cacheColunas.get(chave);
}

async function temTabela(tabela) {
  const chave = `table.${tabela}`;
  if (!cacheColunas.has(chave)) {
    cacheColunas.set(
      chave,
      query(
        `SELECT 1
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :tabela
          LIMIT 1`,
        { tabela },
      )
        .then((rows) => rows.length > 0)
        .catch((error) => {
          const fallback = tabela === "user_campanhas";
          console.warn(
            `[usuarios] falha ao verificar tabela ${tabela}: ${error?.code || "erro"} ${error?.message || error}. fallback=${fallback}`,
          );
          return fallback;
        }),
    );
  }
  return cacheColunas.get(chave);
}

const VAZIO = {
  itens: [],
  contadores: { total: 0, ativos: 0, inativos: 0, semAcesso: 0 },
  opcoes: { cargos: [], papeis: [], clientes: [], campanhas: [], turnos: [], supervisores: [] },
  cadastroCompleto: false,
};

function textoOuNull(valor) {
  if (valor == null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

function dataOuNull(valor) {
  const texto = textoOuNull(valor);
  return texto && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

function emailDoUsuario({ email, login, nome }) {
  const informado = textoOuNull(email);
  if (informado) return informado.toLowerCase();
  const base =
    textoOuNull(login) ||
    String(nome || "usuario")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/(^\.|\.$)/g, "");
  return `${base || "usuario"}.${Date.now()}@qualiddm.local`;
}

async function carregarOpcoes({ temCargo, temCliente, temTurno, temUserCampanhas } = {}) {
  const [cargos, clientes, turnos, supervisores, campanhas] = await Promise.all([
    temCargo
      ? query(
          `SELECT id, nome, slug, role_base, nivel, sistema
             FROM cargos
            WHERE ativo = 1
            ORDER BY nivel DESC, nome`,
        ).catch(() => [])
      : Promise.resolve([]),
    temCliente
      ? query("SELECT id, nome FROM clientes WHERE ativo = 1 ORDER BY nome").catch(() => [])
      : Promise.resolve([]),
    temTurno
      ? query(
          `SELECT id, nome, hora_inicio, hora_fim, ativo
             FROM turnos
            ORDER BY ativo DESC, nome`,
        ).catch(() => [])
      : Promise.resolve([]),
    query(
      `SELECT id, name, email
         FROM users
        WHERE active = 1 AND role IN ('supervisor', 'administrador', 'monitor')
        ORDER BY name`,
    ).catch(() => []),
    temUserCampanhas
      ? query(
          `SELECT ca.id, ca.nome, ca.canal, ca.cliente_id, cl.nome AS cliente
             FROM campanhas ca
             LEFT JOIN clientes cl ON cl.id = ca.cliente_id
            WHERE ca.ativa = 1
            ORDER BY cl.nome, ca.nome`,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    cargos: cargos.map((cargo) => ({
      id: String(cargo.id),
      nome: cargo.nome,
      slug: cargo.slug,
      roleBase: cargo.role_base,
      sistema: inteiro(cargo.sistema) === 1,
    })),
    papeis: PAPEIS.map((id) => ({ id, nome: LABEL_PAPEL[id] })),
    clientes: clientes.map((cliente) => ({ id: String(cliente.id), nome: cliente.nome })),
    turnos: turnos.map((turno) => ({
      id: String(turno.id),
      codigo: turno.nome,
      descricao: turno.nome,
      horaInicio: turno.hora_inicio,
      horaFim: turno.hora_fim,
      ativo: inteiro(turno.ativo, 1) === 1,
    })),
    supervisores: supervisores.map((supervisor) => ({
      id: String(supervisor.id),
      nome: supervisor.name,
      email: supervisor.email,
    })),
    campanhas: campanhas.map((campanha) => ({
      id: String(campanha.id),
      nome: campanha.nome,
      canal: campanha.canal,
      clienteId: campanha.cliente_id == null ? null : String(campanha.cliente_id),
      cliente: campanha.cliente || "Sem cliente",
    })),
  };
}

export async function listarUsuarios({ filtros = {} } = {}) {
  const [
    temCargo,
    temCliente,
    temAcesso,
    temTurno,
    temSupervisor,
    temExternal,
    temMatricula,
    temLogin,
    temCpf,
    temDataInicio,
    temHierarquiaVigencia,
    temHierarquiaMotivo,
    temClienteImportado,
    temCampanhasImportadas,
    temSuperiorImportado,
    temTurnoImportado,
    temUserCampanhas,
  ] = await Promise.all([
    temColuna("users", "cargo_id"),
    temColuna("users", "cliente_id"),
    temColuna("users", "ultimo_acesso_em"),
    temColuna("users", "turno_id"),
    temColuna("users", "supervisor_id"),
    temColuna("users", "external_code"),
    temColuna("users", "matricula"),
    temColuna("users", "login"),
    temColuna("users", "cpf"),
    temColuna("users", "data_inicio_produto"),
    temColuna("users", "hierarquia_vigencia"),
    temColuna("users", "hierarquia_motivo"),
    temColuna("users", "cliente_nome_importado"),
    temColuna("users", "campanhas_importadas"),
    temColuna("users", "superior_nome_importado"),
    temColuna("users", "turno_nome_importado"),
    temTabela("user_campanhas"),
  ]);

  const condicoes = [];
  const params = { limite: 2001 };

  if (filtros.busca) {
    condicoes.push(`(
      u.name LIKE :busca OR u.email LIKE :busca
      ${temLogin ? "OR u.login LIKE :busca" : ""}
      ${temExternal ? "OR u.external_code LIKE :busca" : ""}
      ${temMatricula ? "OR u.matricula LIKE :busca" : ""}
    )`);
    params.busca = paraLike(filtros.busca);
  }
  if (filtros.papel) {
    condicoes.push("u.role = :papel");
    params.papel = filtros.papel;
  }
  if (temCargo && filtros.cargoId) {
    condicoes.push("u.cargo_id = :cargoId");
    params.cargoId = filtros.cargoId;
  }
  if (temCliente && filtros.clienteId) {
    condicoes.push("u.cliente_id = :clienteId");
    params.clienteId = filtros.clienteId;
  }
  if (filtros.situacao === "ativo") condicoes.push("u.active = 1");
  if (filtros.situacao === "inativo") condicoes.push("u.active = 0");

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join("\n          AND ")}` : "";

  try {
    const rows = await query(
      `SELECT
          u.id, u.name, u.email, u.role, u.active, u.created_at,
          ${temAcesso ? "u.ultimo_acesso_em" : "NULL AS ultimo_acesso_em"},
          ${temExternal ? "u.external_code" : "NULL AS external_code"},
          ${temMatricula ? "u.matricula" : "NULL AS matricula"},
          ${temLogin ? "u.login" : "NULL AS login"},
          ${temCpf ? "u.cpf" : "NULL AS cpf"},
          ${temDataInicio ? "u.data_inicio_produto" : "NULL AS data_inicio_produto"},
          ${temHierarquiaVigencia ? "u.hierarquia_vigencia" : "NULL AS hierarquia_vigencia"},
          ${temHierarquiaMotivo ? "u.hierarquia_motivo" : "NULL AS hierarquia_motivo"},
          ${temClienteImportado ? "u.cliente_nome_importado" : "NULL AS cliente_nome_importado"},
          ${temCampanhasImportadas ? "u.campanhas_importadas" : "NULL AS campanhas_importadas"},
          ${temSuperiorImportado ? "u.superior_nome_importado" : "NULL AS superior_nome_importado"},
          ${temTurnoImportado ? "u.turno_nome_importado" : "NULL AS turno_nome_importado"},
          ${temCargo ? "u.cargo_id, cg.nome AS cargo, cg.role_base" : "NULL AS cargo_id, NULL AS cargo, NULL AS role_base"},
          ${temCliente ? "u.cliente_id, cl.nome AS cliente" : "NULL AS cliente_id, NULL AS cliente"},
          ${temTurno ? "u.turno_id, tu.nome AS turno_codigo, tu.nome AS turno" : "NULL AS turno_id, NULL AS turno_codigo, NULL AS turno"},
          ${temSupervisor ? "u.supervisor_id, sup.name AS supervisor, sup.email AS supervisor_email" : "NULL AS supervisor_id, NULL AS supervisor, NULL AS supervisor_email"},
          ${temUserCampanhas ? "(SELECT COUNT(*) FROM user_campanhas uc WHERE uc.user_id = u.id AND uc.ativo = 1) AS total_campanhas, (SELECT GROUP_CONCAT(uc.campanha_id ORDER BY uc.campanha_id) FROM user_campanhas uc WHERE uc.user_id = u.id AND uc.ativo = 1) AS campanha_ids, (SELECT GROUP_CONCAT(ca.nome ORDER BY ca.nome SEPARATOR '||') FROM user_campanhas uc JOIN campanhas ca ON ca.id = uc.campanha_id WHERE uc.user_id = u.id AND uc.ativo = 1) AS campanha_nomes, (SELECT GROUP_CONCAT(DISTINCT cluc.nome ORDER BY cluc.nome SEPARATOR '||') FROM user_campanhas uc JOIN campanhas ca ON ca.id = uc.campanha_id LEFT JOIN clientes cluc ON cluc.id = ca.cliente_id WHERE uc.user_id = u.id AND uc.ativo = 1 AND cluc.nome IS NOT NULL) AS cliente_nomes" : "0 AS total_campanhas, NULL AS campanha_ids, NULL AS campanha_nomes, NULL AS cliente_nomes"}
         FROM users u
         ${temCargo ? "LEFT JOIN cargos cg ON cg.id = u.cargo_id" : ""}
         ${temCliente ? "LEFT JOIN clientes cl ON cl.id = u.cliente_id" : ""}
         ${temTurno ? "LEFT JOIN turnos tu ON tu.id = u.turno_id" : ""}
         ${temSupervisor ? "LEFT JOIN users sup ON sup.id = u.supervisor_id" : ""}
         ${where}
        ORDER BY u.active DESC, u.name
        LIMIT :limite`,
      params,
    );

    const excedeu = rows.length > 2000;
    const itens = (excedeu ? rows.slice(0, 2000) : rows).map((row) => {
      const campanhasImportadas = row.campanhas_importadas
        ? String(row.campanhas_importadas).split(",").map((item) => item.trim()).filter(Boolean)
        : [];
      const campanhas = row.campanha_nomes ? String(row.campanha_nomes).split("||") : campanhasImportadas;
      const clientes = row.cliente_nomes
        ? String(row.cliente_nomes).split("||")
        : row.cliente
          ? [row.cliente]
          : row.cliente_nome_importado
            ? String(row.cliente_nome_importado).split(",").map((item) => item.trim()).filter(Boolean)
            : [];

      return {
        id: String(row.id),
        nome: row.name,
        email: row.email,
        papel: row.role,
        papelLabel: LABEL_PAPEL[row.role] || row.role,
        cargoId: row.cargo_id == null ? null : String(row.cargo_id),
        cargo: row.cargo || null,
        clienteId: row.cliente_id == null ? null : String(row.cliente_id),
        cliente: row.cliente || textoOuNull(row.cliente_nome_importado),
        clientes,
        turnoId: row.turno_id == null ? null : String(row.turno_id),
        turno: row.turno || row.turno_codigo || textoOuNull(row.turno_nome_importado),
        supervisorId: row.supervisor_id == null ? null : String(row.supervisor_id),
        supervisor: row.supervisor || textoOuNull(row.superior_nome_importado),
        supervisorEmail: row.supervisor_email || null,
        login: row.login || null,
        cpf: row.cpf || null,
        matricula: row.matricula || row.external_code || null,
        dataInicioProduto: row.data_inicio_produto || null,
        hierarquiaVigencia: row.hierarquia_vigencia || null,
        hierarquiaMotivo: row.hierarquia_motivo || null,
        totalCampanhas: Math.max(inteiro(row.total_campanhas, 0), campanhas.length),
        campanhaIds: row.campanha_ids ? String(row.campanha_ids).split(",") : [],
        campanhas,
        ativo: inteiro(row.active, 1) === 1,
        criadoEm: formatarDataHora(row.created_at),
        ultimoAcesso: formatarDataHora(row.ultimo_acesso_em),
        nuncaAcessou: temAcesso ? row.ultimo_acesso_em == null : null,
      };
    });

    return {
      itens,
      contadores: {
        total: itens.length,
        ativos: itens.filter((item) => item.ativo).length,
        inativos: itens.filter((item) => !item.ativo).length,
        semAcesso: itens.filter((item) => item.nuncaAcessou === true).length,
      },
      opcoes: await carregarOpcoes({ temCargo, temCliente, temTurno, temUserCampanhas }),
      cadastroCompleto: temCargo && temCliente && temAcesso,
      excedeuTeto: excedeu,
    };
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      console.warn(`[usuarios] listarUsuarios: ${error?.code || "erro"} ${error?.message || error}`);
    }
    return VAZIO;
  }
}

export async function matrizPermissoes() {
  try {
    const [cargos, permissoes, vinculos] = await Promise.all([
      query(
        `SELECT id, nome, slug, role_base, nivel
           FROM cargos
          WHERE ativo = 1
          ORDER BY nivel DESC, nome`,
      ),
      query(
        `SELECT id, slug, modulo, recurso, acao, nome
           FROM permissoes
          ORDER BY modulo, recurso, acao`,
      ),
      query("SELECT cargo_id, permissao_id FROM cargo_permissoes"),
    ]);

    const concedidas = new Set(vinculos.map((vinculo) => `${vinculo.cargo_id}:${vinculo.permissao_id}`));
    const modulos = new Map();
    for (const permissao of permissoes) {
      if (!modulos.has(permissao.modulo)) modulos.set(permissao.modulo, []);
      modulos.get(permissao.modulo).push({
        id: String(permissao.id),
        slug: permissao.slug,
        nome: permissao.nome,
        recurso: permissao.recurso,
        acao: permissao.acao,
        cargos: cargos.map((cargo) => concedidas.has(`${cargo.id}:${permissao.id}`)),
      });
    }

    return {
      cargos: cargos.map((cargo) => ({ id: String(cargo.id), nome: cargo.nome, roleBase: cargo.role_base })),
      modulos: [...modulos.entries()].map(([modulo, itens]) => ({ modulo, itens })),
      total: permissoes.length,
      suportada: true,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return { cargos: [], modulos: [], total: 0, suportada: false };
    return { cargos: [], modulos: [], total: 0, suportada: false };
  }
}

/**
 * Senha com que todo acesso nasce, e a que o reset devolve.
 *
 * Antes isto sorteava uma senha por pessoa e a mostrava uma única vez na tela
 * de quem criou. Virou uma senha padrão única por decisão da operação: cadastrar
 * 219 pessoas anotando 219 senhas diferentes não se sustenta, e o suporte
 * precisa poder dizer a senha inicial por telefone.
 *
 * O que torna isso aceitável é a trava, não a senha: `trocar_senha = 1` fica
 * gravado e `requireSession` recusa qualquer rota de dados enquanto estiver
 * assim — a pessoa entra, troca, e só então o sistema abre. Sem essa trava a
 * senha padrão seria uma chave-mestra para toda conta que ainda não acessou.
 *
 * Vem de `AUTH_SENHA_PADRAO`, para trocar sem deploy.
 */
export function senhaPadrao() {
  return config.auth.senhaPadrao;
}

export async function criarUsuario({
  nome,
  email,
  papel,
  cargoId = null,
  clienteId = null,
  turnoId = null,
  supervisorId = null,
  login = null,
  cpf = null,
  matricula = null,
  dataInicioProduto = null,
  hierarquiaVigencia = null,
  hierarquiaMotivo = null,
}) {
  const emailFinal = emailDoUsuario({ email, login, nome });
  const existente = await one("SELECT id FROM users WHERE email = :email LIMIT 1", { email: emailFinal });
  if (existente) throw conflict(`Ja existe usuario com o e-mail ${emailFinal}.`);

  const senha = senhaPadrao();
  const colunas = ["name", "email", "password_hash", "role", "active"];
  const valores = [":nome", ":email", ":hash", ":papel", "1"];
  const params = { nome, email: emailFinal, hash: hashPassword(senha), papel };

  const opcionais = [
    ["cargo_id", cargoId],
    ["cliente_id", clienteId],
    ["turno_id", turnoId],
    ["supervisor_id", supervisorId],
    ["login", login],
    ["cpf", cpf],
    ["matricula", matricula],
    ["data_inicio_produto", dataOuNull(dataInicioProduto)],
    ["hierarquia_vigencia", dataOuNull(hierarquiaVigencia)],
    ["hierarquia_motivo", hierarquiaMotivo],
  ];

  for (const [coluna, valor] of opcionais) {
    if (valor !== undefined && (await temColuna("users", coluna))) {
      const parametro = coluna.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());
      colunas.push(coluna);
      valores.push(`:${parametro}`);
      params[parametro] = textoOuNull(valor);
    }
  }

  if (await temColuna("users", "trocar_senha")) {
    colunas.push("trocar_senha");
    valores.push("1");
  }

  await query(`INSERT INTO users (${colunas.join(", ")}) VALUES (${valores.join(", ")})`, params);
  /* `senhaPadrao: true` diz à tela que essa senha é a de todos, e que ela
     PODE ser dita em voz alta — diferente de uma provisória sorteada, que só
     aparecia uma vez. */
  return { email: emailFinal, senhaInicial: senha, senhaPadrao: true };
}

export async function atualizarUsuario(
  usuarioId,
  {
    ativo,
    papel,
    cargoId,
    clienteId,
    turnoId,
    supervisorId,
    nome,
    email,
    login,
    cpf,
    matricula,
    dataInicioProduto,
    hierarquiaVigencia,
    hierarquiaMotivo,
  },
) {
  const usuario = await one("SELECT id, active, role FROM users WHERE id = :id LIMIT 1", { id: usuarioId });
  if (!usuario) throw notFound("Usuario nao encontrado.");

  const campos = [];
  const params = { id: usuarioId };

  const setar = async (coluna, parametro, valor, transform = textoOuNull) => {
    if (valor === undefined || !(await temColuna("users", coluna))) return;
    campos.push(`${coluna} = :${parametro}`);
    params[parametro] = transform(valor);
  };

  if (ativo !== undefined) {
    campos.push("active = :ativo");
    params.ativo = ativo ? 1 : 0;
  }
  if (papel !== undefined) {
    campos.push("role = :papel");
    params.papel = papel;
  }
  if (nome !== undefined) {
    campos.push("name = :nome");
    params.nome = textoOuNull(nome);
  }
  if (email !== undefined) {
    campos.push("email = :email");
    params.email = emailDoUsuario({ email, login, nome: nome || "usuario" });
  }

  await setar("cargo_id", "cargoId", cargoId);
  await setar("cliente_id", "clienteId", clienteId);
  await setar("turno_id", "turnoId", turnoId);
  await setar("supervisor_id", "supervisorId", supervisorId);
  await setar("login", "login", login);
  await setar("cpf", "cpf", cpf);
  await setar("matricula", "matricula", matricula);
  await setar("data_inicio_produto", "dataInicioProduto", dataInicioProduto, dataOuNull);
  await setar("hierarquia_vigencia", "hierarquiaVigencia", hierarquiaVigencia, dataOuNull);
  await setar("hierarquia_motivo", "hierarquiaMotivo", hierarquiaMotivo);

  if (campos.length === 0) throw badRequest("Envie ao menos um campo para alterar.");

  await query(`UPDATE users SET ${campos.join(", ")} WHERE id = :id`, params);
  return { id: String(usuarioId) };
}

export async function salvarCampanhasUsuario(usuarioId, campanhaIds = []) {
  if (!(await temTabela("user_campanhas"))) {
    throw badRequest("Tabela user_campanhas ainda nao existe. Aplique a migration 011.");
  }

  const usuario = await one("SELECT id FROM users WHERE id = :id LIMIT 1", { id: usuarioId });
  if (!usuario) throw notFound("Usuario nao encontrado.");

  const ids = [...new Set((Array.isArray(campanhaIds) ? campanhaIds : []).map(String).filter((id) => /^\d{1,20}$/.test(id)))];

  await query("DELETE FROM user_campanhas WHERE user_id = :usuarioId", { usuarioId });
  for (const campanhaId of ids) {
    await query(
      `INSERT INTO user_campanhas (user_id, campanha_id, ativo)
       VALUES (:usuarioId, :campanhaId, 1)`,
      { usuarioId, campanhaId },
    );
  }

  return { id: String(usuarioId), campanhaIds: ids };
}

export async function resetarSenha(usuarioId) {
  const usuario = await one("SELECT id, name, email FROM users WHERE id = :id LIMIT 1", { id: usuarioId });
  if (!usuario) throw notFound("Usuario nao encontrado.");

  const senha = senhaPadrao();
  const [temTrocar, temAlterada] = await Promise.all([
    temColuna("users", "trocar_senha"),
    temColuna("users", "senha_alterada_em"),
  ]);

  await query(
    `UPDATE users
        SET password_hash = :hash
            ${temTrocar ? ", trocar_senha = 1" : ""}
            ${temAlterada ? ", senha_alterada_em = CURRENT_TIMESTAMP" : ""}
      WHERE id = :id`,
    { id: usuarioId, hash: hashPassword(senha) },
  );

  return { id: String(usuario.id), nome: usuario.name, email: usuario.email, senhaInicial: senha, senhaPadrao: true };
}

/**
 * Troca da senha pela própria pessoa.
 *
 * Pede a senha atual mesmo com o cookie de sessão válido: sem isso, um
 * navegador esquecido aberto vira troca de senha e sequestro definitivo da
 * conta. Só a pessoa muda a própria senha por aqui — administrador não passa
 * por esta função, ele usa `resetarSenha`, que fica na trilha de auditoria.
 */
export async function alterarSenhaPropria(usuarioId, { senhaAtual, novaSenha }) {
  const minimo = config.auth.senhaMinima;

  const usuario = await one(
    "SELECT id, name, email, password_hash FROM users WHERE id = :id AND active = 1 LIMIT 1",
    { id: usuarioId },
  );
  if (!usuario) throw notFound("Usuário não encontrado.");

  if (!verifyPassword(String(senhaAtual || ""), usuario.password_hash)) {
    // Mensagem única para senha errada, sem dizer se a atual "quase" bateu.
    throw badRequest("Senha atual incorreta.");
  }

  const nova = String(novaSenha || "");
  if (nova.length < minimo) {
    throw badRequest(`A nova senha precisa ter pelo menos ${minimo} caracteres.`);
  }
  if (nova === senhaPadrao()) {
    // O ponto da troca é sair da senha padrão. Aceitar ela de volta como "nova"
    // deixaria a trava satisfeita e a conta na mesma situação.
    throw badRequest("Escolha uma senha diferente da senha padrão do sistema.");
  }
  if (verifyPassword(nova, usuario.password_hash)) {
    throw badRequest("A nova senha é igual à atual.");
  }

  const [temTrocar, temAlterada] = await Promise.all([
    temColuna("users", "trocar_senha"),
    temColuna("users", "senha_alterada_em"),
  ]);

  await query(
    `UPDATE users
        SET password_hash = :hash
            ${temTrocar ? ", trocar_senha = 0" : ""}
            ${temAlterada ? ", senha_alterada_em = CURRENT_TIMESTAMP" : ""}
      WHERE id = :id`,
    { id: usuarioId, hash: hashPassword(nova) },
  );

  return { id: String(usuario.id), nome: usuario.name, email: usuario.email };
}
