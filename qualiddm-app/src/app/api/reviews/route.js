import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { readEnumParam, readIntParam } from "@/server/validation";
import { listReviews } from "@/server/repositories/reviews";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const searchParams = new URL(request.url).searchParams;
    const limit = readIntParam(searchParams, "limit", { default: 25, min: 1, max: 100 });
    const offset = readIntParam(searchParams, "offset", { default: 0, min: 0, max: 100000 });
    const status = searchParams.get("status")
      ? readEnumParam(searchParams, "status", ["processing", "approved", "needs_review", "rejected"], null)
      : null;
    return ok({ reviews: await listReviews({ limit, offset, status }) });
  });
}
