import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, encoded) {
  const [scheme, iterationsRaw, salt, expected] = String(encoded || "").split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !salt || !expected) return false;

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations)) return false;

  const actual = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (actual.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actual, expectedBuffer);
}
