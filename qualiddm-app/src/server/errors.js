export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details = null) {
  return new AppError(400, "bad_request", message, details);
}

export function unauthorized(message = "Autenticação obrigatória.") {
  return new AppError(401, "unauthorized", message);
}

export function forbidden(message = "Acesso negado.") {
  return new AppError(403, "forbidden", message);
}

export function notFound(message = "Recurso não encontrado.") {
  return new AppError(404, "not_found", message);
}

export function conflict(message, details = null) {
  return new AppError(409, "conflict", message, details);
}

export function tooManyRequests(message = "Muitas requisições. Tente novamente em instantes.", details = null) {
  return new AppError(429, "too_many_requests", message, details);
}
