import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { listarOpcoesFiltro } from "@/server/repositories/relatorios";

// Opções dos dropdowns do painel de filtros (Cliente/Operação, Campanha,
// Avaliado, Categoria, Avaliador/Monitor).
export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    return ok(await listarOpcoesFiltro());
  });
}
