import { config } from "../config";
import { badRequest } from "../errors";

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
      type: file.type || "application/octet-stream",
      size: file.size,
    };
  });
}
