import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { registrarAuditoria, revogarSessao } from "@/server/repositories/administracao";

function idNumerico(valor) {
  const texto = String(valor || "");
  if (!/^\d{1,20}$/.test(texto) || texto === "0") {
    throw badRequest("Identificador de sessão inválido.");
  }
  return texto;
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    const session = await requireRole("administrador");
    const { id } = await params;
    const sessaoId = idNumerico(id);
    const resultado = await revogarSessao({ id: sessaoId, revogadaPorId: session.user.id });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "sessao_revogada",
      modulo: "administracao",
      entidade: "user_sessions",
      entidadeId: sessaoId,
      severidade: "aviso",
      detalhe: resultado.revogada ? "sessão encerrada por administrador" : "sessão já estava encerrada",
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}
