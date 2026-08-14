import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { readDateParam, readEnumParam, readIdParam, readPaginacao, readSearchParam } from "@/server/validation";
import { listarAuditoria } from "@/server/repositories/administracao";

// Card "Trilha de Auditoria — registro de acessos e ações sensíveis
// (compliance)". Leitura restrita: a trilha é o registro de quem fez o quê.
export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });
    const resultado = readEnumParam(searchParams, "resultado", ["sucesso", "falha", "todos"], "todos");

    return ok(
      await listarAuditoria({
        filtros: {
          usuarioId: readIdParam(searchParams, "usuarioId"),
          modulo: readSearchParam(searchParams, "modulo", 60),
          resultado: resultado === "todos" ? null : resultado,
          dataInicio: readDateParam(searchParams, "dataInicio"),
          dataFim: readDateParam(searchParams, "dataFim"),
        },
        limit,
        offset,
      }),
    );
  });
}
