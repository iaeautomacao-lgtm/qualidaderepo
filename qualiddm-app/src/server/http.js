import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { config, isProduction } from "./config";

function requestIdFrom(request) {
  return request?.headers?.get("x-request-id") || crypto.randomUUID();
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function ok(data, init = {}) {
  return json({ ok: true, data }, init);
}

export function created(data) {
  return ok(data, { status: 201 });
}

export function empty(status = 204) {
  return new NextResponse(null, { status });
}

export function handleError(error, request) {
  const requestId = requestIdFrom(request);

  if (error instanceof AppError) {
    return json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.status }
    );
  }

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      message: "Unhandled API error",
      error: isProduction() ? undefined : String(error?.stack || error),
    })
  );

  return json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "Não foi possível concluir a operação.",
        requestId,
      },
    },
    { status: 500 }
  );
}

export async function route(request, handler) {
  try {
    return await handler();
  } catch (error) {
    return handleError(error, request);
  }
}

export function applyCors(response, request) {
  const origin = request.headers.get("origin");
  if (!origin || config.cors.allowedOrigins.length === 0) return response;
  if (!config.cors.allowedOrigins.includes(origin)) return response;

  response.headers.set("access-control-allow-origin", origin);
  response.headers.set("vary", "Origin");
  response.headers.set("access-control-allow-credentials", "true");
  return response;
}
