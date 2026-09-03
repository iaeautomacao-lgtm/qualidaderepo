import { ipDaRequisicao, ok, route } from "@/server/http";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { criarTurno, listarTurnos } from "@/server/repositories/turnos";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readSearchParam, readString } from "@/server/validation";

export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const searchParams = new URL(request.url).searchParams;
    return ok(await listarTurnos({ busca: readSearchParam(searchParams, "busca", 80) }));
  });
}

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    const resultado = await criarTurno({
      codigo: readString(corpo, "codigo", { min: 1, max: 40 }),
      descricao: readString(corpo, "descricao", { min: 1, max: 120 }),
      horaInicio: readString(corpo, "horaInicio", { min: 5, max: 5 }),
      horaFim: readString(corpo, "horaFim", { min: 5, max: 5 }),
      ativo: corpo.ativo == null ? true : Boolean(corpo.ativo),
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "turno_criado",
      modulo: "turnos",
      entidade: "turnos",
      entidadeId: corpo.codigo,
      severidade: "info",
      detalhe: corpo.descricao,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}
