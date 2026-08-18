import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";
import { obterAvaliacao } from "@/server/repositories/avaliacoes";
import { registrarAuditoria } from "@/server/repositories/administracao";
import {
  ACOES_FEEDBACK,
  MIN_CARACTERES_MENSAGEM,
  TIPOS_FEEDBACK,
  registrarFeedbackAvaliacao,
} from "@/server/repositories/feedbacks";

// Feedback global da ficha. `[id]` é o CÓDIGO da avaliação — ver o comentário em
// ../audio/route.js sobre o nome do segmento dinâmico.
//
// Só quem conduz a monitoria escreve feedback: operador e viewer não entram.
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const { id } = await params;
    const codigo = assertSafeId(id, "codigo");

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const tipo = readString(corpo, "tipo", { allowed: TIPOS_FEEDBACK });
    const acao = readString(corpo, "acao", { allowed: ACOES_FEEDBACK });
    // O mínimo de 20 caracteres é o contador do print. Vale no servidor porque
    // validação de formulário no navegador é conveniência, não regra.
    const mensagem = readString(corpo, "mensagem", { min: MIN_CARACTERES_MENSAGEM, max: 5000 });

    const resultado = await registrarFeedbackAvaliacao({
      codigo,
      tipo,
      mensagem,
      acao,
      autorId: session.user.id,
    });

    // Auditoria depois do commit e sem transação própria: falha de log não pode
    // desfazer o feedback que já foi gravado.
    await registrarAuditoria({
      userId: session.user.id,
      acao: acao === "aplicar" ? "feedback_aplicado" : "feedback_justificado",
      modulo: "feedback",
      entidade: "avaliacoes",
      entidadeId: codigo,
      detalhe: `tipo=${tipo}; status ${resultado.statusAnterior} -> ${resultado.status}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    // Ficha recarregada no mesmo shape do GET: a tela atualiza sem um segundo
    // request, e o histórico já vem com a linha de auditoria recém-gravada.
    return ok({ avaliacao: await obterAvaliacao(codigo) });
  });
}
