import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { registrarAusenciaMonitoria } from "@/server/repositories/catalog";
import { parseJsonObject, readString } from "@/server/validation";

function idObrigatorio(corpo, campo) {
  const valor = String(corpo?.[campo] || "").trim();
  if (!/^\d{1,20}$/.test(valor) || valor === "0") {
    throw badRequest(`Campo ${campo} invalido.`);
  }
  return valor;
}

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    const resultado = await registrarAusenciaMonitoria({
      clienteId: idObrigatorio(corpo, "clienteId"),
      campanhaId: idObrigatorio(corpo, "campanhaId"),
      avaliadoId: idObrigatorio(corpo, "avaliadoId"),
      motivoId: idObrigatorio(corpo, "motivoId"),
      texto: readString(corpo, "texto", { required: false, max: 5000 }),
      criadoPorId: session.user.id,
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "ausencia_monitoria_registrada",
      modulo: "formularios",
      entidade: "justificativas",
      entidadeId: resultado.id,
      detalhe: `avaliado=${corpo.avaliadoId}; campanha=${corpo.campanhaId}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ justificativa: resultado });
  });
}
