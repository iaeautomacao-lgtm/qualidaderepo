import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import {
  readDateParam,
  readEnumParam,
  readIdParam,
  readPaginacao,
  readSearchParam,
} from "@/server/validation";
import {
  FILTRO_STATUS,
  indicadoresContestacoes,
  listarContestacoes,
} from "@/server/repositories/contestacoes";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    const filtros = {
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
    };

    // Os cinco cards do topo da Gestão ADM contam contestações; a tabela lista
    // AVALIAÇÕES com contestação. Recortes diferentes do mesmo filtro, e é por
    // isso que as duas consultas rodam juntas em vez de uma derivar da outra.
    const [resultado, indicadores] = await Promise.all([
      listarContestacoes({ filtros, limit, offset }),
      indicadoresContestacoes(filtros),
    ]);

    return ok({ ...resultado, indicadores });
  });
}
