import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import {
  readDateParam,
  readEnumParam,
  readIdParam,
  readPaginacao,
  readSearchParam,
} from "@/server/validation";
import { FILTRO_STATUS, listarConfiguracoesStatus, listarFeedbacks } from "@/server/repositories/feedbacks";

const ORDENACOES = ["data_avaliacao", "data_contato", "codigo", "cliente", "avaliador", "status"];

export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    // O print da tela avisa "a tabela exibe as 200 monitorias mais recentes";
    // 200 é o teto aqui, e os cards continuam refletindo o total do recorte.
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    const filtros = {
      status: readEnumParam(searchParams, "status", FILTRO_STATUS, "todos"),
      clienteId: readIdParam(searchParams, "clienteId"),
      campanhaId: readIdParam(searchParams, "campanhaId"),
      avaliadorId: readIdParam(searchParams, "avaliadorId"),
      avaliadoId: readIdParam(searchParams, "avaliadoId"),
      supervisorId: readIdParam(searchParams, "supervisorId"),
      dataInicio: readDateParam(searchParams, "dataInicio"),
      dataFim: readDateParam(searchParams, "dataFim"),
      busca: readSearchParam(searchParams, "busca", 60),
    };

    const [resultado, configuracoes] = await Promise.all([
      listarFeedbacks({
        filtros,
        limit,
        offset,
        ordenarPor: readEnumParam(searchParams, "ordenarPor", ORDENACOES, "data_avaliacao"),
        ordem: readEnumParam(searchParams, "ordem", ["asc", "desc"], "desc"),
      }),
      listarConfiguracoesStatus(),
    ]);

    return ok({ ...resultado, configuracoesStatus: configuracoes });
  });
}
