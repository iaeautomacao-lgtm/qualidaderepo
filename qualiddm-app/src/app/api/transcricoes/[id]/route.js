import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { parseJsonObject, readString } from "@/server/validation";
import { excluirGravacao, obterTranscricao } from "@/server/repositories/transcricoes";
import { registrarAuditoria } from "@/server/repositories/administracao";

/** Id de gravação é numérico e vem da URL — validado antes de tocar no banco. */
function idDeGravacao(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") {
    throw badRequest("Identificador de gravação inválido.");
  }
  return id;
}

// Texto completo e segmentos de uma gravação. É o que alimenta o "Exportar
// JSON" da tela: o texto integral não vem na listagem para não inflar o
// payload de 200 linhas.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok({ gravacao: await obterTranscricao(idDeGravacao(id)) });
  });
}

/**
 * Exclui a gravação e a análise IA dela (botão do cartão em Avaliações).
 *
 * Aqui mora a exclusão da análise LIVRE: ela não tem linha em `avaliacoes`, o
 * código MIA-… é derivado, e o registro real é a gravação. Monitoria com
 * formulário sai por DELETE /api/avaliacoes/[codigo].
 *
 * Mesmo papel exigido na exclusão de ficha: administrador e supervisor.
 */
export async function DELETE(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const gravacaoId = idDeGravacao(id);

    const bruto = await request.json().catch(() => null);
    const motivo = bruto
      ? readString(parseJsonObject(bruto), "motivo", { required: false, max: 400 })
      : null;

    const resultado = await excluirGravacao({
      gravacaoId,
      userId: session.user.id,
      motivo,
    });

    if (!resultado.jaEstava) {
      await registrarAuditoria({
        userId: session.user.id,
        acao: "gravacao_excluida",
        modulo: "transcricoes",
        entidade: "gravacoes",
        entidadeId: gravacaoId,
        severidade: "aviso",
        detalhe: `${resultado.arquivo}${motivo ? ` — motivo: ${motivo}` : ""}`,
        ip: ipDaRequisicao(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return ok(resultado);
  });
}
