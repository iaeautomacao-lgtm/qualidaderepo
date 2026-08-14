import mysql from "mysql2/promise";
import { assertProductionConfig, config, isProduction } from "./config";

let pool;

export function getPool() {
  if (!pool) {
    if (isProduction()) assertProductionConfig();

    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      database: config.mysql.database,
      user: config.mysql.user,
      password: config.mysql.password,
      waitForConnections: true,
      connectionLimit: config.mysql.connectionLimit,
      namedPlaceholders: true,
      dateStrings: true,
      ssl: config.mysql.ssl ? {} : undefined,
    });
  }
  return pool;
}

export async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function one(sql, params = {}) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// A migration 003 pode não ter rodado ainda no ambiente que está servindo a
// requisição. Quando a tabela ou a coluna não existe, a tela deve abrir vazia
// em vez de estourar 500 — o repositório trata esses dois códigos e devolve
// resultado vazio. Qualquer outro erro de banco continua subindo.
const MISSING_SCHEMA_ERRORS = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"]);

export function isMissingSchemaError(error) {
  return MISSING_SCHEMA_ERRORS.has(error?.code);
}

// Neutraliza os curingas do LIKE vindos do usuário. Sem isso um `%` digitado na
// busca varre a tabela inteira, e um `_` casa com qualquer caractere sem que
// quem digitou saiba por quê. O valor continua indo como parâmetro do
// prepared statement — isto é sobre semântica de busca, não sobre injeção.
export function paraLike(termo) {
  return `%${String(termo).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
