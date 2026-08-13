import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { assertProductionConfig, config, isProduction } from "../config";
import { forbidden, unauthorized } from "../errors";
import { one, query } from "../db";

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
      },
      devBypass: true,
    };
  }

  if (!token) return null;

  const session = await one(
    `SELECT u.id, u.name, u.email, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = :tokenHash
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.active = 1
      LIMIT 1`,
    { tokenHash: digest(token) }
  );

  return session ? { user: session, token } : null;
}

export async function requireSession() {
  const session = await currentSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireRole(roles) {
  const session = await requireSession();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(session.user.role)) throw forbidden();
  return session;
}
