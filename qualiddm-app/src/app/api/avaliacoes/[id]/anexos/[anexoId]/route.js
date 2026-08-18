import { route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { assertSafeId } from "@/server/validation";
import { obterAnexoAvaliacao } from "@/server/repositories/avaliacoes";
import { resolverCaminhoStorage, respostaArquivo } from "@/server/services/arquivo-storage";

// Download de um anexo de critério. O anexo é buscado pelo par
// (código da avaliação, id do anexo) — trocar só o id na URL não dá acesso ao
// anexo de outra ficha.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id, anexoId } = await params;

    if (!/^\d{1,20}$/.test(anexoId) || anexoId === "0") {
      throw badRequest("Identificador de anexo inválido.");
    }

    const anexo = await obterAnexoAvaliacao(assertSafeId(id, "codigo"), anexoId);

    return respostaArquivo(request, {
      caminhoAbsoluto: resolverCaminhoStorage(anexo.caminho),
      nomeArquivo: anexo.nome,
      mimeType: anexo.mimeType,
      // Anexo é para guardar, não para renderizar dentro da página: `attachment`
      // evita que um HTML enviado como anexo execute no domínio da aplicação.
      anexar: true,
      mensagemAusente: "Anexo não encontrado no armazenamento.",
    });
  });
}
