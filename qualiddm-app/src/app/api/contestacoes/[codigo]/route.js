import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import { obterContestacoesDaAvaliacao } from "@/server/repositories/contestacoes";

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
