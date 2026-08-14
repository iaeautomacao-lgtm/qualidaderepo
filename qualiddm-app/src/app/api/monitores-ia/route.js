import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { listarMonitoresIa } from "@/server/repositories/monitores-ia";
import { readPaginacao, readSearchParam } from "@/server/validation";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 48, max: 200 });

    return ok(
      await listarMonitoresIa({
        busca: readSearchParam(searchParams, "busca", 120),
        limit,
        offset,
      })
    );
  });
}
