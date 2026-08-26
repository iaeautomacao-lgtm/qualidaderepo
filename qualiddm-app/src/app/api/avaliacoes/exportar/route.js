import { route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { parseJsonObject } from "@/server/validation";
import { exportarAvaliacoesDetalhadas } from "@/server/repositories/avaliacoes";
import { criarXlsx } from "@/server/xlsx";

export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();
    const body = parseJsonObject(await request.json().catch(() => ({})));
    const filtros = body.filtros && typeof body.filtros === "object" ? body.filtros : {};
    const { colunas, linhas } = await exportarAvaliacoesDetalhadas({ filtros, user: session.user });
    const arquivo = criarXlsx({ colunas, linhas });
    const data = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return new Response(arquivo, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="base_monitoria_${data}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  });
}
