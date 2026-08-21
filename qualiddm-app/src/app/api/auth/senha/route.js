import { ipDaRequisicao, ok, route } from "@/server/http";
import { destroyOtherSessions, requireSession } from "@/server/security/sessions";
import { parseJsonObject } from "@/server/validation";
import { badRequest } from "@/server/errors";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { alterarSenhaPropria } from "@/server/repositories/usuarios";
import { config } from "@/server/config";

/**
 * Senha lida SEM `trim`.
 *
 * `readString` apara as pontas, e para senha isso é errado: espaço no início ou
 * no fim é parte da senha, e aparar aqui gravaria uma senha diferente da que a
 * pessoa digitou — ela ficaria sem conseguir entrar de volta.
 */
function senha(valor, campo, minimo) {
  if (typeof valor !== "string") throw badRequest(`Campo obrigatório: ${campo}.`);
  if (valor.length < minimo) {
    throw badRequest(`Campo ${campo} deve ter ao menos ${minimo} caracteres.`);
  }
  if (valor.length > 256) throw badRequest(`Campo ${campo} excede 256 caracteres.`);
  return valor;
}

/**
 * Troca da senha pela própria pessoa.
 *
 * `senhaPendenteOk` porque esta é justamente a rota que tem de funcionar quando
 * a senha ainda é a padrão — é a saída da trava, não uma exceção a ela.
 *
 * Nada de senha entra no log de auditoria: registra-se QUE trocou, quando e de
 * qual IP. Log com senha em claro transforma a trilha em lista de credenciais.
 */
export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession({ senhaPendenteOk: true });

    if (session.devBypass) {
      // No bypass de desenvolvimento não existe senha para trocar.
      return ok({ trocada: false, devBypass: true });
    }

    const corpo = parseJsonObject(await request.json().catch(() => null));

    const resultado = await alterarSenhaPropria(session.user.id, {
      senhaAtual: senha(corpo.senhaAtual, "senhaAtual", 1),
      novaSenha: senha(corpo.novaSenha, "novaSenha", config.auth.senhaMinima),
    });

    if (session.token) await destroyOtherSessions(session.user.id, session.token);

    await registrarAuditoria({
      userId: session.user.id,
      acao: "senha_alterada",
      modulo: "conta",
      entidade: "users",
      entidadeId: String(session.user.id),
      severidade: "aviso",
      detalhe: "senha trocada pela própria pessoa; outras sessões encerradas",
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ trocada: true, nome: resultado.nome, email: resultado.email });
  });
}
