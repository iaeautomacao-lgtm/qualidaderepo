import { one } from "@/server/db";
import { ok, route } from "@/server/http";

export async function GET(request) {
  return route(request, async () => {
    await one("SELECT 1 AS ok");
    return ok({
      status: "ready",
      database: "mysql",
      checkedAt: new Date().toISOString(),
    });
  });
}
