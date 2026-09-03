import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { matrizPermissoes } from "@/server/repositories/usuarios";

// Matriz de permissões por cargo (botão "Ver Matriz de Permissões").
// Leitura: administrador e supervisor.
export async function GET(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    return ok(await matrizPermissoes());
  });
}
