import { readFile } from "fs/promises";
import { badRequest, conflict, notFound } from "../errors";
import { one, query } from "../db";
import { resolverCaminhoStorage } from "./arquivo-storage";
import { avaliarArquivo } from "./avaliacao-ia";
import { createAvaliacaoFromIa, getFormularioParaAvaliacaoIa } from "../repositories/catalog";

/**
 * Converte uma análise IA livre em MONITORIA com formulário.
 *
 * Por que isto existe: a análise livre (`MIA-…`) não tem linha em `avaliacoes`, e
 * feedback e contestação são ancorados em ficha. Sem a conversão, os botões
 * "Aplicar feedback" e "Criar contestação" não têm o que abrir.
 *
 * O que a conversão faz: reprocessa o MESMO arquivo contra os critérios do
 * formulário escolhido e grava uma ficha de verdade. Não é cópia da análise
 * livre — os critérios são outros, então a nota é outra. Reaproveitar os status
 * da análise genérica e chamar de "avaliação pelo formulário X" seria apresentar
 * uma nota que aquele formulário nunca produziu.
 */

/**
 * Formulários que podem avaliar esta gravação.
 *
 * Só os do cliente da gravação: formulário é régua de carteira, e oferecer o de
 * outra carteira produz nota que ninguém sabe interpretar. Gravação sem cliente
 * não tem candidato — e a tela diz isso em vez de listar tudo.
 */
export async function formulariosCompativeis(gravacaoId) {
  const gravacao = await one(
    `SELECT g.id, g.cliente_id, g.campanha_id, g.avaliado_id, g.avaliacao_id,
            cl.nome AS cliente, a.codigo AS avaliacao_codigo
       FROM gravacoes g
       LEFT JOIN clientes cl ON cl.id = g.cliente_id
       LEFT JOIN avaliacoes a ON a.id = g.avaliacao_id
      WHERE g.id = :gravacaoId
      LIMIT 1`,
    { gravacaoId },
  );

  if (!gravacao) throw notFound("Gravação não encontrada.");

  const base = {
    clienteId: gravacao.cliente_id == null ? null : String(gravacao.cliente_id),
    cliente: gravacao.cliente || null,
    avaliadoId: gravacao.avaliado_id == null ? null : String(gravacao.avaliado_id),
    // Já convertida? A tela mostra os botões apontando para a ficha em vez de
    // oferecer a conversão outra vez.
    fichaCodigo: gravacao.avaliacao_codigo || null,
  };

  if (!gravacao.cliente_id) return { ...base, formularios: [] };

  const rows = await query(
    `SELECT f.id, f.nome, f.categoria, ca.nome AS campanha,
            COUNT(DISTINCT cr.id) AS criterios
       FROM formularios f
       LEFT JOIN formulario_campanhas fc ON fc.formulario_id = f.id
       LEFT JOIN campanhas ca ON ca.id = fc.campanha_id
       LEFT JOIN formulario_secoes s ON s.formulario_id = f.id
       LEFT JOIN formulario_criterios cr ON cr.secao_id = s.id
      WHERE f.cliente_id = :clienteId
        AND f.status = 'ativo'
      GROUP BY f.id, f.nome, f.categoria, ca.nome
      HAVING criterios > 0
      ORDER BY f.updated_at DESC, f.nome`,
    { clienteId: gravacao.cliente_id },
  );

  return {
    ...base,
    formularios: rows.map((row) => ({
      id: String(row.id),
      nome: row.nome,
      categoria: row.categoria,
      campanha: row.campanha || null,
      criterios: Number(row.criterios ?? 0),
    })),
  };
}

/**
 * Gera a ficha e a vincula à gravação.
 *
 * `avaliadoId` é obrigatório quando a gravação não sabe quem foi avaliado. Ficha
 * atribuída a pessoa errada entra na média dela e vira feedback sobre atendimento
 * que ela não fez — é pior que ficha nenhuma, e por isso não há palpite aqui.
 */
