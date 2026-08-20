import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { readIntParam } from "@/server/validation";
import { listarAvaliacoes, listarOpcoesAvaliacoes } from "@/server/repositories/avaliacoes";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const searchParams = new URL(request.url).searchParams;
    const limit = readIntParam(searchParams, "limit", { default: 100, min: 1, max: 2000 });
    const offset = readIntParam(searchParams, "offset", { default: 0, min: 0, max: 100000 });

    const [avaliacoes, opcoes] = await Promise.all([
      listarAvaliacoes({ limit, offset }),
      listarOpcoesAvaliacoes(),
    ]);

    return ok({ avaliacoes, opcoes });
  });
}
