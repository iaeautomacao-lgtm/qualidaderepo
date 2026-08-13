import { ok, route } from "@/server/http";
import { parseJsonObject, readString } from "@/server/validation";
import { login } from "@/server/services/auth-service";
import { setSessionCookie } from "@/server/security/sessions";

export async function POST(request) {
  return route(request, async () => {
    const body = parseJsonObject(await request.json());
    const email = readString(body, "email", { max: 180 }).toLowerCase();
    const password = readString(body, "password", { min: 8, max: 256 });
    const result = await login({ email, password });
    const response = ok({ user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  });
}
