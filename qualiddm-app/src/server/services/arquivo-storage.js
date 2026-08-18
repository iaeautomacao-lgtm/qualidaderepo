import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { extname, isAbsolute, resolve, sep } from "path";
import { config } from "../config";
import { notFound } from "../errors";

/**
 * Leitura dos arquivos que o upload guardou.
 *
 * Duas responsabilidades, as duas sobre a mesma regra: o cliente nunca escolhe
 * um caminho de arquivo. O que vem do banco é tratado como suspeito, porque uma
 * linha de `gravacoes.storage_path` pode ter sido escrita por importação antiga
 * ou por um bug — e um `../../..` ali dentro leria o filesystem do servidor.
 */

// `Content-Type` importa aqui mais do que numa página: com
// `application/octet-stream` o <audio> do Chrome nem tenta tocar. O upload
// guarda o mime que o navegador declarou, que às vezes é vazio ou genérico,
// então a extensão é o desempate.
const MIME_POR_EXTENSAO = {
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".mpga": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const MIME_GENERICOS = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function raizStorage() {
  return isAbsolute(config.upload.storageDir)
    ? resolve(config.upload.storageDir)
    : resolve(/* turbopackIgnore: true */ process.cwd(), config.upload.storageDir);
}

/**
 * Resolve um caminho relativo do banco para caminho absoluto DENTRO da raiz de
 * upload. Devolve null quando o resultado escapa da raiz — quem chama responde
 * 404 sem tocar no disco, então nem confirma se o alvo existe.
 */
export function resolverCaminhoStorage(caminhoRelativo) {
  const bruto = String(caminhoRelativo || "").trim();
  if (!bruto) return null;
  // Byte nulo trunca o caminho em algumas camadas nativas: um
  // "audio.mp3\0../../etc/passwd" passaria pela checagem de prefixo abaixo e
  // seria aberto como outro arquivo.
  if (bruto.includes("\0")) return null;

  const raiz = raizStorage();
  // `resolve` normaliza `..` ANTES da comparação; caminho absoluto vindo do
  // banco sobrescreve a raiz e cai na checagem de prefixo logo abaixo.
  const absoluto = resolve(raiz, bruto);

  if (absoluto !== raiz && !absoluto.startsWith(raiz + sep)) return null;
  return absoluto;
}

/**
 * O arquivo apontado pelo banco existe de fato no armazenamento?
 *
 * Serve para a ficha decidir se oferece player: `audio_path` gravado não
 * garante arquivo em disco (o storage pode ser outro entre ambientes), e um
 * player que não toca é pior que ficha sem player.
 */
export async function arquivoExiste(caminhoRelativo) {
  const absoluto = resolverCaminhoStorage(caminhoRelativo);
  if (!absoluto) return false;
  try {
    return (await stat(/* turbopackIgnore: true */ absoluto)).isFile();
  } catch {
    return false;
  }
}

export function mimeDoArquivo(nomeArquivo, mimeSalvo) {
  const declarado = String(mimeSalvo || "").trim().toLowerCase();
  if (declarado && !MIME_GENERICOS.has(declarado)) return declarado;
  return MIME_POR_EXTENSAO[extname(String(nomeArquivo || "")).toLowerCase()] || "application/octet-stream";
}

// Nome de arquivo entra num header HTTP: aspas e quebra de linha ali dentro
// permitiriam injetar outro header. A versão ASCII é o fallback; a versão
// RFC 5987 preserva a acentuação para quem entende.
function contentDisposition(nomeArquivo, anexar) {
  const disposicao = anexar ? "attachment" : "inline";
  const nome = String(nomeArquivo || "arquivo").replace(/[\r\n"\\]/g, "").slice(0, 180) || "arquivo";
  const ascii = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\x20-\x7E]/g, "_");
  return `${disposicao}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/**
 * `bytes=inicio-fim`, `bytes=inicio-` e `bytes=-ultimos`.
 *
 * Devolve `null` quando não há Range utilizável (aí a resposta é 200 com o
 * arquivo inteiro) e `"invalido"` quando o Range existe mas não cabe no arquivo
 * (aí é 416). Range com múltiplas faixas é tratado como ausente: responder
 * multipart/byteranges seria muito mais código para um caso que o <audio> não
 * usa.
 */
function faixaSolicitada(header, tamanho) {
  if (!header) return null;
  const bruto = String(header).trim();
  if (!bruto.toLowerCase().startsWith("bytes=")) return null;

  const faixas = bruto.slice(6).split(",");
  if (faixas.length !== 1) return null;

  const casamento = /^(\d*)-(\d*)$/.exec(faixas[0].trim());
  if (!casamento) return "invalido";

  const [, textoInicio, textoFim] = casamento;
  if (textoInicio === "" && textoFim === "") return "invalido";

  if (textoInicio === "") {
    const ultimos = Number(textoFim);
    if (!Number.isFinite(ultimos) || ultimos <= 0) return "invalido";
    return { inicio: Math.max(0, tamanho - ultimos), fim: tamanho - 1 };
  }

  const inicio = Number(textoInicio);
  if (!Number.isFinite(inicio) || inicio >= tamanho) return "invalido";
  const fim = textoFim === "" ? tamanho - 1 : Math.min(Number(textoFim), tamanho - 1);
  if (!Number.isFinite(fim) || fim < inicio) return "invalido";
  return { inicio, fim };
}

/**
 * Resposta de arquivo com suporte a Range.
 *
 * Stream, não `readFile`: um áudio de 50 MB lido inteiro na memória por
 * requisição derruba o processo com meia dúzia de players abertos.
 */
export async function respostaArquivo(
  request,
  { caminhoAbsoluto, nomeArquivo, mimeType = null, anexar = false, apenasCabecalhos = false, mensagemAusente },
) {
  if (!caminhoAbsoluto) throw notFound(mensagemAusente || "Arquivo não encontrado.");

  let info;
  try {
    info = await stat(caminhoAbsoluto);
  } catch {
    throw notFound(mensagemAusente || "Arquivo não encontrado no armazenamento.");
  }
  if (!info.isFile()) throw notFound(mensagemAusente || "Arquivo não encontrado no armazenamento.");

  const tamanho = info.size;
  const cabecalhos = new Headers({
    "content-type": mimeDoArquivo(nomeArquivo, mimeType),
    "content-disposition": contentDisposition(nomeArquivo, anexar),
    "accept-ranges": "bytes",
    // Gravação de atendimento não pode ficar em cache compartilhado: a URL é
    // autenticada por sessão, o arquivo não.
    "cache-control": "private, max-age=0, must-revalidate",
    "x-content-type-options": "nosniff",
  });

  const faixa = faixaSolicitada(request.headers.get("range"), tamanho);

  if (faixa === "invalido") {
    cabecalhos.set("content-range", `bytes */${tamanho}`);
    return new Response(null, { status: 416, headers: cabecalhos });
  }

  const inicio = faixa ? faixa.inicio : 0;
  const fim = faixa ? faixa.fim : tamanho - 1;
  const bytes = tamanho === 0 ? 0 : fim - inicio + 1;

  cabecalhos.set("content-length", String(bytes));
  if (faixa) cabecalhos.set("content-range", `bytes ${inicio}-${fim}/${tamanho}`);

  if (apenasCabecalhos || tamanho === 0) {
    return new Response(null, { status: faixa ? 206 : 200, headers: cabecalhos });
  }

  const leitura = createReadStream(caminhoAbsoluto, { start: inicio, end: fim });
  return new Response(Readable.toWeb(leitura), { status: faixa ? 206 : 200, headers: cabecalhos });
}
