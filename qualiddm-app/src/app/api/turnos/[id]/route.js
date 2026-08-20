import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { atualizarTurno, excluirTurno } from "@/server/repositories/turnos";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de turno invalido.");
  return id;
}

export async function PATCH(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { id } = await params;
    const turnoId = idValido(id);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    const alteracoes = {};
    if (corpo.codigo !== undefined) alteracoes.codigo = readString(corpo, "codigo", { min: 1, max: 40 });
    if (corpo.descricao !== undefined) alteracoes.descricao = readString(corpo, "descricao", { min: 1, max: 120 });
    if (corpo.horaInicio !== undefined) alteracoes.horaInicio = readString(corpo, "horaInicio", { min: 5, max: 5 });
    if (corpo.horaFim !== undefined) alteracoes.horaFim = readString(corpo, "horaFim", { min: 5, max: 5 });
    if (corpo.ativo !== undefined) alteracoes.ativo = Boolean(corpo.ativo);

    const resultado = await atualizarTurno(turnoId, alteracoes);
    await registrarAuditoria({
      userId: session.user.id,
      acao: "turno_atualizado",
      modulo: "turnos",
      entidade: "turnos",
      entidadeId: turnoId,
      severidade: "info",
      detalhe: Object.keys(alteracoes).join(", "),
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { id } = await params;
    const turnoId = idValido(id);
    const resultado = await excluirTurno(turnoId);

    await registrarAuditoria({
      userId: session.user.id,
      acao: resultado.desativado ? "turno_desativado" : "turno_removido",
      modulo: "turnos",
      entidade: "turnos",
      entidadeId: turnoId,
      severidade: "aviso",
      detalhe: resultado.desativado ? "turno com usuarios vinculados" : "sem vinculos",
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}
