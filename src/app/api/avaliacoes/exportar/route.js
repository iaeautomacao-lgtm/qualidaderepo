import { route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { parseJsonObject } from "@/server/validation";
import {
  exportarAvaliacoesDetalhadas,
  exportarAvaliacoesResumo,
} from "@/server/repositories/avaliacoes";
import { criarXlsx } from "@/server/xlsx";

export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();
    const body = parseJsonObject(await request.json().catch(() => ({})));
    const filtros = body.filtros && typeof body.filtros === "object" ? body.filtros : {};
    /* Dois formatos, um botao.

       "avaliacao" (padrao) e uma linha por monitoria, no cabecalho que a
       operacao ja conhece da exportacao do QualiTalk. "criterio" e a base
       analitica de 45 colunas, uma linha por criterio respondido -- util
       para cruzar desempenho por item, inutil para conferir a lista.

       O padrao mudou para "avaliacao" porque o outro sai de
       `avaliacao_respostas` e devolve arquivo vazio quando a monitoria nao
       tem resposta por criterio, que e o caso de tudo que veio importado. */
    const formato = body.formato === "criterio" ? "criterio" : "avaliacao";
    const exportar =
      formato === "criterio" ? exportarAvaliacoesDetalhadas : exportarAvaliacoesResumo;
    const { colunas, linhas, resumo } = await exportar({ filtros, user: session.user });
    const aba = formato === "criterio" ? "Base de Monitoria" : "Avaliações";
    /* A aba de resumo so entra quando ha o que resumir. Aba vazia num arquivo
       operacional vira duvida ("perdi um filtro?"), e a ausencia dela ja diz
       que nao houve monitoria no recorte. */
    const abas = resumo?.linhas?.length
      ? [
          { nome: aba, colunas, linhas },
          { nome: "Resumo por operador", colunas: resumo.colunas, linhas: resumo.linhas },
        ]
      : null;
    const arquivo = criarXlsx({ colunas, linhas, aba, abas });
    const data = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const nome = formato === "criterio" ? "base_monitoria" : "avaliacoes";

    return new Response(arquivo, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${nome}_${data}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  });
}
