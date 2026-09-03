import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { excluirCliente, obterOperacao } from "@/server/repositories/gestao";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de operação inválido.");
  return id;
}

export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok(await obterOperacao(idValido(id)));
  });
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    return ok({ resultado: await excluirCliente(idValido(id)) });
  });
}
