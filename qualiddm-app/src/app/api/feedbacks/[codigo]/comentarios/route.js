import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import {
  MIN_CARACTERES_COMENTARIO,
  adicionarComentario,
} from "@/server/repositories/feedbacks";

// Comentário no histórico da monitoria. Quem conduz a monitoria escreve:
// operador e viewer ficam fora, como no feedback global.
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const { codigo } = await params;
    const id = assertSafeId(codigo, "codigo");

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const comentario = readString(corpo, "comentario", {
      min: MIN_CARACTERES_COMENTARIO,
      max: 2000,
    });

    const comentarios = await adicionarComentario({
      codigo: id,
      autorId: session.user.id,
      comentario,
    });

    // Auditoria depois da escrita e sem transação própria: falha de log não pode
    // desfazer o comentário que já está gravado.
    await registrarAuditoria({
      userId: session.user.id,
      acao: "feedback_comentario",
      modulo: "feedback",
      entidade: "avaliacoes",
      entidadeId: id,
      detalhe: `comentário de ${comentario.length} caracteres`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ comentarios });
  });
}
