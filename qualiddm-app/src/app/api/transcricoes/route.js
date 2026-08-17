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
import { one } from "@/server/db";
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
    const clienteId = await resolverClienteId(formData.get("clienteId"), formData.get("clienteNome"));
    const campanhaId = await resolverCampanhaId(formData.get("campanhaId"), formData.get("campanhaNome"), clienteId);

    const resultado = await receberGravacoes({
      files: arquivos,
      userId: session.user.id,
      transcreverAutomatico: lerBooleano(formData.get("transcrever"), true),
      clienteId,
      campanhaId,
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

function texto(valor) {
  return String(valor || "").trim();
}

function idNumerico(valor) {
  const id = texto(valor);
  return /^\d{1,20}$/.test(id) && id !== "0" ? id : null;
}

async function resolverClienteId(valor, nome) {
  const numerico = idNumerico(valor);
  if (numerico) return numerico;

  const referencia = texto(valor);
  const nomeCliente = texto(nome);
  if (!referencia && !nomeCliente) return null;

  const cliente = await one(
    `SELECT id
       FROM clientes
      WHERE slug IN (:referencia, :nomeCliente)
         OR nome IN (:referencia, :nomeCliente)
      LIMIT 1`,
    { referencia, nomeCliente },
  );

  if (!cliente) {
    throw badRequest("Carteira selecionada nao foi encontrada no banco.");
  }

  return String(cliente.id);
}

async function resolverCampanhaId(valor, nome, clienteId) {
  const numerico = idNumerico(valor);
  if (numerico) return numerico;

  const referencia = texto(valor);
  const nomeCampanha = texto(nome);
  if (!referencia && !nomeCampanha) return null;

  const campanha = await one(
    `SELECT id
       FROM campanhas
      WHERE (nome IN (:referencia, :nomeCampanha))
        AND (:clienteId IS NULL OR cliente_id = :clienteId OR cliente_id IS NULL)
      ORDER BY cliente_id = :clienteId DESC, id
      LIMIT 1`,
    { referencia, nomeCampanha, clienteId },
  );

  return campanha ? String(campanha.id) : null;
}
