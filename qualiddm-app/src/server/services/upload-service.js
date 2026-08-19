import { config } from "../config";
import { badRequest } from "../errors";
import { mimeParaAnalise } from "./arquivo-storage";
import { mkdir, writeFile } from "fs/promises";
import { extname, isAbsolute, join, resolve } from "path";

function hasAllowedExtension(name) {
  const lowerName = name.toLowerCase();
  return config.upload.allowedExtensions.some((extension) => lowerName.endsWith(extension));
}

export function validateUploadFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw badRequest("Selecione ao menos um arquivo.");
  }

  return files.map((file) => {
    if (!file || typeof file.name !== "string") {
      throw badRequest("Arquivo inválido.");
    }
    if (file.size <= 0) {
      throw badRequest(`Arquivo vazio: ${file.name}.`);
    }
    if (file.size > config.upload.maxFileBytes) {
      throw badRequest(`Arquivo acima do limite permitido: ${file.name}.`);
    }
    const mimeAllowed = file.type && config.upload.allowedMimeTypes.includes(file.type);
    const extensionAllowed = hasAllowedExtension(file.name);

    if (!mimeAllowed && !extensionAllowed) {
      throw badRequest(`Tipo de arquivo não permitido: ${file.name}.`);
    }
    return {
      name: file.name.slice(0, 180),
      // Mime resolvido pela extensão quando o navegador declara algo que
      // contradiz o arquivo. Sem isto, um `.mpeg` de ligação chega à IA como
      // `video/mpeg` (ou `application/octet-stream`) e é recusado lá — o upload
      // aceitava e a análise falhava depois, o que é o pior lugar para falhar.
      type: mimeParaAnalise(file.name, file.type),
      size: file.size,
    };
  });
}

function safeBaseName(name) {
  const extension = extname(name).toLowerCase();
  const base = String(name || "arquivo")
    .slice(0, 140)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(extension, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "arquivo";

  return { base, extension };
}

function storageRoot() {
  return isAbsolute(config.upload.storageDir)
    ? config.upload.storageDir
    : resolve(/* turbopackIgnore: true */ process.cwd(), config.upload.storageDir);
}

export async function saveUploadFile({ file, bytes, prefix = "avaliacao" }) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const folderRelative = join(/* turbopackIgnore: true */ prefix, year, month, day);
  const folderAbsolute = join(/* turbopackIgnore: true */ storageRoot(), folderRelative);
  await mkdir(folderAbsolute, { recursive: true });

  const { base, extension } = safeBaseName(file.name);
  const stamp = `${now.toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${stamp}-${base}${extension}`;
  const absolutePath = join(folderAbsolute, fileName);
  await writeFile(absolutePath, bytes);

  return {
    nome: file.name,
    mimeType: file.type || "application/octet-stream",
    tamanho: bytes.length,
    storagePath: join(folderRelative, fileName).replace(/\\/g, "/"),
  };
}
