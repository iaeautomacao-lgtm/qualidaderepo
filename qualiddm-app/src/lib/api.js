/**
 * Cliente HTTP das telas.
 *
 * Todas as rotas de `src/app/api` respondem no mesmo envelope:
 *   sucesso -> { ok: true,  data: { ... } }
 *   falha   -> { ok: false, error: { code, message, requestId } }
 *
 * Este módulo é o único lugar que conhece esse envelope. As telas recebem
 * `data` já desembrulhado, ou uma exceção com a mensagem que o backend
 * escreveu — nunca "Erro 500" nem um stack trace.
 */

const MENSAGEM_PADRAO = "Não foi possível concluir a operação. Tente novamente.";

async function ler(resposta) {
  // `null` quando o corpo não é JSON (proxy fora do ar, HTML de erro, 502...).
  const payload = await resposta.json().catch(() => null);

  if (!resposta.ok || payload?.ok === false) {
    const erro = new Error(payload?.error?.message || MENSAGEM_PADRAO);
    // O backend manda pistas acionáveis em `details` — por exemplo
    // `filtrosAceitos` quando um relatório não suporta o filtro enviado. Sem
    // repassar isso a tela só poderia dizer "deu erro".
    erro.codigo = payload?.error?.code ?? null;
    erro.detalhes = payload?.error?.details ?? null;
    erro.status = resposta.status;
    throw erro;
  }

  return payload?.data ?? payload;
}

/** GET. `cache: no-store` porque toda tela precisa do estado de agora. */
export async function buscarApi(url, { signal } = {}) {
  return ler(await fetch(url, { cache: "no-store", signal }));
}

/** POST em JSON. */
export async function enviarApi(url, corpo, { signal, metodo = "POST" } = {}) {
  return ler(
    await fetch(url, {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal,
    }),
  );
}

/**
 * DELETE sem corpo.
 *
 * Existe como função própria porque `enviarApi(url, {}, { metodo: "DELETE" })`
 * mandaria `{}` como corpo, e servidor que valida corpo em DELETE recusaria.
 */
export async function excluirApi(url, { signal } = {}) {
  return ler(await fetch(url, { method: "DELETE", signal }));
}

/** POST em multipart — upload de arquivo não passa por JSON. */
export async function enviarArquivos(url, formData, { signal } = {}) {
  return ler(await fetch(url, { method: "POST", body: formData, signal }));
}

/**
 * Monta a query string ignorando o que está vazio.
 *
 * Sem isso a URL viraria `?status=&cliente=&de=`, e o backend teria de
 * distinguir "não filtrado" de "filtrado por string vazia" em cada campo.
 */
export function comFiltros(base, filtros) {
  const params = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === null || valor === undefined || valor === "" || valor === "todos") continue;
    params.set(chave, String(valor));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
