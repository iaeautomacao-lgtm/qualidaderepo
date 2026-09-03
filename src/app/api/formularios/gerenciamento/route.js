import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { readEnumParam, readIdParam, readSearchParam } from "@/server/validation";
import {
  CATEGORIAS_FORMULARIO,
  STATUS_FORMULARIO,
  listarFormularios,
} from "@/server/repositories/formularios";

const semSentinela = (valor) => (valor === "todos" ? null : valor);

// Catálogo completo e filtrável da tela "Gerenciamento de Formulários".
// Rota própria porque `/api/formularios` responde outra coisa: os KPIs e os 20
// mais recentes do painel.
export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;

    return ok(
      await listarFormularios({
        filtros: {
          clienteId: readIdParam(searchParams, "clienteId"),
          // Sentinela "todos" e não `null` como fallback: `readEnumParam` valida
          // o fallback contra a lista, e um `null` ali seria recusado como valor
          // inválido quando o filtro simplesmente não veio.
          categoria: semSentinela(
            readEnumParam(searchParams, "categoria", [...CATEGORIAS_FORMULARIO, "todos"], "todos"),
          ),
          status: semSentinela(
            readEnumParam(searchParams, "status", [...STATUS_FORMULARIO, "todos"], "todos"),
          ),
          busca: readSearchParam(searchParams, "busca", 120),
        },
      }),
    );
  });
}
