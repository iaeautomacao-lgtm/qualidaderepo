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

export function assertSafeId(id, field = "id") {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw badRequest(`Identificador inválido: ${field}.`);
  }
  return id;
}
