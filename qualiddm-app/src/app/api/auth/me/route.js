import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";

/**
 * Quem está logado.
 *
 * `senhaPendenteOk` porque a casca do app usa esta rota para descobrir que a
 * senha ainda é a padrão — se ela também fosse bloqueada, o front não teria como
 * saber que precisa levar a pessoa para a troca.
 */
export async function GET(request) {
  return route(request, async () => {
    const session = await requireSession({ senhaPendenteOk: true });
    return ok({
      user: session.user,
      devBypass: Boolean(session.devBypass),
      trocarSenha: Boolean(session.user.trocarSenha),
    });
  });
}
