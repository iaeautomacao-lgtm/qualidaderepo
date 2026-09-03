import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import {
  readBoolParam,
  readDateParam,
  readIdParam,
  readPaginacao,
  readSearchParam,
} from "@/server/validation";
import { indicadoresContestacoes, listarCandidatas } from "@/server/repositories/contestacoes";

// Tela "Avaliações Candidatas": a lista de monitorias contestáveis MAIS os cinco
// cards do topo. Os cards contam contestações e a tabela lista candidatas — são
// recortes diferentes, mas a tela mostra os dois juntos, então vêm na mesma
// resposta para não abrir com números e lista fora de sincronia.
export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    const filtros = {
      clienteId: readIdParam(searchParams, "clienteId"),
      campanhaId: readIdParam(searchParams, "campanhaId"),
      avaliadoId: readIdParam(searchParams, "avaliadoId"),
      avaliadorId: readIdParam(searchParams, "avaliadorId"),
      dataInicio: readDateParam(searchParams, "dataInicio"),
      dataFim: readDateParam(searchParams, "dataFim"),
      busca: readSearchParam(searchParams, "busca", 80),
      codigo: readSearchParam(searchParams, "codigo", 30),
      // Ligado por padrão: é o recorte que a tela anuncia. A tela oferece o
      // desligamento no estado vazio.
      somenteNaoConformes: readBoolParam(searchParams, "somenteNaoConformes", true),
    };

    const [lista, indicadores] = await Promise.all([
      listarCandidatas({ filtros, limit, offset }),
      // Os cards não conhecem `somenteNaoConformes` nem paginação: eles contam
      // contestações do mesmo recorte de cliente/campanha/pessoa/período.
      indicadoresContestacoes({
        clienteId: filtros.clienteId,
        campanhaId: filtros.campanhaId,
        avaliadoId: filtros.avaliadoId,
        avaliadorId: filtros.avaliadorId,
      }),
    ]);

    return ok({ ...lista, indicadores });
  });
}
