import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { parseJsonObject, readIntParam, readString } from "@/server/validation";
import { hashPassword } from "@/server/security/passwords";
import { criarAvaliado, listarAvaliados } from "@/server/repositories/gestao";

const PAPEIS = ["operador", "monitor", "supervisor"];

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const params = new URL(request.url).searchParams;
    return ok(
      await listarAvaliados({
        periodoDias: readIntParam(params, "periodoDias", { min: 7, max: 365, default: 31 }),
      }),
    );
  });
}

export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    // Senha provisória obrigatória e nunca gerada no cliente: a conta nasce com
    // hash, e a troca fica para o primeiro acesso.
    const senha = readString(corpo, "senhaProvisoria", { min: 8, max: 100 });

    return ok({
      avaliado: await criarAvaliado({
        nome: readString(corpo, "nome", { min: 2, max: 140 }),
        email: readString(corpo, "email", { min: 5, max: 180 }).toLowerCase(),
        papel: readString(corpo, "papel", { required: false, default: "operador", allowed: PAPEIS }),
        senhaHash: hashPassword(senha),
      }),
    });
  });
}
