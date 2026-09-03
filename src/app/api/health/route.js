import { one } from "@/server/db";
import { ok, route } from "@/server/http";
import { config } from "@/server/config";

export async function GET(request) {
  return route(request, async () => {
    await one("SELECT 1 AS ok");
    return ok({
      status: "ready",
      database: "mysql",
      ai: {
        provider: config.ai.provider,
        model: config.ai.geminiModel,
        configured: Boolean(config.ai.geminiApiKey),
      },
      checkedAt: new Date().toISOString(),
    });
  });
}
