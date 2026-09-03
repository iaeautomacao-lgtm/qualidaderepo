import { createHash } from "crypto";
import { badRequest } from "../errors";
import { saveUploadFile, validateUploadFiles } from "./upload-service";
import { analisarArquivoLivreEstruturado } from "./avaliacao-ia";
import {
  concluirAnaliseGravacao,
  precisaAnaliseEstruturada,
  registrarErroAnaliseGravacao,
  registrarGravacoes,
} from "../repositories/transcricoes";

// Teto de arquivos por requisição. Cada arquivo é lido inteiro na memória para
// o SHA-256, e o limite por arquivo já é de 50 MB (UPLOAD_MAX_FILE_BYTES):
// sem esse teto, um envio de 100 áudios estoura a memória do processo.
export const MAX_ARQUIVOS_POR_ENVIO = 20;

/**
 * Recebe as gravações da tela Transcrições.
 *
 * O SHA-256 é calculado aqui e vira a chave de idempotência da gravação:
 * reenviar o mesmo áudio devolve a linha existente em vez de duplicar o
 * registro e gastar transcrição de novo.
 */
export async function receberGravacoes({
  files,
  userId,
  transcreverAutomatico = true,
  clienteId = null,
  campanhaId = null,
  avaliadoId = null,
  // Canal declarado na tela de upload: "chat" ou "telefone".
  canal = null,
  contexto = {},
}) {
  if (Array.isArray(files) && files.length > MAX_ARQUIVOS_POR_ENVIO) {
    throw badRequest(`Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  }

  // Valida tipo, extensão e tamanho com as mesmas regras do upload de áudio
  // que já existia (config.upload.*).
  const validados = validateUploadFiles(files);

  const arquivos = [];
  for (let indice = 0; indice < validados.length; indice += 1) {
    const meta = validados[indice];
    const original = files[indice];
    const conteudo = Buffer.from(await original.arrayBuffer());
    const arquivoSalvo = await saveUploadFile({ file: original, bytes: conteudo });

    arquivos.push({
      nome: meta.name,
      mimeType: meta.type,
      tamanho: meta.size,
      hash: createHash("sha256").update(conteudo).digest("hex"),
      base64: conteudo.toString("base64"),
      // Duração só sai da decodificação do áudio, que não é feita aqui; o
      // transcritor preenche quando processa.
      duracaoSegundos: null,
      // Caminho físico persistido para consulta e reprocessamento posterior.
      storagePath: arquivoSalvo.storagePath,
    });
  }

  const registradas = await registrarGravacoes({
    arquivos,
    userId,
    transcreverAutomatico,
    clienteId,
    campanhaId,
    avaliadoId,
    canal,
  });

  if (transcreverAutomatico) {
    for (const registrada of registradas) {
      if (registrada.duplicada) {
        const deveReprocessar = await precisaAnaliseEstruturada(registrada.id);
        if (!deveReprocessar) continue;
      }

      const arquivo = arquivos.find((item) => item.nome === registrada.arquivo);
      if (!arquivo) continue;

      try {
        const analise = await analisarArquivoLivreEstruturado({
          nome: arquivo.nome,
          mimeType: arquivo.mimeType || "application/octet-stream",
          base64: arquivo.base64,
          tamanho: arquivo.tamanho,
          // `sequencia` é o id da gravação: o código MIA-AAAAMMDD-NNNN da
          // análise precisa ser o mesmo em toda leitura posterior, e o id é o
          // único número estável disponível aqui.
          contexto: { ...contexto, sequencia: registrada.id },
        });

        await concluirAnaliseGravacao({
          gravacaoId: registrada.id,
          texto: analise.texto,
          modelo: analise.modelo,
          confianca: analise.confianca,
          segmentosJson: JSON.stringify({
            ...analise.bruto,
            arquivo: {
              nome: arquivo.nome,
              mimeType: arquivo.mimeType || "application/octet-stream",
              tamanho: arquivo.tamanho,
            },
            modelo: analise.modelo,
            geradoEm: analise.geradoEm,
          }),
        });
        registrada.status = "concluida";
      } catch (error) {
        registrada.erro = error instanceof Error ? error.message : "Erro ao analisar arquivo.";
        await registrarErroAnaliseGravacao({
          gravacaoId: registrada.id,
          erro: registrada.erro,
        });
        registrada.status = "erro";
      }
    }
  }

  const erros = registradas.filter((item) => item.status === "erro").length;

  return {
    recebidas: registradas.filter((item) => !item.duplicada).length,
    duplicadas: registradas.filter((item) => item.duplicada).length,
    erros,
    gravacoes: registradas,
    armazenamento: "arquivo-e-metadados",
  };
}
