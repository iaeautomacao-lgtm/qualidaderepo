import { route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { obterArquivoGravacao } from "@/server/repositories/transcricoes";
import { resolverCaminhoStorage, respostaArquivo } from "@/server/services/arquivo-storage";

// Áudio da gravação para o player da tela de Transcrições.
//
// Não passa por `ok()`: a resposta é o arquivo, não o envelope JSON. Erro
// continua saindo no envelope, porque `route()` trata a exceção.
async function servir(request, params, apenasCabecalhos) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    if (!/^\d{1,20}$/.test(id) || id === "0") {
      throw badRequest("Identificador de gravação inválido.");
    }

    const arquivo = await obterArquivoGravacao(id);

    return respostaArquivo(request, {
      // `resolverCaminhoStorage` devolve null quando o caminho do banco escapa
      // da raiz de upload; a resposta vira 404 sem abrir arquivo nenhum.
      caminhoAbsoluto: resolverCaminhoStorage(arquivo.caminho),
      nomeArquivo: arquivo.nome,
      mimeType: arquivo.mimeType,
      apenasCabecalhos,
      mensagemAusente: "Arquivo de áudio não encontrado no armazenamento.",
    });
  });
}

export async function GET(request, { params }) {
  return servir(request, params, false);
}

// Alguns players sondam com HEAD antes de pedir a primeira faixa.
export async function HEAD(request, { params }) {
  return servir(request, params, true);
}
