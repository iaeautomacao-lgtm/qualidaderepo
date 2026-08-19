import { randomBytes } from "crypto";
import { isMissingSchemaError, one, paraLike, query } from "../db";
import { badRequest, conflict, notFound } from "../errors";
import { formatarDataHora, inteiro } from "../format";
import { hashPassword } from "../security/passwords";

/**
 * Gestão de usuários: lista, cargos, matriz de permissões e senha.
 *
 * Separado de `administracao.js`, que responde pelas MÉTRICAS do painel (sessões,
 * auditoria, workflow). Aqui é o cadastro das pessoas.
 */

export const PAPEIS = ["administrador", "supervisor", "monitor", "operador", "viewer"];

const LABEL_PAPEL = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  monitor: "Monitor",
  operador: "Operador",
  viewer: "Visualizador",
};

const cacheColunas = new Map();

/** Coluna presente? Memoizado. Tabela e coluna são literais deste módulo. */
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

const VAZIO = {
  itens: [],
  contadores: { total: 0, ativos: 0, inativos: 0, semAcesso: 0 },
  opcoes: { cargos: [], papeis: [], clientes: [] },
  cadastroCompleto: false,
};

/**
 * Lista os usuários com o recorte da tela.
 *
 * Sem paginação de propósito: a operação tem dezenas de pessoas, não milhares, e
 * a tela oferece "Cards" e "Exportar", que precisam do conjunto inteiro. O teto
 * de 2000 existe como freio, não como janela — se um dia estourar, a tela avisa
 * em vez de mostrar metade calada.
 */
