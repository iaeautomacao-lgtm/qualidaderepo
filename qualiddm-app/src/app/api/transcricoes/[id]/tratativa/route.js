import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { registrarTratativaGravacao } from "@/server/repositories/transcricoes";

// Marca (ou desmarca) uma análise IA como tratada. Perfil restrito: fechar a
// tratativa é ato de gestão, e o registro guarda QUEM fechou.
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const { id } = await params;
    if (!/^\d{1,20}$/.test(id) || id === "0") {
      throw badRequest("Identificador de gravação inválido.");
    }

    const corpo = await request.json().catch(() => ({}));
    // Padrão é marcar como tratada: o caminho de desfazer precisa ser explícito.
    const tratada = corpo?.tratada === false ? false : true;

    const gravacao = await registrarTratativaGravacao({
      gravacaoId: id,
      userId: session.user.id,
      tratada,
      nota: typeof corpo?.nota === "string" ? corpo.nota : null,
    });

    return ok({ gravacao });
  });
}
