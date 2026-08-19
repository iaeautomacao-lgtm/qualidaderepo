import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import { itensContestaveis } from "@/server/repositories/contestacoes";

// Itens que PODEM ser contestados nesta monitoria: as respostas não conformes,
// com peso, pontuação e observação do monitor. É o que a tela de contestação por
// item precisa para montar os acordeões.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { codigo } = await params;
    return ok(await itensContestaveis(assertSafeId(codigo, "codigo")));
  });
}
