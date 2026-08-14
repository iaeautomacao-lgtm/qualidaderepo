import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import { obterAvaliacao } from "@/server/repositories/avaliacoes";

export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok({ avaliacao: await obterAvaliacao(assertSafeId(id)) });
  });
}
