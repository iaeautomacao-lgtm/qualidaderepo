import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { listarUsuarios, salvarCampanhasUsuario } from "@/server/repositories/usuarios";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject } from "@/server/validation";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de usuario invalido.");
  return id;
}

export async function PATCH(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const usuarioId = idValido(id);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    if (!Array.isArray(corpo.campanhaIds)) {
      throw badRequest("Campo campanhaIds deve ser uma lista.");
    }

    const resultado = await salvarCampanhasUsuario(usuarioId, corpo.campanhaIds);

    await registrarAuditoria({
      userId: session.user.id,
      acao: "usuario_campanhas_atualizadas",
      modulo: "usuarios",
      entidade: "users",
      entidadeId: usuarioId,
      severidade: "info",
      detalhe: `${resultado.campanhaIds.length} campanha(s)`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(await listarUsuarios());
  });
}
