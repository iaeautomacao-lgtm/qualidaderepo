import { empty, route } from "@/server/http";
import { clearSessionCookie, destroySession, currentSession } from "@/server/security/sessions";

export async function POST(request) {
  return route(request, async () => {
    const session = await currentSession();
    if (session?.token) await destroySession(session.token);
    const response = empty();
    clearSessionCookie(response);
    return response;
  });
}
