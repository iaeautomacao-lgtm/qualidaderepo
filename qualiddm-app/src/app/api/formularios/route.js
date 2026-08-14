import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { createFormulario, getFormulariosOverview } from "@/server/repositories/catalog";
import { badRequest } from "@/server/errors";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    return ok(await getFormulariosOverview());
  });
}

export async function POST(request) {
  return route(request, async () => {
    await requireSession();
    const body = await request.json().catch(() => null);
    const nome = String(body?.nome || "").trim();
    const clienteId = String(body?.clienteId || "").trim();
    const categoria = body?.categoria === "diagnostico" ? "diagnostico" : "padrao";
    const status = ["ativo", "rascunho", "desenvolvimento", "inativo"].includes(body?.status)
      ? body.status
      : "rascunho";

    if (!nome) throw badRequest("Informe o nome do formulário.");
    if (!clienteId) throw badRequest("Selecione um cliente válido.");

    return ok(await createFormulario({ clienteId, nome, categoria, status }));
  });
}
