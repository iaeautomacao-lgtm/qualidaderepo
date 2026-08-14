import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest, conflict } from "@/server/errors";
import { validateUploadFiles } from "@/server/services/upload-service";
import { avaliarArquivo } from "@/server/services/avaliacao-ia";
import { createAvaliacaoFromIa, getFormularioParaAvaliacaoIa } from "@/server/repositories/catalog";

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);

    const form = await request.formData().catch(() => null);
    if (!form) throw badRequest("Envie o arquivo como multipart/form-data.");

    const arquivo = form.get("arquivo");
    if (!arquivo || typeof arquivo.arrayBuffer !== "function") {
      throw badRequest("Campo 'arquivo' ausente.");
    }

    const formularioId = String(form.get("formularioId") || "").trim();
    if (!/^\d+$/.test(formularioId)) {
      throw badRequest("Selecione o formulario correto antes de enviar para a IA.");
    }

    validateUploadFiles([arquivo]);

    const formulario = await getFormularioParaAvaliacaoIa({ formularioId });
    if (!formulario || formulario.secoes.length === 0) {
      throw conflict("O formulario selecionado nao esta ativo ou nao possui criterios para avaliar o arquivo.");
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await avaliarArquivo({
      nome: arquivo.name,
      mimeType: arquivo.type || "application/octet-stream",
      base64: bytes.toString("base64"),
      tamanho: bytes.length,
      secoes: formulario.secoes,
      contexto: {
        cliente: formulario.cliente,
        campanha: formulario.campanha,
        formulario: formulario.nome,
      },
    });

    const registro = await createAvaliacaoFromIa({
      formulario,
      resultado,
      arquivo: { nome: arquivo.name },
      avaliadorId: session.user.id,
    });

    return ok({
      ...resultado,
      avaliacao: {
        id: registro.codigo,
        href: `/avaliacoes/${registro.codigo}`,
      },
    });
  });
}
