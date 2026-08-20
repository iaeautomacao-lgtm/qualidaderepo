import { badRequest } from "@/server/errors";
import { ok, route } from "@/server/http";
import { BUG_STATUS, atualizarBugReport } from "@/server/repositories/bug-reports";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";

function validarId(id) {
  if (!/^\d{1,20}$/.test(String(id))) throw badRequest("Identificador inválido.");
  return String(id);
}

export async function PATCH(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const corpo = parseJsonObject(await request.json().catch(() => null));
    const alteracoes = {};

    if (Object.hasOwn(corpo, "status")) {
      alteracoes.status = readString(corpo, "status", { allowed: BUG_STATUS });
    }
    if (Object.hasOwn(corpo, "resposta")) {
      alteracoes.resposta = readString(corpo, "resposta", { required: false, max: 2000 });
    }
    if (!alteracoes.status && alteracoes.resposta === undefined) {
      throw badRequest("Informe uma alteração para salvar.");
    }

    return ok(await atualizarBugReport(validarId(id), alteracoes, session?.user?.id));
  });
}
