import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { parseJsonObject } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { formulariosCompativeis, gerarFichaDaAnalise } from "@/server/services/ficha-da-analise";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") {
    throw badRequest("Identificador de gravação inválido.");
  }
  return id;
}

function idOpcional(valor, campo) {
  if (valor == null || valor === "") return null;
  const texto = String(valor);
  if (!/^\d{1,20}$/.test(texto) || texto === "0") {
    throw badRequest(`Campo ${campo} deve ser um identificador numérico.`);
  }
  return texto;
}

// Formulários que podem avaliar esta gravação, mais o estado da conversão.
// A tela usa isto para decidir entre oferecer a conversão e apontar para a ficha
// que já existe.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    return ok(await formulariosCompativeis(idValido(id)));
  });
}

/**
 * Gera a monitoria com formulário a partir da análise livre.
 *
 * Reprocessa o arquivo contra os critérios do formulário — não copia os status da
 * análise genérica. Os critérios são outros, então a nota é outra; apresentar a
 * nota antiga sob o nome do formulário seria mostrar um número que aquele
 * formulário nunca produziu.
 *
 * Papel de quem monitora: é o lançamento de uma monitoria.
 */
export async function POST(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const { id } = await params;
    const gravacaoId = idValido(id);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const formularioId = idOpcional(corpo.formularioId, "formularioId");
    if (!formularioId) throw badRequest("Escolha o formulário que vai avaliar esta gravação.");

    const resultado = await gerarFichaDaAnalise({
      gravacaoId,
      formularioId,
      avaliadoId: idOpcional(corpo.avaliadoId, "avaliadoId"),
      avaliadorId: session.user.id,
    });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "analise_convertida_em_ficha",
      modulo: "avaliacoes",
      entidade: "avaliacoes",
      entidadeId: resultado.codigo,
      detalhe: `gravação ${gravacaoId} avaliada por "${resultado.formulario}" — nota ${resultado.score}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(resultado);
  });
}
