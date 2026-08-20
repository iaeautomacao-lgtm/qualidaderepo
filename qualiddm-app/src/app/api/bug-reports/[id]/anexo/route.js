import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { badRequest } from "@/server/errors";
import { ok, route } from "@/server/http";
import { anexarBugReport } from "@/server/repositories/bug-reports";
import { requireRole } from "@/server/security/sessions";

const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS_ACEITOS = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const EXTENSOES_ACEITAS = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf"]);

function validarId(id) {
  if (!/^\d{1,20}$/.test(String(id))) throw badRequest("Identificador invalido.");
  return String(id);
}

function nomeSeguro(nome) {
  const ext = path.extname(nome || "").toLowerCase();
  const base = path
    .basename(nome || "anexo", ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "anexo"}${ext || ".bin"}`;
}

export async function POST(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const reportId = validarId(id);

    const form = await request.formData().catch(() => null);
    if (!form) throw badRequest("Envie o anexo como multipart/form-data.");

    const arquivo = form.get("file") || form.get("anexo");
    if (!arquivo || typeof arquivo.arrayBuffer !== "function") {
      throw badRequest("Campo 'file' ausente.");
    }

    const extensao = path.extname(arquivo.name || "").toLowerCase();
    if (!TIPOS_ACEITOS.has(arquivo.type) && !EXTENSOES_ACEITAS.has(extensao)) {
      throw badRequest("Anexe PNG, JPG, WEBP ou PDF.");
    }
    if (arquivo.size > MAX_BYTES) {
      throw badRequest("O anexo deve ter no maximo 10 MB.");
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const pastaPublica = path.join(process.cwd(), "public", "uploads", "bug-reports");
    await mkdir(pastaPublica, { recursive: true });

    const arquivoNome = `bug-${reportId}-${Date.now()}-${nomeSeguro(arquivo.name)}`;
    const caminhoAbsoluto = path.join(pastaPublica, arquivoNome);
    await writeFile(caminhoAbsoluto, bytes);

    const caminhoPublico = `/uploads/bug-reports/${arquivoNome}`;
    return ok(await anexarBugReport(reportId, caminhoPublico));
  });
}
