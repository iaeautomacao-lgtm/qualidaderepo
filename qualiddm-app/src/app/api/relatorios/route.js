import { ok, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { badRequest, forbidden } from "@/server/errors";
import { parseJsonObject, readString } from "@/server/validation";
import {
  FORMATOS,
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  definicaoRelatorio,
  executarRelatorio,
  listarTiposRelatorio,
} from "@/server/repositories/relatorios";

// Papéis que podem puxar a base inteira sem filtro ("Carregar tudo (sem
// filtros)" do print). O catálogo de permissões já está no banco
// (relatorio.relatorio.carregar_tudo); enquanto a checagem por permissão não
// estiver ligada nas rotas, o guard é por papel.
const PODEM_CARREGAR_TUDO = ["administrador", "supervisor"];

/** Catálogo da coluna esquerda da tela, com a estrela do usuário logado. */
export async function GET(request) {
  return route(request, async () => {
    const session = await requireSession();
    return ok({ tipos: await listarTiposRelatorio(session.user.id) });
  });
}

/**
 * Executa um relatório.
 *
 * POST e não GET porque o conjunto de filtros é um objeto e a execução é
 * registrada em `relatorio_execucoes` — é uma ação com efeito, não uma leitura
 * cacheável de URL.
 */
export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();
    const corpo = parseJsonObject(await request.json().catch(() => null));

    const slug = readString(corpo, "slug", { max: 80 });
    const definicao = definicaoRelatorio(slug);
    if (!definicao) throw badRequest("Relatório desconhecido.");
    if (definicao.indisponivel === undefined && !definicao.sql) {
      throw badRequest("Relatório sem execução tabular.");
    }

    const formato = corpo.formato ? readString(corpo, "formato", { allowed: FORMATOS }) : "tela";
    const carregarTudo = corpo.carregarTudo === true;
    if (carregarTudo && !PODEM_CARREGAR_TUDO.includes(session.user.role)) {
      throw forbidden("Carregar a base inteira exige perfil de administrador ou supervisor.");
    }

    const limit = lerInteiro(corpo.limit, LIMITE_PADRAO, 1, LIMITE_MAXIMO, "limit");
    const offset = lerInteiro(corpo.offset, 0, 0, 1000000, "offset");

    const resultado = await executarRelatorio({
      slug,
      filtros: lerFiltros(corpo.filtros, definicao),
      limit,
      offset,
      carregarTudo,
      formato,
      userId: session.user.id,
    });

    return ok(resultado);
  });
}

// Só passam adiante as chaves que a definição do relatório declara. Chave
// desconhecida é erro explícito e não filtro ignorado em silêncio — um filtro
// digitado errado que "não faz nada" gera relatório errado sem ninguém notar.
function lerFiltros(filtros, definicao) {
  if (filtros == null) return {};
  const objeto = parseJsonObject(filtros);
  const aceitos = Object.keys(definicao.filtros || {});
  const saida = {};

  for (const [chave, valor] of Object.entries(objeto)) {
    if (valor == null || valor === "") continue;
    if (!aceitos.includes(chave)) {
      throw badRequest(`Filtro não suportado por este relatório: ${chave}.`, {
        filtrosAceitos: aceitos,
      });
    }
    const texto = String(valor).trim();
    if (texto.length > 120) throw badRequest(`Filtro ${chave} muito longo.`);
    if (chave === "dataInicio" || chave === "dataFim") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        throw badRequest(`Filtro ${chave} deve estar no formato AAAA-MM-DD.`);
      }
    }
    saida[chave] = texto;
  }

  return saida;
}

function lerInteiro(valor, padrao, min, max, campo) {
  if (valor == null || valor === "") return padrao;
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) throw badRequest(`Campo ${campo} deve ser numérico.`);
  if (numero < min) throw badRequest(`Campo ${campo} abaixo do mínimo (${min}).`);
  if (numero > max) throw badRequest(`Campo ${campo} acima do máximo (${max}).`);
  return numero;
}
