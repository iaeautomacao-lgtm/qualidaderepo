import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { obterTranscricao } from "@/server/repositories/transcricoes";

// Texto completo e segmentos de uma gravação. É o que alimenta o "Exportar
// JSON" da tela: o texto integral não vem na listagem para não inflar o
// payload de 200 linhas.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    if (!/^\d{1,20}$/.test(id) || id === "0") {
      throw badRequest("Identificador de gravação inválido.");
    }
    return ok({ gravacao: await obterTranscricao(id) });
  });
}
