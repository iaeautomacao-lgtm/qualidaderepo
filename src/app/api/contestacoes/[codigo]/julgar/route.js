import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import {
  RESULTADOS_ITEM,
  julgarContestacao,
  obterContestacoesDaAvaliacao,
} from "@/server/repositories/contestacoes";

const MAX_ITENS = 40;
// Parecer é o que o operador lê quando o pedido volta indeferido. Vale a mesma
// régua da justificativa de quem abriu: quem decide também precisa argumentar.
const MIN_CARACTERES_PARECER = 20;

/**
 * Julga os itens de uma contestação (tela Gestão ADM).
 *
 * Só administrador. Deferir devolve o peso na ficha e move a nota — não é
 * decisão de quem monitorou, nem de quem abriu o pedido.
 */
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { codigo } = await params;
    const id = assertSafeId(codigo, "codigo");

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const contestacaoId = assertSafeId(String(corpo.contestacaoId ?? ""), "contestacaoId");

    if (!Array.isArray(corpo.decisoes) || corpo.decisoes.length === 0) {
      throw badRequest("Informe o resultado de ao menos um item.");
    }
    if (corpo.decisoes.length > MAX_ITENS) {
      throw badRequest(`Envie no máximo ${MAX_ITENS} decisões por requisição.`);
    }

    const decisoes = corpo.decisoes.map((decisao, indice) => {
      const bruto = parseJsonObject(decisao);
      const posicao = indice + 1;

      return {
        itemId: assertSafeId(String(bruto.itemId ?? ""), `item ${posicao}: itemId`),
        resultado: readString({ resultado: bruto.resultado }, "resultado", {
          allowed: RESULTADOS_ITEM,
        }),
        parecer: readString({ parecer: bruto.parecer }, "parecer", {
          min: MIN_CARACTERES_PARECER,
          max: 2000,
        }),
      };
    });

    const resultado = await julgarContestacao({
      contestacaoId,
      codigo: id,
      decisoes,
      julgadaPorId: session.user.id,
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: resultado.status === "julgada" ? "contestacao_julgada" : "contestacao_em_analise",
      modulo: "contestacoes",
      entidade: "avaliacoes",
      entidadeId: id,
      // A nota da ficha muda quando há item deferido. Registrar o número no log
      // é o que permite reconstruir depois por que a monitoria mudou de nota.
      detalhe:
        `contestação ${contestacaoId}: ${decisoes.length} item(ns) julgado(s), ` +
        `${resultado.itensDeferidos ?? 0} deferido(s)` +
        (resultado.scoreFinal == null ? "" : `; nota final ${resultado.scoreFinal}`),
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ ...resultado, ...(await obterContestacoesDaAvaliacao(id)) });
  });
}
