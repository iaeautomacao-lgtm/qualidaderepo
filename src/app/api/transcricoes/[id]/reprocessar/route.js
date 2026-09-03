import { readFile } from "fs/promises";
import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { badRequest, notFound } from "@/server/errors";
import {
  concluirAnaliseGravacao,
  obterArquivoGravacao,
  obterTranscricao,
} from "@/server/repositories/transcricoes";
import { mimeDoArquivo, resolverCaminhoStorage } from "@/server/services/arquivo-storage";
import { analisarArquivoLivreEstruturado } from "@/server/services/avaliacao-ia";

function validarId(id) {
  if (!/^\d{1,20}$/.test(String(id || "")) || String(id) === "0") {
    throw badRequest("Identificador de gravacao invalido.");
  }
  return String(id);
}

export async function POST(request, { params }) {
  return route(request, async () => {
    await requireSession();

    const { id } = await params;
    const gravacaoId = validarId(id);
    const gravacao = await obterTranscricao(gravacaoId);
    const arquivo = await obterArquivoGravacao(gravacaoId);
    const caminho = resolverCaminhoStorage(arquivo.caminho);

    if (!caminho) {
      throw notFound("Arquivo original nao esta disponivel para reprocessamento.");
    }

    let conteudo;
    try {
      conteudo = await readFile(caminho);
    } catch {
      throw notFound("Arquivo original nao foi encontrado no armazenamento. Reenvie pelo Upload.");
    }

    const analise = await analisarArquivoLivreEstruturado({
      nome: arquivo.nome,
      mimeType: mimeDoArquivo(arquivo.nome, arquivo.mimeType),
      base64: conteudo.toString("base64"),
      tamanho: conteudo.length,
      contexto: {
        cliente: gravacao.cliente,
        campanha: gravacao.campanha,
        duracaoSegundos: gravacao.duracaoSegundos,
        sequencia: gravacaoId,
      },
    });

    await concluirAnaliseGravacao({
      gravacaoId,
      texto: analise.texto,
      modelo: analise.modelo,
      confianca: analise.confianca,
      segmentosJson: JSON.stringify({
        ...analise.bruto,
        arquivo: {
          nome: arquivo.nome,
          mimeType: mimeDoArquivo(arquivo.nome, arquivo.mimeType),
          tamanho: conteudo.length,
        },
        modelo: analise.modelo,
        geradoEm: analise.geradoEm,
      }),
    });

    return ok({ gravacao: await obterTranscricao(gravacaoId) });
  });
}
