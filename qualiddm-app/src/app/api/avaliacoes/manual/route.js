import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { createAvaliacaoManual } from "@/server/repositories/catalog";
import { obterAvaliacao } from "@/server/repositories/avaliacoes";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { parseJsonObject, readString } from "@/server/validation";

function idObrigatorio(corpo, campo) {
  const valor = String(corpo?.[campo] || "").trim();
  if (!/^\d{1,20}$/.test(valor) || valor === "0") {
    throw badRequest(`Campo ${campo} invalido.`);
  }
  return valor;
}

function idOpcional(corpo, campo) {
  const valor = String(corpo?.[campo] || "").trim();
  if (!valor) return null;
  if (!/^\d{1,20}$/.test(valor) || valor === "0") {
    throw badRequest(`Campo ${campo} invalido.`);
  }
  return valor;
}

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    const resultado = await createAvaliacaoManual({
      formularioId: idObrigatorio(corpo, "formularioId"),
      campanhaId: idOpcional(corpo, "campanhaId"),
      avaliadoId: idObrigatorio(corpo, "avaliadoId"),
      avaliadorId: session.user.id,
      codGravacao: readString(corpo, "codGravacao", { required: false, max: 60 }),
      dataContato: readString(corpo, "dataContato", { required: false, max: 16 }),
      respostas: Array.isArray(corpo.respostas) ? corpo.respostas : [],
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "avaliacao_manual_criada",
      modulo: "formularios",
      entidade: "avaliacoes",
      entidadeId: resultado.codigo,
      detalhe: `score=${resultado.score ?? "N/A"}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ avaliacao: await obterAvaliacao(resultado.codigo, { user: session.user }) });
  });
}
