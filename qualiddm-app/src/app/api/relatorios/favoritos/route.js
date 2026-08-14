import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";
import { alternarFavorito } from "@/server/repositories/relatorios";

// A estrela da lista de relatórios. Alterna o favorito do usuário da sessão —
// nunca de outro usuário: o id vem do cookie, não do corpo da requisição.
export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();
    const corpo = parseJsonObject(await request.json().catch(() => null));
    const slug = readString(corpo, "slug", { max: 80 });

    return ok(await alternarFavorito({ userId: session.user.id, slug }));
  });
}
