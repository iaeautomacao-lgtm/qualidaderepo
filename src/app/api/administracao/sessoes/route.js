import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { readBoolParam, readPaginacao } from "@/server/validation";
import { listarSessoes } from "@/server/repositories/administracao";

// Card "Sessões e Presença". Restrito a administrador: a lista mostra IP e
// dispositivo de outras pessoas.
export async function GET(request) {
  return route(request, async () => {
    await requireRole("administrador");

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    return ok(
      await listarSessoes({
        limit,
        offset,
        apenasAtivas: readBoolParam(searchParams, "apenasAtivas", true),
      }),
    );
  });
}
