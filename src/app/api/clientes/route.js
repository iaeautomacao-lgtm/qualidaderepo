import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { createCliente, getClientesOverview } from "@/server/repositories/catalog";
import { parseJsonObject, readString } from "@/server/validation";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    return ok(await getClientesOverview());
  });
}

export async function POST(request) {
  return route(request, async () => {
    await requireSession();
    const body = parseJsonObject(await request.json().catch(() => null));
    return ok(
      await createCliente({
        nome: readString(body, "nome", { min: 2, max: 160 }),
        status: readString(body, "status", { required: false, default: "Ativo", allowed: ["Ativo", "Inativo"] }),
        contrato: readString(body, "contrato", { required: false, max: 40 }),
      }),
    );
  });
}
