import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { assertProductionConfig, config, isProduction } from "../config";
import { forbidden, senhaPendente, unauthorized } from "../errors";
import { one, query } from "../db";

/* `trocar_senha` chegou na migration 003. O check evita que um banco anterior
   a ela derrube TODO login por coluna inexistente. Memoizado: e uma pergunta
   sobre o schema, nao sobre a requisicao. */
let temTrocarSenha = null;

async function colunaTrocarSenha() {
  if (temTrocarSenha === null) {
    temTrocarSenha = query("SHOW COLUMNS FROM users LIKE 'trocar_senha'")
      .then((rows) => rows.length > 0)
      .catch(() => false);
  }
  return temTrocarSenha;
}

function digest(token) {
  return createHash("sha256").update(`${config.auth.sessionSecret}:${token}`).digest("hex");
}

export function sessionExpiresAt() {
  const expires = new Date();
  expires.setDate(expires.getDate() + config.auth.sessionDays);
  return expires;
}

export async function createSession(userId) {
  if (isProduction()) assertProductionConfig();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = digest(token);
  const expiresAt = sessionExpiresAt();

  await query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES (:userId, :tokenHash, :expiresAt)`,
    { userId, tokenHash, expiresAt }
  );

  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await query("DELETE FROM user_sessions WHERE token_hash = :tokenHash", {
    tokenHash: digest(token),
  });
}

/**
 * Derruba as outras sessões da pessoa, mantendo a atual.
 *
 * Chamado depois de trocar a senha: se a senha antiga vazou, quem estiver
 * logado com ela em outro lugar continuaria dentro. A sessão de quem trocou
 * fica de pé para não expulsar a própria pessoa da tela.
 */
export async function destroyOtherSessions(userId, tokenAtual) {
  await query(
    `DELETE FROM user_sessions
      WHERE user_id = :userId
        AND token_hash <> :tokenHash`,
    { userId, tokenHash: digest(tokenAtual) },
  );
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookies.set({
    name: config.auth.sessionCookie,
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set({
    name: config.auth.sessionCookie,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function currentSession() {
  if (isProduction()) assertProductionConfig();

  const token = (await cookies()).get(config.auth.sessionCookie)?.value;

  if (!token && !isProduction() && config.auth.devBypass) {
    return {
      user: {
        id: 1,
        name: "Gisele Oliveira",
        email: "admin@qualiddm.local",
        // Papel do domínio novo (migration 002). Com "admin" o bypass de
        // desenvolvimento passaria em requireSession mas seria barrado por
        // requireRole, que agora espera administrador/monitor/supervisor.
        role: "administrador",
        // O bypass de desenvolvimento nao passa pela troca de senha: nao ha
        // senha nenhuma nesse caminho.
        trocarSenha: false,
      },
      devBypass: true,
    };
  }

  if (!token) return null;

  const temTrocar = await colunaTrocarSenha();

  const session = await one(
    `SELECT u.id, u.name, u.email, u.role
            ${temTrocar ? ", u.trocar_senha" : ""}
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = :tokenHash
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.active = 1
      LIMIT 1`,
    { tokenHash: digest(token) }
  );

  if (!session) return null;

  const { trocar_senha: trocar, ...usuario } = session;
  return { user: { ...usuario, trocarSenha: trocar === 1 }, token };
}

/**
 * Sessao valida — e senha ja trocada.
 *
 * A trava e aqui, no servidor, e nao numa checagem de tela: e ela que faz de
 * uma senha padrao compartilhada um risco aceitavel. Enquanto `trocar_senha`
 * estiver em 1 a pessoa esta autenticada e nao consegue ler nem gravar nada.
 *
 * `senhaPendenteOk` e para as tres rotas que PRECISAM funcionar nesse estado:
 * saber quem sou (`auth/me`), sair (`auth/logout`) e trocar a senha
 * (`auth/senha`). Qualquer rota nova entra com o padrao, negando.
 */
export async function requireSession({ senhaPendenteOk = false } = {}) {
  const session = await currentSession();
  if (!session) throw unauthorized();
  if (!senhaPendenteOk && session.user.trocarSenha) throw senhaPendente();
  return session;
}

export async function requireRole(roles, opcoes = {}) {
  const session = await requireSession(opcoes);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(session.user.role)) throw forbidden();
  return session;
}
