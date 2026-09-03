import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { excluirMeta } from "@/server/repositories/gestao";

export async function DELETE(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de meta inválido.");
    return ok(await excluirMeta(id));
  });
}
