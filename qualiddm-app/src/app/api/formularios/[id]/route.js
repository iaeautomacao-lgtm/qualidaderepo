import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import {
  STATUS_FORMULARIO,
  TIPOS_CALCULO,
  atualizarFormulario,
  excluirFormulario,
  listarFormularios,
} from "@/server/repositories/formularios";

/** Id de formulário é numérico e vem da URL. */
function idDeFormulario(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") {
    throw badRequest("Identificador de formulário inválido.");
  }
  return id;
}

/**
 * Edita o cadastro do formulário: descrição, tipo de cálculo e status.
 *
 * Cadastro de formulário é configuração de régua — administrador e supervisor.
 * Monitor aplica a régua, não a define.
 */
export async function PATCH(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const formularioId = idDeFormulario(id);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const alteracoes = {};

    // `undefined` = campo não enviado; string vazia = descrição apagada de
    // propósito. Os dois casos são diferentes e não podem colapsar em um.
    if (corpo.descricao !== undefined) {
      alteracoes.descricao =
        readString(corpo, "descricao", { required: false, max: 4000 }) ?? null;
    }
    if (corpo.tipoCalculo !== undefined) {
      alteracoes.tipoCalculo = readString(corpo, "tipoCalculo", { allowed: TIPOS_CALCULO });
    }
    if (corpo.status !== undefined) {
      alteracoes.status = readString(corpo, "status", { allowed: STATUS_FORMULARIO });
    }

    if (Object.keys(alteracoes).length === 0) {
      throw badRequest("Envie ao menos um campo para alterar.");
    }

    await atualizarFormulario({ id: formularioId, ...alteracoes });

    await registrarAuditoria({
      userId: session.user.id,
      acao: "formulario_atualizado",
      modulo: "formularios",
      entidade: "formularios",
      entidadeId: formularioId,
      detalhe: Object.keys(alteracoes).join(", "),
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    // Catálogo recarregado no mesmo shape do GET: a tela troca o estado sem um
    // segundo request.
    return ok(await listarFormularios());
  });
}

/**
 * Exclui o formulário — desativa quando já há monitoria lançada.
 *
 * Só administrador: desativar formulário tira a régua de circulação para a
 * carteira inteira.
 */
export async function DELETE(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { id } = await params;
    const formularioId = idDeFormulario(id);

    const resultado = await excluirFormulario(formularioId);

    if (!resultado.jaEstava) {
      await registrarAuditoria({
        userId: session.user.id,
        acao: resultado.acao === "excluido" ? "formulario_excluido" : "formulario_desativado",
        modulo: "formularios",
        entidade: "formularios",
        entidadeId: formularioId,
        severidade: "aviso",
        detalhe: `${resultado.nome} (${resultado.avaliacoes} avaliação(ões) vinculada(s))`,
        ip: ipDaRequisicao(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return ok({ ...resultado, ...(await listarFormularios()) });
  });
}
