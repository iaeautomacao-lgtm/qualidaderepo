import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import {
  readDateParam,
  readEnumParam,
  readIdParam,
  readPaginacao,
  readSearchParam,
} from "@/server/validation";
import { FILTRO_STATUS, listarContestacoes } from "@/server/repositories/contestacoes";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    const resultado = await listarContestacoes({
      filtros: {
        status: readEnumParam(searchParams, "status", FILTRO_STATUS, "todos"),
        clienteId: readIdParam(searchParams, "clienteId"),
        campanhaId: readIdParam(searchParams, "campanhaId"),
        avaliadoId: readIdParam(searchParams, "avaliadoId"),
        avaliadorId: readIdParam(searchParams, "avaliadorId"),
        dataInicio: readDateParam(searchParams, "dataInicio"),
        dataFim: readDateParam(searchParams, "dataFim"),
        // As duas caixas de busca do print: uma por texto, outra por ID.
        busca: readSearchParam(searchParams, "busca", 80),
        codigo: readSearchParam(searchParams, "codigo", 30),
      },
      limit,
      offset,
    });

    return ok(resultado);
  });
}
