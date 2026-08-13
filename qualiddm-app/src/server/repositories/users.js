import { one } from "../db";

export async function findUserByEmail(email) {
  return one(
    `SELECT id, name, email, password_hash, role, active
       FROM users
      WHERE email = :email
      LIMIT 1`,
    { email }
  );
}
