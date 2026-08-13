import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { readEnumParam } from "@/server/validation";
import { getDashboardOverview } from "@/server/repositories/dashboard";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const period = readEnumParam(new URL(request.url).searchParams, "period", ["weekly", "monthly"], "monthly");
    return ok(await getDashboardOverview({ period }));
  });
}
