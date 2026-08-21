import { conflict, unauthorized } from "../errors";
import { findUserByEmail } from "../repositories/users";
import { verifyPassword } from "../security/passwords";
import { createSession } from "../security/sessions";

export async function login({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throw unauthorized("E-mail ou senha inválidos.");
  }

  const session = await createSession(user.id);
  return {
    session,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      /* A sessão é criada mesmo com a senha pendente: sem ela a pessoa não
         teria como se autenticar para trocar a senha. O que a senha pendente
         bloqueia é o resto do sistema, em `requireSession`. */
      trocarSenha: user.trocar_senha === 1,
    },
  };
}

export function assertCanReview(user) {
  // Papéis da migration 002. Operador é avaliado, não avalia.
  if (!["administrador", "supervisor", "monitor"].includes(user.role)) {
    throw conflict("Usuário sem permissão para revisar avaliações.");
  }
}
