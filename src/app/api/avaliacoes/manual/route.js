import { badRequest } from "@/server/errors";
import { ipDaRequisicao, ok, route } from "@/server/http";
import { requireRole } from "@/server/security/sessions";
import { createAvaliacaoManual } from "@/server/repositories/catalog";
import { obterAvaliacao } from "@/server/repositories/avaliacoes";
import { registrarAuditoria } from "@/server/repositories/administracao";
import { parseJsonObject, readString } from "@/server/validation";
import { query } from "@/server/db";
import { receberGravacoes } from "@/server/services/transcricao-service";

function idObrigatorio(corpo, campo) {
  const valor = String(corpo?.[campo] || "").trim();
  if (!/^\d{1,20}$/.test(valor) || valor === "0") {
    throw badRequest(`Campo ${campo} invalido.`);
  }
  return valor;
}

function idOpcional(corpo, campo) {
  const valor = String(corpo?.[campo] || "").trim();
  if (!valor) return null;
  if (!/^\d{1,20}$/.test(valor) || valor === "0") {
    throw badRequest(`Campo ${campo} invalido.`);
  }
  return valor;
}

export async function POST(request) {
  return route(request, async () => {
    const session = await requireRole(["administrador", "supervisor", "monitor"]);
    const tipo = request.headers.get("content-type") || "";
    const multipart = tipo.includes("multipart/form-data");
    const formData = multipart ? await request.formData() : null;
    const corpo = multipart
      ? parseJsonObject(JSON.parse(String(formData.get("payload") || "{}")))
      : parseJsonObject(await request.json().catch(() => null));

    const resultado = await createAvaliacaoManual({
      formularioId: idObrigatorio(corpo, "formularioId"),
      campanhaId: idOpcional(corpo, "campanhaId"),
      avaliadoId: idObrigatorio(corpo, "avaliadoId"),
      superiorId: idOpcional(corpo, "superiorId"),
      avaliadorId: session.user.id,
      codGravacao: readString(corpo, "codGravacao", { required: false, max: 60 }),
      dataContato: readString(corpo, "dataContato", { required: false, max: 16 }),
      respostas: Array.isArray(corpo.respostas) ? corpo.respostas : [],
    });

    if (multipart) {
      const arquivos = formData.getAll("files").filter((arquivo) => arquivo && typeof arquivo.arrayBuffer === "function");
      const textoAtendimento = readString(
        { textoAtendimento: formData.get("textoAtendimento") || corpo.textoAtendimento },
        "textoAtendimento",
        { required: false, max: 20000 },
      );

      if (textoAtendimento) {
        arquivos.push(
          new File([textoAtendimento], `${resultado.codigo}-conversa.txt`, {
            type: "text/plain",
          }),
        );
      }

      if (arquivos.length > 0) {
        const anexos = await receberGravacoes({
          files: arquivos,
          userId: session.user.id,
          transcreverAutomatico: false,
          clienteId: resultado.clienteId,
          campanhaId: resultado.campanhaId,
          avaliadoId: idObrigatorio(corpo, "avaliadoId"),
          canal: null,
          contexto: {
            codigo: resultado.codigo,
            origem: "monitoria_manual",
          },
        });

        const ids = anexos.gravacoes.map((gravacao) => gravacao.id).filter(Boolean);
        for (const gravacaoId of ids) {
          await query(
            `UPDATE gravacoes
                SET avaliacao_id = :avaliacaoId
              WHERE id = :gravacaoId
                AND (avaliacao_id IS NULL OR avaliacao_id = 0)`,
            { avaliacaoId: resultado.avaliacaoId, gravacaoId },
          );
        }
      }
    }

    await registrarAuditoria({
      userId: session.user.id,
      acao: "avaliacao_manual_criada",
      modulo: "formularios",
      entidade: "avaliacoes",
      entidadeId: resultado.codigo,
      detalhe: `score=${resultado.score ?? "N/A"}`,
      ip: ipDaRequisicao(request),
      userAgent: request.headers.get("user-agent"),
    });

    return ok({ avaliacao: await obterAvaliacao(resultado.codigo, { user: session.user }) });
  });
}
