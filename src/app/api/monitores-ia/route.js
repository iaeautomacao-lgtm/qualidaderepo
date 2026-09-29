import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { listarMonitoresIa, salvarConfiguracaoMonitorIa } from "@/server/repositories/monitores-ia";
import { parseJsonObject, readPaginacao, readSearchParam, readString } from "@/server/validation";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 48, max: 200 });
    return ok(await listarMonitoresIa({ busca: readSearchParam(searchParams, "busca", 120), limit, offset }));
  });
}

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));
    return ok(
      await salvarConfiguracaoMonitorIa({
        clienteId: readString(corpo, "clienteId", { min: 1, max: 20 }),
        formularioId: readString(corpo, "formularioId", { min: 1, max: 20 }),
        nome: readString(corpo, "nome", { min: 2, max: 160 }),
        prompt: readString(corpo, "prompt", { min: 20, max: 8000 }),
        ativo: corpo.ativo !== false,
        userId: session.user.id,
        role: session.user.role,
      }),
    );
  });
}