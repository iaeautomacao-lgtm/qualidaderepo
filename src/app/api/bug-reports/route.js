import { ok, route } from "@/server/http";
import { BUG_SEVERIDADES, BUG_STATUS, BUG_TIPOS, listarBugReports } from "@/server/repositories/bug-reports";
import { requireRole } from "@/server/security/sessions";
import { readEnumParam, readSearchParam } from "@/server/validation";

const TODOS = "todos";

export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);

    const searchParams = new URL(request.url).searchParams;
    const severidade = readEnumParam(searchParams, "severidade", [TODOS, ...BUG_SEVERIDADES], TODOS);
    const tipo = readEnumParam(searchParams, "tipo", [TODOS, ...BUG_TIPOS], TODOS);
    const status = readEnumParam(searchParams, "status", [TODOS, ...BUG_STATUS], TODOS);
    const busca = readSearchParam(searchParams, "busca", 160);

    return ok(await listarBugReports({ severidade, tipo, status, busca }));
  });
}
