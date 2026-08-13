import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";
import { agregadosParaIa } from "@/server/repositories/analytics";
import { gerarRelatorioIa, tiposDisponiveis } from "@/server/services/relatorios-ia";

/**
 * POST /api/relatorios/ia
 *
 * Gera um relatório analítico com IA sobre o recorte pedido.
 *
 * Restrito a quem gere qualidade: a análise cruza desempenho individual de
 * operadores, então operador não vê o relatório do time. Monitor vê, porque é
 * quem aplica o coaching.
 */
export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor", "monitor"]);

    const body = parseJsonObject(await request.json());
    const tipo = readString(body, "tipo", { max: 40 });

    const filtros = {
      clienteId: body.clienteId ?? null,
      campanhaId: body.campanhaId ?? null,
      avaliadoId: body.avaliadoId ?? null,
      avaliadorId: body.avaliadorId ?? null,
      categoria: body.categoria ?? null,
      dataInicio: body.dataInicio ?? null,
      dataFim: body.dataFim ?? null,
    };

    const contexto = await agregadosParaIa(filtros);
    const relatorio = await gerarRelatorioIa({ tipo, filtros, contexto });

    return ok(relatorio);
  });
}

export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor", "monitor"]);
    return ok({ tipos: tiposDisponiveis });
  });
}
