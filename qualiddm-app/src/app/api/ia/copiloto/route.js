import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { consumir } from "@/server/security/rate-limit";
import { parseJsonObject, readString } from "@/server/validation";
import { badRequest } from "@/server/errors";
import {
  MAX_CARACTERES_PERGUNTA,
  PERIODOS,
  responderSobreOperacao,
} from "@/server/services/copiloto-ia";

// Teto mais apertado que o do chat de ficha: cada pergunta aqui agrega o período
// inteiro no banco ANTES de chamar o Gemini, então custa mais que uma pergunta
// sobre uma gravação só.
const LIMITE = { limite: 15, janelaMs: 5 * 60 * 1000 };

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    consumir(`ia-copiloto:${session.user.id}`, LIMITE);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const pergunta = readString(corpo, "pergunta", { min: 3, max: MAX_CARACTERES_PERGUNTA });
    const periodo = readString(corpo, "periodo", { allowed: PERIODOS, required: false, default: "monthly" });

    // Recorte de carteira é opcional; quando vem, é id numérico — ele entra numa
    // comparação em SQL dentro do agregado do dashboard.
    const clienteId = corpo.clienteId == null || corpo.clienteId === "" ? null : String(corpo.clienteId);
    if (clienteId != null && (!/^\d{1,20}$/.test(clienteId) || clienteId === "0")) {
      throw badRequest("Identificador de cliente inválido.");
    }

    return ok(
      await responderSobreOperacao({
        pergunta,
        periodo,
        clienteId,
        // Contexto nunca vem do cliente: só pergunta, recorte e histórico.
        historico: corpo.historico,
      }),
    );
  });
}
