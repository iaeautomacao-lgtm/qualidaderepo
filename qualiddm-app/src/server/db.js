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
