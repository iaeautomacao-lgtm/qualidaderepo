import { ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { validateUploadFiles } from "@/server/services/upload-service";
import { avaliarArquivo } from "@/server/services/avaliacao-ia";
import { avaliacao, secoes } from "@/data/seed";

/**
 * POST /api/avaliar
 *
 * Recebe um arquivo de atendimento (áudio ou PDF de chat) e devolve a ficha
 * preenchida pela IA, critério a critério.
 *
 * Não toca no banco de propósito: é o caminho que permite validar o motor de
 * avaliação antes de o MySQL estar de pé. Nada é persistido — o resultado
 * volta na resposta e morre ali.
 *
 * O formulário usado é o "Formulário Educacional | Cruzeiro" de `src/data/seed.js`.
 * Quando o banco entrar, ele passa a vir da carteira do arquivo enviado.
 */
export async function POST(request) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor", "monitor"]);

    const form = await request.formData().catch(() => null);
    if (!form) throw badRequest("Envie o arquivo como multipart/form-data.");

    const arquivo = form.get("arquivo");
    if (!arquivo || typeof arquivo.arrayBuffer !== "function") {
      throw badRequest("Campo 'arquivo' ausente.");
    }

    // Mesma validação de tipo, extensão e tamanho do upload comum — não existe
    // porta dos fundos com regra mais frouxa.
    validateUploadFiles([arquivo]);

    const bytes = Buffer.from(await arquivo.arrayBuffer());

    const resultado = await avaliarArquivo({
      nome: arquivo.name,
      mimeType: arquivo.type || "application/octet-stream",
      base64: bytes.toString("base64"),
      tamanho: bytes.length,
      secoes,
      contexto: {
        cliente: avaliacao.cliente,
        campanha: avaliacao.campanha,
        formulario: avaliacao.formulario,
      },
    });

    return ok(resultado);
  });
}
