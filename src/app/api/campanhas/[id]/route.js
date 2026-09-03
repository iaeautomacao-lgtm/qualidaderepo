import { ok, route } from "@/server/http";
import { requireRole, requireSession } from "@/server/security/sessions";
import { badRequest } from "@/server/errors";
import { parseJsonObject, readIntParam, readString } from "@/server/validation";
import {
  CANAIS,
  atualizarCampanha,
  excluirCampanha,
  obterCampanha,
  salvarConfiguracaoCampanha,
} from "@/server/repositories/gestao";

const CANAIS_ACEITOS = CANAIS.map((canal) => canal.id);

function idValido(id) {
  if (!/^\d{1,20}$/.test(id) || id === "0") throw badRequest("Identificador de campanha inválido.");
  return id;
}

/** Meta de nota do print: 0 a 100, com casa decimal. Vazio apaga a meta. */
function metaValida(valor) {
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    throw badRequest("Meta de nota deve ser um número de 0 a 100.");
  }
  return Math.round(numero * 100) / 100;
}

// Tela "Gerenciar — {campanha}": cadastro, configuração, desempenho e pessoas.
export async function GET(request, { params }) {
  return route(request, async () => {
    await requireSession();
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const periodoDias = readIntParam(searchParams, "periodoDias", {
      default: 31,
      min: 1,
      max: 365,
    });
    return ok(await obterCampanha(idValido(id), { periodoDias }));
  });
}

/**
 * Duas escritas na mesma rota, separadas pelo corpo.
 *
 * `{ configuracao: true }` salva o bloco "Faixa de Performance e Metas"; sem
 * isso, o corpo é o cadastro (nome, canal, situação). Separar importa porque a
 * tela de configuração não mostra o nome — mandá-lo junto obrigaria a enviar um
 * valor que ela não tem, e um envio incompleto renomearia a campanha.
 */
export async function PATCH(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    const campanhaId = idValido(id);
    const corpo = parseJsonObject(await request.json().catch(() => null));

    if (corpo.configuracao === true) {
      return ok(
        await salvarConfiguracaoCampanha(campanhaId, {
          faixaConjuntoId: corpo.faixaConjuntoId ? String(corpo.faixaConjuntoId) : null,
          // `undefined` = campo não enviado; `null` = meta apagada de propósito.
          // Os dois casos são diferentes: o primeiro não mexe na coluna.
          metaScore: corpo.metaScore === undefined ? undefined : metaValida(corpo.metaScore),
        }),
      );
    }

    return ok({
      campanha: await atualizarCampanha(campanhaId, {
        nome: readString(corpo, "nome", { min: 2, max: 160 }),
        canal: readString(corpo, "canal", { required: false, default: "telefone", allowed: CANAIS_ACEITOS }),
        ativa: corpo.ativa !== false,
      }),
    });
  });
}

export async function DELETE(request, { params }) {
  return route(request, async () => {
    await requireRole(["administrador", "supervisor"]);
    const { id } = await params;
    return ok({ resultado: await excluirCampanha(idValido(id)) });
  });
}
