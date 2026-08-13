import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import { getReview } from "@/server/repositories/reviews";

export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok({ review: await getReview(assertSafeId(id)) });
  });
}
