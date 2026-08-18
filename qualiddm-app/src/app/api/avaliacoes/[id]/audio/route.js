import { route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { assertSafeId } from "@/server/validation";
import { obterArquivoAvaliacao } from "@/server/repositories/avaliacoes";
import { resolverCaminhoStorage, respostaArquivo } from "@/server/services/arquivo-storage";

// Áudio da monitoria. `[id]` é o CÓDIGO da avaliação (QA-26-000688): o segmento
// dinâmico herda o nome da rota irmã `/api/avaliacoes/[id]`, porque o Next não
// aceita dois nomes diferentes de parâmetro no mesmo nível de pasta.
async function servir(request, params, apenasCabecalhos) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    const arquivo = await obterArquivoAvaliacao(assertSafeId(id, "codigo"));

    return respostaArquivo(request, {
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

export async function HEAD(request, { params }) {
  return servir(request, params, true);
}
