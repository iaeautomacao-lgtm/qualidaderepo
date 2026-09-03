import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { readEnumParam, readIdParam } from "@/server/validation";
import { getDashboardOverview } from "@/server/repositories/dashboard";

// Filtros globais do painel. `readIdParam` devolve `null` quando o filtro está
// em "todos" e recusa qualquer coisa que não seja identificador numérico — o
// valor vai para uma comparação em SQL.
export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const params = new URL(request.url).searchParams;

    return ok(
      await getDashboardOverview({
        period: readEnumParam(params, "period", ["weekly", "monthly"], "monthly"),
        clienteId: readIdParam(params, "clienteId"),
        campanhaId: readIdParam(params, "campanhaId"),
        operadorId: readIdParam(params, "operadorId"),
      }),
    );
  });
}
