import { ok, route } from "@/server/http";
import { deactivateCliente, updateCliente } from "@/server/repositories/catalog";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId, parseJsonObject, readString } from "@/server/validation";

export async function PATCH(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    const body = parseJsonObject(await request.json().catch(() => null));

    return ok(
      await updateCliente(assertSafeId(id), {
        nome: readString(body, "nome", { min: 2, max: 160 }),
        status: readString(body, "status", { required: false, default: "Ativo", allowed: ["Ativo", "Inativo"] }),
        contrato: readString(body, "contrato", { required: false, max: 40 }),
      }),
    );
  });
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok(await deactivateCliente(assertSafeId(id)));
  });
}
