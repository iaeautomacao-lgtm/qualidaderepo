import { config, isProduction } from "../config";
import { conflict } from "../errors";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function assertConfigured() {
  if (!config.ai.geminiApiKey) {
    throw conflict("Integracao de IA nao configurada. Defina GEMINI_API_KEY no ambiente do servidor.");
  }
}

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

function montarPayload({ instrucao, partes, schema, temperatura, historico, usarSchema }) {
  const generationConfig = {
    temperature: temperatura,
    responseMimeType: "application/json",
  };

  if (usarSchema && schema) {
    generationConfig.responseSchema = schema;
  }

  return {
    systemInstruction: { parts: [{ text: instrucao }] },
    contents: [...turnosAnteriores(historico), { role: "user", parts: partes }],
    generationConfig,
  };
}

async function chamarGemini(payload, signal) {
  return fetch(`${ENDPOINT}/${encodeURIComponent(config.ai.geminiModel)}:generateContent`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.ai.geminiApiKey,
    },
    body: JSON.stringify(payload),
  });
}

function mensagemErroGemini(status, detalhe) {
  let mensagem = "";
  try {
    const json = JSON.parse(detalhe);
    mensagem = json?.error?.message || "";
  } catch {
    mensagem = detalhe || "";
  }

  const limpa = mensagem.replace(/\s+/g, " ").trim().slice(0, 240);
  if (status === 401 || status === 403) return "Gemini recusou a chave de API. Confira GEMINI_API_KEY no cPanel.";
  if (status === 404) return "Modelo Gemini nao encontrado. Confira GEMINI_MODEL no cPanel.";
  if (status === 429) return "Gemini atingiu limite de uso ou cota. Tente novamente em instantes.";
  if (status >= 500) return "Gemini ficou indisponivel temporariamente. Tente novamente.";
  return limpa ? `Gemini recusou a requisicao (${limpa}).` : "O servico de IA recusou a requisicao.";
}

function extrairTexto(payload) {
  return payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.map((part) => part?.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();
}

function parseJsonDaIa(texto) {
  if (!texto) return null;
  const bruto = String(texto).trim();
  const semFence = bruto
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  for (const candidato of [bruto, semFence]) {
    try {
      return JSON.parse(candidato);
    } catch {
      // tenta outro formato
    }
  }

  const inicio = semFence.indexOf("{");
  const fim = semFence.lastIndexOf("}");
  if (inicio >= 0 && fim > inicio) {
    try {
      return JSON.parse(semFence.slice(inicio, fim + 1));
    } catch {
      // erro tratado abaixo
    }
  }

  return null;
}

async function executarComFallback({ instrucao, partes, schema, temperatura, historico, signal }) {
  const payloadComSchema = montarPayload({
    instrucao,
    partes,
    schema,
    temperatura,
    historico,
    usarSchema: true,
  });

  let response = await chamarGemini(payloadComSchema, signal);

  if (response.status === 400 && schema) {
    const detalheSchema = await response.text().catch(() => "");
    if (!isProduction()) {
      console.warn(`Gemini schema fallback ${response.status}: ${detalheSchema.slice(0, 500)}`);
    }

    const payloadSemSchema = montarPayload({
      instrucao,
      partes,
      schema,
      temperatura,
      historico,
      usarSchema: false,
    });
    response = await chamarGemini(payloadSemSchema, signal);
  }

  return response;
}

export async function gerarJson({
  instrucao,
  prompt,
  schema,
  temperatura = 0.2,
  anexo = null,
  historico = [],
}) {
  assertConfigured();

  const entrada =
    prompt.length > config.ai.maxTranscriptChars
      ? `${prompt.slice(0, config.ai.maxTranscriptChars)}\n\n[conteudo truncado por limite de tamanho]`
      : prompt;

  const partes = [];
  if (anexo?.base64) {
    partes.push({ inlineData: { mimeType: anexo.mimeType, data: anexo.base64 } });
  }
  partes.push({ text: entrada });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.requestTimeoutMs);

  let response;
  try {
    response = await executarComFallback({
      instrucao,
      partes,
      schema,
      temperatura,
      historico,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw conflict("A analise demorou mais que o limite e foi cancelada. Tente um recorte menor.");
    }
    throw conflict("Nao foi possivel falar com o servico de IA.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detalhe = await response.text().catch(() => "");
    if (!isProduction()) {
      console.error(`Gemini ${response.status}: ${detalhe.slice(0, 500)}`);
    }
    throw conflict(mensagemErroGemini(response.status, detalhe));
  }

  const payload = await response.json().catch(() => null);
  const texto = extrairTexto(payload);

  if (!texto) {
    const motivo =
      payload?.promptFeedback?.blockReason ||
      payload?.candidates?.[0]?.finishReason ||
      payload?.candidates?.[0]?.safetyRatings?.find((item) => item.blocked)?.category;
    throw conflict(motivo ? `A IA bloqueou a geracao (${motivo}).` : "A IA respondeu vazio. Tente novamente.");
  }

  const json = parseJsonDaIa(texto);
  if (!json) throw conflict("A IA devolveu um formato inesperado. Reprocesse o arquivo.");
  return json;
}
