import { forbidden } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";
import { excluirAvaliacao, obterAvaliacao } from "@/server/repositories/avaliacoes";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { podeExcluirMonitoria } from "@/server/permissions";

export async function GET(request, { params }) {
  return route(request, async () => {
    const session = await requireSession();
    const { id } = await params;
    return ok({ avaliacao: await obterAvaliacao(assertSafeId(id), { user: session.user }) });
  });
}

/**
 * Exclui a monitoria (botão do cartão em Avaliações).
 *
 * Só administrador e supervisor: excluir monitoria some com a nota do avaliado
 * do período, e quem monitorou não pode desfazer o próprio apontamento.
 *
 * A exclusão é MARCADA, não apagada — o relatório "Fichas Excluídas" existe para
 * responder quem excluiu o quê. O motivo é opcional no corpo porque o cartão não
 * pede texto; quando vem, entra no relatório.
 */
export async function DELETE(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    if (!podeExcluirMonitoria(session.user)) {
      throw forbidden("A exclusao de monitorias esta restrita ao usuario autorizado.");
    }
    const { id } = await params;
    const codigo = assertSafeId(id, "codigo");

    // Corpo opcional: DELETE sem corpo é o caso normal do cartão.
    const bruto = await request.json().catch(() => null);
    const motivo = bruto
      ? readString(parseJsonObject(bruto), "motivo", { required: false, max: 400 })
      : null;

    const resultado = await excluirAvaliacao({
      codigo,
      userId: session.user.id,
      motivo,
    });

    if (!resultado.jaEstava) {
      await registrarAuditoria({
        userId: session.user.id,
        acao: "avaliacao_excluida",
        modulo: "avaliacoes",
        entidade: "avaliacoes",
        entidadeId: codigo,
        severidade: "aviso",
        detalhe: motivo ? `motivo: ${motivo}` : "sem motivo informado",
        ip: ipDaRequisicao(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return ok(resultado);
  });
}
