import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { saveMockAnalysis, getReview } from "@/server/repositories/reviews";
import { parseJsonObject, readString } from "@/server/validation";

export async function POST(request) {
  return route(request, async () => {
    await requireSession();
    let reviewId = "ql-1048";

    try {
      const body = parseJsonObject(await request.json());
      reviewId = readString(body, "reviewId", { max: 64 });
    } catch {
      // Compatibilidade com o frontend atual, que ainda chama /api/analyze sem body.
    }

    await saveMockAnalysis(reviewId);
    const review = await getReview(reviewId);

    return ok({
      reviewId,
      engine: "mock-ai-adapter",
      confidence: Number(review.ai_confidence),
      score: Number(review.score),
      transcript: review.transcript,
      checklist: review.checklist,
      feedback: {
        title: "Feedback recomendado",
        summary: review.feedback_summary,
        insights: review.insights,
      },
    });
  });
}
