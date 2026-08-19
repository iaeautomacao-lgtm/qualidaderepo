import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { parseJsonObject, readIntParam, readString } from "@/server/validation";
import { badRequest } from "@/server/errors";
import { listarMetas, salvarMeta } from "@/server/repositories/gestao";

// Ano e mês do servidor como padrão: a tela abre no mês corrente sem precisar
// mandar o recorte na primeira leitura.
function periodoAtual() {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

export async function GET(request) {
  return route(request, async () => {
    await requireSession();
    const params = new URL(request.url).searchParams;
    const atual = periodoAtual();
    return ok(
      await listarMetas({
        ano: readIntParam(params, "ano", { min: 2020, max: 2100, default: atual.ano }),
        mes: readIntParam(params, "mes", { min: 1, max: 12, default: atual.mes }),
      }),
    );
  });
}

export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));
    const atual = periodoAtual();

    const metaAgente = Number.parseInt(corpo.metaAgente, 10);
    if (!Number.isFinite(metaAgente) || metaAgente < 1 || metaAgente > 999) {
      throw badRequest("Meta por agente deve ser um número de 1 a 999.");
    }

    const numeroOpcional = (valor, min, max, padrao) => {
      if (valor == null || valor === "") return padrao;
      const convertido = Number(valor);
      if (!Number.isFinite(convertido) || convertido < min || convertido > max) {
        throw badRequest("Valor fora do intervalo aceito.");
      }
      return convertido;
    };

    return ok(
      await salvarMeta({
        clienteId: readString(corpo, "clienteId", { min: 1, max: 20 }),
        campanhaId: corpo.campanhaId ? readString(corpo, "campanhaId", { max: 20 }) : null,
        ano: numeroOpcional(corpo.ano, 2020, 2100, atual.ano),
        mes: numeroOpcional(corpo.mes, 1, 12, atual.mes),
        metaAgente,
        metaScore: numeroOpcional(corpo.metaScore, 0, 100, null),
        observacao: readString(corpo, "observacao", { required: false, max: 400 }),
      }),
    );
  });
}
