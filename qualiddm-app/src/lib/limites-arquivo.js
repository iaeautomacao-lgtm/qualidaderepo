/**
 * Teto de tamanho para análise direta da IA.
 *
 * Vive em `lib/` — e não no serviço da IA — porque as duas pontas precisam do
 * mesmo número: o servidor recusa acima disso, e a tela de upload precisa avisar
 * ANTES do envio. Dois números separados divergiriam na primeira vez que um
 * deles mudasse, e o sintoma seria o pior possível: arquivo aceito, guardado, e
 * análise que falha depois.
 *
 * O limite é da API do Gemini para conteúdo embutido na requisição
 * (`inlineData`). Acima disso é preciso usar o serviço de arquivos dela, que
 * este projeto ainda não usa.
 */
export const MAX_BYTES_ANALISE_IA = 15 * 1024 * 1024;

/** "18,4 MB" — para mensagem de erro, não para tabela. */
export function formatarMegabytes(bytes) {
  const numero = Number(bytes);
  if (!Number.isFinite(numero) || numero < 0) return "0 MB";
  return `${(numero / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** O arquivo cabe na análise direta? */
export function cabeNaAnaliseIa(bytes) {
  const numero = Number(bytes);
  return Number.isFinite(numero) && numero > 0 && numero <= MAX_BYTES_ANALISE_IA;
}
