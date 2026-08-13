import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";

export async function GET(request) {
  return route(request, async () => {
    const session = await requireSession();
    return ok({ user: session.user, devBypass: Boolean(session.devBypass) });
  });
}
