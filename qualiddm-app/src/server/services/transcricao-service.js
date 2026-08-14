import { createHash } from "crypto";
import { badRequest } from "../errors";
import { validateUploadFiles } from "./upload-service";
import { registrarGravacoes } from "../repositories/transcricoes";

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

    arquivos.push({
      nome: meta.name,
      mimeType: meta.type,
      tamanho: meta.size,
      hash: createHash("sha256").update(conteudo).digest("hex"),
      // Duração só sai da decodificação do áudio, que não é feita aqui; o
      // transcritor preenche quando processa.
      duracaoSegundos: null,
      // A gravação física ainda não é persistida em disco/objeto — o mesmo
      // ponto pendente do upload de áudio existente. Quando o storage entrar,
      // é este campo que recebe o caminho.
      storagePath: null,
    });
  }

  const registradas = await registrarGravacoes({
    arquivos,
    userId,
    transcreverAutomatico,
    clienteId,
    campanhaId,
    avaliadoId,
  });

  return {
    recebidas: registradas.filter((item) => !item.duplicada).length,
    duplicadas: registradas.filter((item) => item.duplicada).length,
    gravacoes: registradas,
    armazenamento: "metadados-no-mysql-arquivo-pendente",
  };
}
