import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { parseJsonObject, readString } from "@/server/validation";
import { CANAIS, atualizarCampanha, excluirCampanha } from "@/server/repositories/gestao";

const CANAIS_ACEITOS = CANAIS.map((canal) => canal.id);

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de campanha inválido.");
  return id;
}

export async function PATCH(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const corpo = parseJsonObject(await request.json().catch(() => null));
    return ok({
      campanha: await atualizarCampanha(idValido(id), {
        nome: readString(corpo, "nome", { min: 2, max: 160 }),
        canal: readString(corpo, "canal", { required: false, default: "telefone", allowed: CANAIS_ACEITOS }),
        ativa: corpo.ativa !== false,
      }),
    });
  });
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    return ok({ resultado: await excluirCampanha(idValido(id)) });
  });
}
