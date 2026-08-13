import { NextResponse } from "next/server";

/**
 * Porteiro de borda: barra quem chega sem cookie de sessão.
 *
 * NÃO é a autorização do sistema. Roda no edge runtime, sem acesso ao MySQL,
 * então só consegue ver se o cookie EXISTE — não se ele é válido, nem qual é o
 * papel do usuário. A checagem de verdade continua em `requireSession()` /
 * `requireRole()` dentro de cada handler; isto aqui só evita renderizar tela
 * inteira para quem obviamente não está logado.
 *
 * Não importa nada de `src/server/config.js`: aquele módulo puxa `mysql2` na
 * cadeia de imports e o edge runtime não roda driver TCP.
 */

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "qualiddm_session";

// Mesmo default de config.auth.devBypass — em desenvolvimento a sessão falsa
// vale, senão ninguém consegue abrir o app antes do banco existir.
const DEV_BYPASS =
  process.env.NODE_ENV !== "production" &&
  !["0", "false", "no", "off"].includes(
    String(process.env.QUALITALK_DEV_AUTH_BYPASS ?? "true").toLowerCase()
  );

// Rotas que precisam ficar abertas para o login sequer ser possível.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/health"];

function isPublic(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request) {
  const { nextUrl } = request;
  const { pathname } = nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession || DEV_BYPASS) return NextResponse.next();

  // API responde em JSON: redirecionar um fetch para HTML de login vira erro
  // de parse silencioso no cliente.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Autenticação obrigatória." } },
      { status: 401 }
    );
  }

  const url = nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // `next` guarda só o caminho interno; nunca aceite URL absoluta aqui, senão
  // vira open redirect.
  url.searchParams.set("next", `${pathname}${nextUrl.search}`);

  return NextResponse.redirect(url);
}

export const config = {
  // Deixa passar direto o que é estático: matcher barato evita rodar o
  // middleware em cada asset.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp3|wav)$).*)"],
};
