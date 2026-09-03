import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { consumir } from "@/server/security/rate-limit";
import { badRequest } from "@/server/errors";
import { parseJsonObject, readString } from "@/server/validation";
import { ESCOPOS, MAX_CARACTERES_PERGUNTA, responderSobreAtendimento } from "@/server/services/chat-ia";

// Teto por usuário. A rota chama o Gemini a cada requisição, então o limite é
// sobre custo tanto quanto sobre abuso: 20 perguntas em 5 minutos é mais do que
// um monitor faz revisando uma ficha, e barra o clique repetido.
const LIMITE = { limite: 20, janelaMs: 5 * 60 * 1000 };

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    consumir(`ia-chat:${session.user.id}`, LIMITE);

    const corpo = parseJsonObject(await request.json().catch(() => null));

    const escopo = readString(corpo, "escopo", { allowed: ESCOPOS });
    const referencia = readString(corpo, "referencia", { max: 64 });
    const pergunta = readString(corpo, "pergunta", { min: 3, max: MAX_CARACTERES_PERGUNTA });

    // A referência vira código de avaliação ou id de gravação; o formato é
    // conferido aqui para o repositório não receber texto arbitrário.
    if (escopo === "avaliacao" && !/^[a-zA-Z0-9_-]{1,64}$/.test(referencia)) {
      throw badRequest("Código de avaliação inválido.");
    }
    if (escopo === "gravacao" && (!/^\d{1,20}$/.test(referencia) || referencia === "0")) {
      throw badRequest("Identificador de gravação inválido.");
    }

    return ok(
      await responderSobreAtendimento({
        escopo,
        referencia,
        pergunta,
        // O contexto NUNCA vem do cliente: só a pergunta e o histórico. Ver
        // src/server/services/chat-ia.js.
        historico: corpo.historico,
      }),
    );
  });
}
