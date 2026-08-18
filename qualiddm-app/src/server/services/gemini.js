import { config, isProduction } from "../config";
import { conflict } from "../errors";

/**
 * Cliente mínimo da API do Gemini — só o que o QualiDDM usa.
 *
 * REST direto em vez de SDK: a única chamada que fazemos é `generateContent`,
 * e um SDK inteiro só para isso traria dependência transitiva sem ganho.
 *
 * A chave NUNCA sai do servidor. Este módulo só é importável por route
 * handlers; se algum dia for importado por componente cliente, o build quebra
 * (`process.env.GEMINI_API_KEY` não existe no bundle do navegador) — o que é o
 * comportamento desejado.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function assertConfigured() {
  if (!config.ai.geminiApiKey) {
    throw conflict(
      "Integração de IA não configurada. Defina GEMINI_API_KEY no ambiente do servidor."
    );
  }
}

/**
 * Turnos anteriores de uma conversa, no formato que a API espera.
 *
 * Histórico vai como TURNO, não colado dentro do prompt: assim o modelo
 * distingue o que ele mesmo já respondeu do que o usuário perguntou, e o texto
 * do usuário não pode se passar por instrução do sistema. Papel desconhecido é
 * descartado em vez de virar "user" por omissão.
 */
function turnosAnteriores(historico) {
  if (!Array.isArray(historico)) return [];

  return historico
    .map((mensagem) => {
      const texto = String(mensagem?.texto || "").trim();
      if (!texto) return null;
      if (mensagem?.autor === "ia") return { role: "model", parts: [{ text: texto }] };
      if (mensagem?.autor === "usuario") return { role: "user", parts: [{ text: texto }] };
      return null;
    })
    .filter(Boolean);
}

/**
 * Gera conteúdo estruturado.
 *
 * `schema` é um JSON Schema (subset aceito pelo Gemini). Passar schema ativa o
 * modo JSON do modelo — sem ele, o texto volta em prosa e o parse vira loteria.
 *
 * `historico` é opcional e serve ao chat: turnos anteriores da conversa, em
 * ordem cronológica, antes do turno atual.
 */
export async function gerarJson({
  instrucao,
  prompt,
  schema,
  temperatura = 0.2,
  anexo = null,
  historico = [],
}) {
  assertConfigured();

  // Corta a entrada antes de enviar: prompt gigante custa caro e estoura o
  // limite de contexto no meio da geração, o que devolve resposta truncada.
  const entrada =
    prompt.length > config.ai.maxTranscriptChars
      ? `${prompt.slice(0, config.ai.maxTranscriptChars)}\n\n[conteúdo truncado por limite de tamanho]`
      : prompt;

  // O anexo vai ANTES do texto: com áudio e PDF o Gemini responde melhor quando
  // recebe o material primeiro e a instrução depois.
  const partes = [];
  if (anexo?.base64) {
    partes.push({ inlineData: { mimeType: anexo.mimeType, data: anexo.base64 } });
  }
  partes.push({ text: entrada });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.requestTimeoutMs);

  let response;
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(config.ai.geminiModel)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.ai.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucao }] },
          contents: [...turnosAnteriores(historico), { role: "user", parts: partes }],
          generationConfig: {
            temperature: temperatura,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw conflict("A análise demorou mais que o limite e foi cancelada. Tente um recorte menor.");
    }
    throw conflict("Não foi possível falar com o serviço de IA.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // O corpo do erro do Gemini pode ecoar trechos do prompt — em produção não
    // vaza para o cliente, só vai para o log do servidor.
    const detalhe = await response.text().catch(() => "");
    if (!isProduction()) {
      console.error(`Gemini ${response.status}: ${detalhe.slice(0, 500)}`);
    }
    throw conflict("O serviço de IA recusou a requisição.");
  }

  const payload = await response.json().catch(() => null);
  const texto = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!texto) {
    // Sem candidato normalmente significa bloqueio por filtro de segurança.
    const motivo = payload?.promptFeedback?.blockReason;
    throw conflict(
      motivo
        ? `A IA bloqueou a geração (${motivo}).`
        : "A IA respondeu vazio. Tente novamente."
    );
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw conflict("A IA devolveu um formato inesperado.");
  }
}
