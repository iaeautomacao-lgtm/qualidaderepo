import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { readIntParam } from "@/server/validation";
import {
  getAdministracaoMetricas,
  listarCargos,
  obterWorkflowAtivo,
} from "@/server/repositories/administracao";

// Tela Administração L1. Só administrador e supervisor: o bloco de RBAC e a
// atividade recente expõem e-mail de usuário e ação sensível — não é conteúdo
// para qualquer sessão autenticada.
export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);

    const searchParams = new URL(request.url).searchParams;
    const limiteAtividade = readIntParam(searchParams, "limiteAtividade", {
      default: 20,
      min: 1,
      max: 100,
    });

    const [metricas, cargos, workflow] = await Promise.all([
      getAdministracaoMetricas({ limiteAtividade }),
      listarCargos(),
      obterWorkflowAtivo(),
    ]);

    return ok({ ...metricas, cargos, workflowAtivo: workflow });
  });
}