export async function listarUsuarios({ filtros = {} } = {}) {
  const [temCargo, temCliente, temAcesso] = await Promise.all([
    temColuna("users", "cargo_id"),
    temColuna("users", "cliente_id"),
    temColuna("users", "ultimo_acesso_em"),
  ]);

  const condicoes = [];
  const params = { limite: 2001 };

  if (filtros.busca) {
    // Nome e e-mail: são os dois campos que a pessoa que busca conhece de cor.
    condicoes.push("(u.name LIKE :busca OR u.email LIKE :busca)");
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
          ${temCargo ? "u.cargo_id, cg.nome AS cargo, cg.role_base" : "NULL AS cargo_id, NULL AS cargo, NULL AS role_base"},
          ${temCliente ? "u.cliente_id, cl.nome AS cliente" : "NULL AS cliente_id, NULL AS cliente"}
         FROM users u
         ${temCargo ? "LEFT JOIN cargos cg ON cg.id = u.cargo_id" : ""}
         ${temCliente ? "LEFT JOIN clientes cl ON cl.id = u.cliente_id" : ""}
         ${where}
        ORDER BY u.active DESC, u.name
        LIMIT :limite`,
      params,
    );

    const excedeu = rows.length > 2000;
    const itens = (excedeu ? rows.slice(0, 2000) : rows).map((row) => ({
      id: String(row.id),
      nome: row.name,
      email: row.email,
      papel: row.role,
      papelLabel: LABEL_PAPEL[row.role] || row.role,
      // Cargo é o nome que a operação usa ("Monitor Feedback", "Jovem
      // Aprendiz"); `role` é o papel de acesso. São coisas diferentes e a tela
      // mostra as duas.
      cargoId: row.cargo_id == null ? null : String(row.cargo_id),
      cargo: row.cargo || null,
      clienteId: row.cliente_id == null ? null : String(row.cliente_id),
      cliente: row.cliente || null,
      ativo: inteiro(row.active, 1) === 1,
      criadoEm: formatarDataHora(row.created_at),
      ultimoAcesso: formatarDataHora(row.ultimo_acesso_em),
      // Quem nunca acessou é o caso que a supervisão procura depois de importar
      // uma planilha: cadastro criado e pessoa que não entrou.
      nuncaAcessou: temAcesso ? row.ultimo_acesso_em == null : null,
    }));

    const [cargos, clientes] = await Promise.all([
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
    ]);

    return {
      itens,
      contadores: {
        total: itens.length,
        ativos: itens.filter((item) => item.ativo).length,
        inativos: itens.filter((item) => !item.ativo).length,
        semAcesso: itens.filter((item) => item.nuncaAcessou === true).length,
      },
      opcoes: {
        cargos: cargos.map((cargo) => ({
          id: String(cargo.id),
          nome: cargo.nome,
          slug: cargo.slug,
          roleBase: cargo.role_base,
          sistema: inteiro(cargo.sistema) === 1,
        })),
        papeis: PAPEIS.map((id) => ({ id, nome: LABEL_PAPEL[id] })),
        clientes: clientes.map((cliente) => ({ id: String(cliente.id), nome: cliente.nome })),
      },
      cadastroCompleto: temCargo && temCliente && temAcesso,
      excedeuTeto: excedeu,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return VAZIO;
    return VAZIO;
  }
}

/**
 * Matriz de permissões: cargos nas colunas, permissões nas linhas.
 *
 * Leitura, não edição. Editar permissão é mudar quem pode o quê no sistema
 * inteiro, e isso não se faz num clique de célula sem confirmação nem trilha —
 * a tela mostra o que está configurado e diz onde se altera.
 */
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

    const concedidas = new Set(
      vinculos.map((vinculo) => `${vinculo.cargo_id}:${vinculo.permissao_id}`),
    );

    // Agrupado por módulo: a matriz crua tem dezenas de linhas e ninguém lê
    // "monitoria.avaliacao.criar" seguido de "usuario.cargo.editar" sem separação.
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
      cargos: cargos.map((cargo) => ({
        id: String(cargo.id),
        nome: cargo.nome,
        roleBase: cargo.role_base,
      })),
      modulos: [...modulos.entries()].map(([modulo, itens]) => ({ modulo, itens })),
      total: permissoes.length,
      suportada: true,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return { cargos: [], modulos: [], total: 0, suportada: false };
    }
    return { cargos: [], modulos: [], total: 0, suportada: false };
  }
}

/** Senha provisória legível: o supervisor dita por telefone quando precisa. */
function senhaProvisoria() {
  // Sem I, O, 0 e 1: a senha é ditada por telefone, e esses quatro se confundem.
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // `randomBytes` e não Math.random: senha provisória é credencial, e gerador
  // previsível transforma "resetar senha" em porta aberta. Mesmo módulo que
  // security/passwords.js usa.
  const bytes = randomBytes(8);
  let senha = "";
  for (const byte of bytes) senha += alfabeto[byte % alfabeto.length];
  return `Ddm-${senha.slice(0, 4)}-${senha.slice(4, 8)}`;
}

export async function criarUsuario({ nome, email, papel, cargoId = null, clienteId = null }) {
  const existente = await one("SELECT id FROM users WHERE email = :email LIMIT 1", { email });
  if (existente) throw conflict(`Já existe usuário com o e-mail ${email}.`);

  const [temCargo, temCliente, temTrocar] = await Promise.all([
    temColuna("users", "cargo_id"),
    temColuna("users", "cliente_id"),
    temColuna("users", "trocar_senha"),
  ]);

  const senha = senhaProvisoria();
  const colunas = ["name", "email", "password_hash", "role", "active"];
  const valores = [":nome", ":email", ":hash", ":papel", "1"];
  const params = { nome, email, hash: hashPassword(senha), papel };

  if (temCargo && cargoId) {
    colunas.push("cargo_id");
    valores.push(":cargoId");
    params.cargoId = cargoId;
  }
  if (temCliente && clienteId) {
    colunas.push("cliente_id");
    valores.push(":clienteId");
    params.clienteId = clienteId;
  }
  // Nasce obrigado a trocar: senha que o administrador conhece não pode seguir
  // valendo depois do primeiro acesso.
  if (temTrocar) {
    colunas.push("trocar_senha");
    valores.push("1");
  }

  await query(
    `INSERT INTO users (${colunas.join(", ")}) VALUES (${valores.join(", ")})`,
    params,
  );

  return { email, senhaProvisoria: senha };
}

/**
 * Ativa, desativa ou muda cargo/papel de um usuário.
 *
 * Nunca apaga: pessoa é autora de avaliação, feedback e contestação, e apagar a
 * linha levaria a autoria de tudo isso. Desativar é a exclusão de gente aqui.
 */
export async function atualizarUsuario(usuarioId, { ativo, papel, cargoId, clienteId }) {
  const usuario = await one("SELECT id, active, role FROM users WHERE id = :id LIMIT 1", {
    id: usuarioId,
  });
  if (!usuario) throw notFound("Usuário não encontrado.");

  const campos = [];
  const params = { id: usuarioId };

  if (ativo !== undefined) {
    campos.push("active = :ativo");
    params.ativo = ativo ? 1 : 0;
  }
  if (papel !== undefined) {
    campos.push("role = :papel");
    params.papel = papel;
  }
  if (cargoId !== undefined && (await temColuna("users", "cargo_id"))) {
    campos.push("cargo_id = :cargoId");
    params.cargoId = cargoId || null;
  }
  if (clienteId !== undefined && (await temColuna("users", "cliente_id"))) {
    campos.push("cliente_id = :clienteId");
    params.clienteId = clienteId || null;
  }

  if (campos.length === 0) throw badRequest("Envie ao menos um campo para alterar.");

  await query(`UPDATE users SET ${campos.join(", ")} WHERE id = :id`, params);
  return { id: String(usuarioId) };
}

/**
 * Reseta a senha de um usuário e devolve a provisória UMA vez.
 *
 * A senha volta na resposta porque o supervisor precisa entregá-la à pessoa —
 * e só aqui: ela não é gravada em claro em lugar nenhum, nem no log de
 * auditoria, que registra apenas que o reset aconteceu.
 */
export async function resetarSenha(usuarioId) {
  const usuario = await one("SELECT id, name, email FROM users WHERE id = :id LIMIT 1", {
    id: usuarioId,
  });
  if (!usuario) throw notFound("Usuário não encontrado.");

  const senha = senhaProvisoria();
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

  return { id: String(usuario.id), nome: usuario.name, email: usuario.email, senhaProvisoria: senha };
}
