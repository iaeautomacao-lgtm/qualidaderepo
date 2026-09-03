import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { listarOpcoesInicioAvaliacaoManual } from "@/server/repositories/catalog";

export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor", "monitor"]);
    return ok(await listarOpcoesInicioAvaliacaoManual());
  });
}
