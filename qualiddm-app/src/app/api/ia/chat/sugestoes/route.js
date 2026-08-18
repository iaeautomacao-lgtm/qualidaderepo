import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { readEnumParam, readSearchParam } from "@/server/validation";
import { ESCOPOS, sugestoesIniciais } from "@/server/services/chat-ia";

// Perguntas iniciais do chat, montadas das não conformidades da própria ficha.
// NÃO chama o modelo: abrir a tela não deve custar uma requisição de IA, e por
// isso também não tem rate limit.
export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor", "monitor"]);

    const searchParams = new URL(request.url).searchParams;
    const escopo = readEnumParam(searchParams, "escopo", ESCOPOS, "avaliacao");
    const referencia = readSearchParam(searchParams, "referencia", 64);

    if (!referencia) throw badRequest("Parâmetro obrigatório: referencia.");
    if (escopo === "avaliacao" && !/^[a-zA-Z0-9_-]{1,64}$/.test(referencia)) {
      throw badRequest("Código de avaliação inválido.");
    }
    if (escopo === "gravacao" && (!/^\d{1,20}$/.test(referencia) || referencia === "0")) {
      throw badRequest("Identificador de gravação inválido.");
    }

    return ok({ sugestoes: await sugestoesIniciais({ escopo, referencia }) });
  });
}
