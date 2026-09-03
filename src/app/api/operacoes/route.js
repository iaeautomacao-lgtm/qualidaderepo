import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { parseJsonObject, readIntParam, readString } from "@/server/validation";
import { criarCliente, listarOperacoes } from "@/server/repositories/gestao";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const params = new URL(request.url).searchParams;
    const periodoDias = readIntParam(params, "periodoDias", { min: 7, max: 365, default: 31 });
    return ok(await listarOperacoes({ periodoDias }));
  });
}

// Criar operação é ato de cadastro: perfil restrito.
export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));
    return ok({
      cliente: await criarCliente({
        nome: readString(corpo, "nome", { min: 2, max: 160 }),
        contrato: readString(corpo, "contrato", { required: false, max: 40 }),
      }),
    });
  });
}