export async function gerarFichaDaAnalise({ gravacaoId, formularioId, avaliadoId, avaliadorId }) {
  const gravacao = await one(
    `SELECT id, nome_arquivo, storage_path, mime_type, tamanho_bytes,
            cliente_id, avaliado_id, avaliacao_id
       FROM gravacoes
      WHERE id = :gravacaoId
      LIMIT 1`,
    { gravacaoId },
  );

  if (!gravacao) throw notFound("Gravação não encontrada.");

  if (gravacao.avaliacao_id) {
    const ficha = await one("SELECT codigo FROM avaliacoes WHERE id = :id LIMIT 1", {
      id: gravacao.avaliacao_id,
    });
    throw conflict(
      `Esta gravação já virou a monitoria ${ficha?.codigo ?? gravacao.avaliacao_id}. Abra a ficha para aplicar feedback.`,
    );
  }

  if (!gravacao.storage_path) {
    throw conflict(
      "O arquivo original não está mais no armazenamento desta gravação, e a ficha precisa dele para ser avaliada pelos critérios do formulário.",
    );
  }

  const alvo = avaliadoId || gravacao.avaliado_id;
  if (!alvo) {
    throw badRequest(
      "Informe quem foi avaliado. A gravação subiu sem operador vinculado, e ficha atribuída à pessoa errada entra na média dela.",
    );
  }

  const pessoa = await one("SELECT id FROM users WHERE id = :id LIMIT 1", { id: alvo });
  if (!pessoa) throw badRequest("Avaliado não encontrado.");

  const formulario = await getFormularioParaAvaliacaoIa({ formularioId });
  if (!formulario || formulario.secoes.length === 0) {
    throw conflict("O formulário escolhido não está ativo ou não tem critérios para avaliar.");
  }
  // O formulário tem de ser da carteira da gravação: régua de outra carteira
  // produz nota que ninguém sabe interpretar.
  if (
    gravacao.cliente_id &&
    formulario.cliente_id &&
    String(formulario.cliente_id) !== String(gravacao.cliente_id)
  ) {
    throw badRequest("O formulário escolhido pertence a outra carteira.");
  }

  let bytes;
  try {
    bytes = await readFile(resolverCaminhoStorage(gravacao.storage_path));
  } catch {
    throw conflict(
      "Não foi possível ler o arquivo original desta gravação no armazenamento do servidor.",
    );
  }

  const resultado = await avaliarArquivo({
    nome: gravacao.nome_arquivo,
    mimeType: gravacao.mime_type || "application/octet-stream",
    base64: bytes.toString("base64"),
    tamanho: Number(gravacao.tamanho_bytes ?? bytes.length),
    secoes: formulario.secoes,
    contexto: {
      cliente: formulario.cliente,
      campanha: formulario.campanha,
      formulario: formulario.nome,
    },
  });

  const registro = await createAvaliacaoFromIa({
    formulario,
    resultado,
    arquivo: {
      nome: gravacao.nome_arquivo,
      mimeType: gravacao.mime_type,
      tamanho: Number(gravacao.tamanho_bytes ?? bytes.length),
      storagePath: gravacao.storage_path,
    },
    avaliadorId,
    avaliadoId: alvo,
    gravacaoId: gravacao.id,
  });

  // Vínculo nos dois sentidos. Depois deste UPDATE a gravação sai da lista de
  // análises livres em Avaliações: ela virou monitoria e é por ali que se lê.
  await query("UPDATE gravacoes SET avaliacao_id = :avaliacaoId WHERE id = :gravacaoId", {
    avaliacaoId: registro.avaliacaoId,
    gravacaoId: gravacao.id,
  });

  return {
    codigo: registro.codigo,
    formulario: formulario.nome,
    score: resultado.resumo.score,
    zerada: Boolean(resultado.resumo.zerada),
    href: `/avaliacoes/${registro.codigo}`,
    hrefFeedback: `/feedback/${registro.codigo}`,
    hrefContestacao: `/contestacoes/${registro.codigo}`,
  };
}
