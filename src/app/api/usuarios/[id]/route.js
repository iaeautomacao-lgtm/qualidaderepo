import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { parseJsonObject, readString } from "@/server/validation";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { PAPEIS, atualizarUsuario, listarUsuarios } from "@/server/repositories/usuarios";

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de usuário inválido.");
  return id;
}

/**
 * Ativa, desativa ou muda cargo/papel/carteira.
 *
 * Só administrador: mudar papel muda o que a pessoa pode fazer no sistema.
 *
 * Não existe DELETE nesta rota de propósito. Pessoa é autora de avaliação,
 * feedback e contestação — apagar a linha levaria a autoria de tudo isso. A
 * "exclusão" de gente é a desativação, e é feita por aqui.
 */
export async function PATCH(request, { params }) {
  return route(request, async () => {
    const session = await requireRole(["administrador"]);
    const { id } = await params;
    const usuarioId = idValido(id);

    const corpo = parseJsonObject(await request.json().catch(() => null));
    const alteracoes = {};

    if (corpo.ativo !== undefined) {
      if (typeof corpo.ativo !== "boolean") throw badRequest("Campo ativo deve ser booleano.");
      // Ninguém se desativa: administrador que se desliga sozinho fica de fora do
      // sistema sem ter quem o reative.
      if (corpo.ativo === false && String(session.user.id) === String(usuarioId)) {
        throw badRequest("Você não pode desativar o seu próprio acesso.");
      }
      alteracoes.ativo = corpo.ativo;
    }
    if (corpo.papel !== undefined) {
      alteracoes.papel = readString(corpo, "papel", { allowed: PAPEIS });
      if (String(session.user.id) === String(usuarioId) && alteracoes.papel !== "administrador") {
        throw badRequest("Você não pode retirar o seu próprio acesso de administrador.");
      }
    }
    if (corpo.cargoId !== undefined) {
      alteracoes.cargoId = corpo.cargoId ? String(corpo.cargoId) : null;
    }
    if (corpo.clienteId !== undefined) {
      alteracoes.clienteId = corpo.clienteId ? String(corpo.clienteId) : null;
    }
    if (corpo.turnoId !== undefined) {
      alteracoes.turnoId = corpo.turnoId ? String(corpo.turnoId) : null;
    }
    if (corpo.supervisorId !== undefined) {
      alteracoes.supervisorId = corpo.supervisorId ? String(corpo.supervisorId) : null;
    }
    if (corpo.nome !== undefined) {
      alteracoes.nome = readString(corpo, "nome", { min: 2, max: 140 });
    }
    if (corpo.email !== undefined) {
      alteracoes.email = readString(corpo, "email", { required: false, min: 5, max: 180 })?.toLowerCase();
    }
    if (corpo.login !== undefined) {
      alteracoes.login = corpo.login ? String(corpo.login) : null;
    }
    if (corpo.cpf !== undefined) {
      alteracoes.cpf = corpo.cpf ? String(corpo.cpf) : null;
    }
    if (corpo.matricula !== undefined) {
      alteracoes.matricula = corpo.matricula ? String(corpo.matricula) : null;
    }
    if (corpo.dataInicioProduto !== undefined) {
      alteracoes.dataInicioProduto = corpo.dataInicioProduto ? String(corpo.dataInicioProduto) : null;
    }
    if (corpo.hierarquiaVigencia !== undefined) {
      alteracoes.hierarquiaVigencia = corpo.hierarquiaVigencia ? String(corpo.hierarquiaVigencia) : null;
    }
    if (corpo.hierarquiaMotivo !== undefined) {
      alteracoes.hierarquiaMotivo = corpo.hierarquiaMotivo ? String(corpo.hierarquiaMotivo) : null;
    }

    if (Object.keys(alteracoes).length === 0) {
      throw badRequest("Envie ao menos um campo para alterar.");
    }

    await atualizarUsuario(usuarioId, alteracoes);

    await registrarAuditoria({
      userId: session.user.id,
      acao: "usuario_atualizado",
      modulo: "usuarios",
      entidade: "users",
      entidadeId: usuarioId,
      severidade: alteracoes.ativo === false || alteracoes.papel ? "aviso" : "info",
      detalhe: Object.entries(alteracoes)
        .map(([campo, valor]) => `${campo}=${valor}`)
        .join("; "),
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok(await listarUsuarios());
  });
}
