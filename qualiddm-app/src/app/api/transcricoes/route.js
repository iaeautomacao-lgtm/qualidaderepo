import { created, ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import {
  readDateParam,
  readEnumParam,
  readIdParam,
  readPaginacao,
  readSearchParam,
} from "@/server/validation";
import { badRequest } from "@/server/errors";
import { FILTRO_STATUS, ORIGENS, listarGravacoes } from "@/server/repositories/transcricoes";
import { receberGravacoes } from "@/server/services/transcricao-service";

export async function GET(request) {
  return route(request, async () => {
    await requireSession();

    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = readPaginacao(searchParams, { padrao: 50, max: 200 });

    const origem = readEnumParam(searchParams, "origem", [...ORIGENS, "todos"], "todos");

    const resultado = await listarGravacoes({
      filtros: {
        status: readEnumParam(searchParams, "status", FILTRO_STATUS, "todos"),
        origem: origem === "todos" ? null : origem,
        clienteId: readIdParam(searchParams, "clienteId"),
        campanhaId: readIdParam(searchParams, "campanhaId"),
        dataInicio: readDateParam(searchParams, "dataInicio"),
        dataFim: readDateParam(searchParams, "dataFim"),
        busca: readSearchParam(searchParams, "busca", 120),
      },
      limit,
      offset,
    });

    return ok(resultado);
  });
}

// Envio de gravações (bloco "Enviar gravações" da tela). multipart/form-data
// com `files` e, opcionalmente, `transcrever` (checkbox "Transcrever
// automaticamente"), `clienteId`, `campanhaId` e `avaliadoId`.
export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();

    const tipo = request.headers.get("content-type") || "";
    if (!tipo.includes("multipart/form-data")) {
      throw badRequest("Envie os arquivos como multipart/form-data.");
    }

    const formData = await request.formData();
    const files = formData.getAll("files");
    const arquivos = files.length > 0 ? files : formData.getAll("arquivos");

    const resultado = await receberGravacoes({
      files: arquivos,
      userId: session.user.id,
      transcreverAutomatico: lerBooleano(formData.get("transcrever"), true),
      clienteId: lerId(formData.get("clienteId"), "clienteId"),
      campanhaId: lerId(formData.get("campanhaId"), "campanhaId"),
      avaliadoId: lerId(formData.get("avaliadoId"), "avaliadoId"),
    });

    return created(resultado);
  });
}

function lerBooleano(valor, padrao) {
  if (valor == null || valor === "") return padrao;
  return ["1", "true", "on", "yes"].includes(String(valor).toLowerCase());
}

function lerId(valor, campo) {
  if (valor == null || valor === "") return null;
  const texto = String(valor);
  if (!/^\d{1,20}$/.test(texto) || texto === "0") {
    throw badRequest(`Campo ${campo} deve ser um identificador numérico.`);
  }
  return texto;
}
