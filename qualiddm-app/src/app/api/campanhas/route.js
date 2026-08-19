import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { parseJsonObject, readIdParam, readIntParam, readString } from "@/server/validation";
import { CANAIS, criarCampanha, listarCampanhas } from "@/server/repositories/gestao";

const CANAIS_ACEITOS = CANAIS.map((canal) => canal.id);

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const params = new URL(request.url).searchParams;
    return ok(
      await listarCampanhas({
        periodoDias: readIntParam(params, "periodoDias", { min: 7, max: 365, default: 31 }),
        clienteId: readIdParam(params, "clienteId"),
      }),
    );
  });
}

export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));
    return ok({
      campanha: await criarCampanha({
        clienteId: readString(corpo, "clienteId", { min: 1, max: 20 }),
        nome: readString(corpo, "nome", { min: 2, max: 160 }),
        canal: readString(corpo, "canal", { required: false, default: "telefone", allowed: CANAIS_ACEITOS }),
      }),
    });
  });
}
