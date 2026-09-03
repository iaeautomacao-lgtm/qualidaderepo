import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import {
  MIN_CARACTERES_JUSTIFICATIVA,
  MOTIVOS_CONTESTACAO,
  abrirContestacao,
  obterContestacoesDaAvaliacao,
} from "@/server/repositories/contestacoes";

// Teto de itens por pedido. Não é limite de negócio: é o freio contra um corpo
// de requisição com milhares de entradas, cada uma virando um INSERT.
const MAX_ITENS = 40;

// Detalhe por CÓDIGO da monitoria (QA-26-000073), que é o identificador que a
// tela mostra e copia. `assertSafeId` já recusa qualquer coisa fora de
// [A-Za-z0-9_-].
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { codigo } = await params;
    return ok(await obterContestacoesDaAvaliacao(assertSafeId(codigo, "codigo")));
  });
}

/**
 * Abre a contestação da monitoria.
 *
 * Quem contesta aqui é a supervisão — o print traz o botão dentro da ficha de
 * feedback, que só supervisor, monitor e administrador abrem. O operador não
 * entra: no fluxo da DDM ele pede ao supervisor, que formaliza.
 */
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const { codigo } = await params;
    const id = assertSafeId(codigo, "codigo");

    const corpo = parseJsonObject(await request.json().catch(() => null));

    if (!Array.isArray(corpo.itens) || corpo.itens.length === 0) {
      throw badRequest("Marque ao menos um item para contestar.");
    }
    if (corpo.itens.length > MAX_ITENS) {
      throw badRequest(`Envie no máximo ${MAX_ITENS} itens por contestação.`);
    }

    // Cada item validado individualmente, com o índice na mensagem: numa lista
    // de 5 itens, "justificativa curta" sem dizer qual não ajuda ninguém.
    const itens = corpo.itens.map((item, indice) => {
      const bruto = parseJsonObject(item);
      const posicao = indice + 1;

      return {
        respostaId: assertSafeId(String(bruto.respostaId ?? ""), `item ${posicao}: respostaId`),
        motivo: readString({ motivo: bruto.motivo }, "motivo", {
          allowed: MOTIVOS_CONTESTACAO,
        }),
        justificativa: readString({ justificativa: bruto.justificativa }, "justificativa", {
          min: MIN_CARACTERES_JUSTIFICATIVA,
          max: 2000,
        }),
      };
    });

    const resultado = await abrirContestacao({
      codigo: id,
      itens,
      abertoPorId: session.user.id,
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "contestacao_aberta",
      modulo: "contestacoes",
      entidade: "avaliacoes",
      entidadeId: id,
      detalhe: `${resultado.itens} item(ns); prazo de julgamento em ${resultado.prazoDias} dia(s)`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    // Contestações da ficha no mesmo shape do GET: a tela mostra o pedido
    // recém-aberto sem um segundo request.
    return ok({ ...resultado, ...(await obterContestacoesDaAvaliacao(id)) });
  });
}
