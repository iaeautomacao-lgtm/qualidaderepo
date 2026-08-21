import { one, query } from "../db";

/* `trocar_senha` chegou na migration 003. Sem o check, um banco anterior a ela
   derrubaria o login inteiro por coluna inexistente. Memoizado: é pergunta
   sobre o schema, não sobre a requisição. */
let temTrocarSenha = null;

async function colunaTrocarSenha() {
  if (temTrocarSenha === null) {
    temTrocarSenha = query("SHOW COLUMNS FROM users LIKE 'trocar_senha'")
      .then((rows) => rows.length > 0)
      .catch(() => false);
  }
  return temTrocarSenha;
}

export async function findUserByEmail(email) {
  const temTrocar = await colunaTrocarSenha();

  return one(
    `SELECT id, name, email, password_hash, role, active
            ${temTrocar ? ", trocar_senha" : ""}
       FROM users
      WHERE email = :email
      LIMIT 1`,
    { email }
  );
}
