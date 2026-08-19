import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import {
  MIN_CARACTERES_COMENTARIO,
  listarComentariosDaAvaliacao,
  listarEdicoesDaAvaliacao,
} from "@/server/repositories/feedbacks";

// As duas abas da tela compacta de feedback que a ficha (/api/avaliacoes/[id])
// não devolve: "Edições" e "Histórico". Ficam juntas porque a tela abre as duas
// de uma vez — separar em dois endpoints só somaria um round-trip.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { codigo } = await params;
    const id = assertSafeId(codigo, "codigo");

    const [edicoes, comentarios] = await Promise.all([
      listarEdicoesDaAvaliacao(id),
      listarComentariosDaAvaliacao(id),
    ]);

    return ok({ edicoes, comentarios, minCaracteresComentario: MIN_CARACTERES_COMENTARIO });
  });
}
