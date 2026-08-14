import { badRequest } from "./errors";

export function parseJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Envie um JSON válido.");
  }
  return value;
}

export function readString(source, field, options = {}) {
  const value = source[field];
  const required = options.required !== false;
  if (value == null || value === "") {
    if (required) throw badRequest(`Campo obrigatório: ${field}.`);
    return options.default ?? null;
  }
  if (typeof value !== "string") {
    throw badRequest(`Campo ${field} deve ser texto.`);
  }
  const trimmed = value.trim();
  if (options.min && trimmed.length < options.min) {
    throw badRequest(`Campo ${field} deve ter ao menos ${options.min} caracteres.`);
  }
  if (options.max && trimmed.length > options.max) {
    throw badRequest(`Campo ${field} deve ter no máximo ${options.max} caracteres.`);
  }
  if (options.allowed && !options.allowed.includes(trimmed)) {
    throw badRequest(`Valor inválido para ${field}.`);
  }
  return trimmed;
}

export function readIntParam(searchParams, field, options = {}) {
  const raw = searchParams.get(field);
  if (raw == null || raw === "") return options.default ?? null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw badRequest(`Parâmetro ${field} deve ser numérico.`);
  if (options.min != null && value < options.min) throw badRequest(`Parâmetro ${field} abaixo do mínimo.`);
  if (options.max != null && value > options.max) throw badRequest(`Parâmetro ${field} acima do máximo.`);
  return value;
}

export function readEnumParam(searchParams, field, allowed, fallback) {
  const value = searchParams.get(field) || fallback;
  if (!allowed.includes(value)) throw badRequest(`Valor inválido para ${field}.`);
  return value;
}

// Identificador de linha vindo da query string. Os IDs do banco são BIGINT;
// não vira Number aqui para não perder precisão acima de 2^53 — segue como
// texto de dígitos e o MySQL faz a conversão no prepared statement.
export function readIdParam(searchParams, field) {
  const raw = searchParams.get(field);
  if (raw == null || raw === "") return null;
  if (!/^\d{1,20}$/.test(raw)) throw badRequest(`Parâmetro ${field} deve ser um identificador numérico.`);
  if (raw === "0") throw badRequest(`Parâmetro ${field} inválido.`);
  return raw;
}

// Aceita só YYYY-MM-DD, o formato que o <input type="date"> manda. Validar o
// formato aqui evita que um texto qualquer chegue a uma comparação de data no
// SQL e vire silenciosamente NULL na filtragem.
export function readDateParam(searchParams, field) {
  const raw = searchParams.get(field);
  if (raw == null || raw === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw badRequest(`Parâmetro ${field} deve estar no formato AAAA-MM-DD.`);
  }
  const [ano, mes, dia] = raw.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw badRequest(`Parâmetro ${field} não é uma data válida.`);
  }
  return raw;
}

export function readSearchParam(searchParams, field, max = 120) {
  const raw = searchParams.get(field);
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    throw badRequest(`Parâmetro ${field} deve ter no máximo ${max} caracteres.`);
  }
  return trimmed;
}

export function readBoolParam(searchParams, field, fallback = false) {
  const raw = searchParams.get(field);
  if (raw == null || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw badRequest(`Parâmetro ${field} deve ser booleano.`);
}

// Paginação obrigatória em toda listagem. `max` muda por rota: a tela de
// Feedback pede 200 linhas, a de relatórios chega a 1000.
export function readPaginacao(searchParams, { padrao = 50, max = 200 } = {}) {
  return {
    limit: readIntParam(searchParams, "limit", { default: padrao, min: 1, max }),
    offset: readIntParam(searchParams, "offset", { default: 0, min: 0, max: 1000000 }),
  };
}

export function assertSafeId(id, field = "id") {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw badRequest(`Identificador inválido: ${field}.`);
  }
  return id;
}
