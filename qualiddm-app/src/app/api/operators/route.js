import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { listOperators } from "@/server/repositories/catalog";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    return ok({ operators: await listOperators() });
  });
}
