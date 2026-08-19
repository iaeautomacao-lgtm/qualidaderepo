import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { resetarSenha } from "@/server/repositories/usuarios";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de usuário inválido.");
  return id;
}

/**
 * Reseta a senha e devolve a provisória uma vez.
 *
 * Só administrador. A senha volta no corpo porque quem reseta precisa entregá-la
 * à pessoa — e só ali: nada dela entra no log de auditoria, que registra apenas
 * que o reset aconteceu, quando e por quem. Log com senha em claro transforma a
 * trilha de auditoria em lista de credenciais.
 */
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { id } = await params;
    const usuarioId = idValido(id);

    const resultado = await resetarSenha(usuarioId);

    await registrarAuditoria({
      userId: session.user.id,
      acao: "senha_resetada",
      modulo: "usuarios",
      entidade: "users",
      entidadeId: usuarioId,
      severidade: "aviso",
      detalhe: `senha provisória gerada para ${resultado.email}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}
