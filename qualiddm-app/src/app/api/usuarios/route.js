import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import {
  parseJsonObject,
  readEnumParam,
  readIdParam,
  readSearchParam,
  readString,
} from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { PAPEIS, criarUsuario, listarUsuarios } from "@/server/repositories/usuarios";

const SITUACOES = ["todos", "ativo", "inativo"];
const semSentinela = (valor) => (valor === "todos" ? null : valor);

/**
 * Lista os usuários.
 *
 * Administrador e supervisor: a lista traz e-mail, cargo e último acesso de todo
 * mundo, que não é informação de operador nem de viewer.
 */
export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);

    const searchParams = new URL(request.url).searchParams;

    return ok(
      await listarUsuarios({
        filtros: {
          busca: readSearchParam(searchParams, "busca", 120),
          papel: semSentinela(readEnumParam(searchParams, "papel", [...PAPEIS, "todos"], "todos")),
          cargoId: readIdParam(searchParams, "cargoId"),
          clienteId: readIdParam(searchParams, "clienteId"),
          situacao: semSentinela(readEnumParam(searchParams, "situacao", SITUACOES, "todos")),
        },
      }),
    );
  });
}

/**
 * Cria usuário com senha provisória.
 *
 * Só administrador: criar usuário é conceder acesso ao sistema.
 *
 * A senha provisória volta na resposta UMA vez, para o administrador entregá-la à
 * pessoa. Ela não é gravada em claro em lugar nenhum e não entra no log.
 */
export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const nome = readString(corpo, "nome", { min: 2, max: 140 });
    const email = readString(corpo, "email", { min: 5, max: 180 }).toLowerCase();
    const papel = readString(corpo, "papel", { allowed: PAPEIS });

    const resultado = await criarUsuario({
      nome,
      email,
      papel,
      cargoId: corpo.cargoId ? String(corpo.cargoId) : null,
      clienteId: corpo.clienteId ? String(corpo.clienteId) : null,
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "usuario_criado",
      modulo: "usuarios",
      entidade: "users",
      entidadeId: email,
      severidade: "aviso",
      detalhe: `${nome} como ${papel}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ ...resultado, ...(await listarUsuarios()) });
  });
}
