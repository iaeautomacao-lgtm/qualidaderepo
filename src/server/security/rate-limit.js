import { tooManyRequests } from "../errors";

/**
 * Rate limit por janela deslizante, na memória do processo.
 *
 * LIMITAÇÃO CONHECIDA: o contador vive no processo. Num deploy com mais de um
 * worker (PM2 em cluster, várias instâncias no cPanel) cada processo tem o seu,
 * e o limite efetivo é o número de processos multiplicado pelo teto. Para valer
 * de verdade em produção multiprocesso isso tem de ir para o Redis — a
 * interface aqui foi deixada com essa troca em mente: só `consumir` precisa
 * mudar.
 *
 * Mesmo com a limitação vale a pena: o alvo é a chamada de IA, que custa
 * dinheiro por requisição. Um clique repetido em "Enviar" no chat já é barrado.
 */
const janelas = new Map();

// Sem isso um servidor de longa duração acumularia uma entrada por usuário que
// já foi embora. A limpeza roda junto com o consumo, sem timer.
const MAX_CHAVES = 5000;

function limpar(corte) {
  for (const [chave, marcas] of janelas) {
    if (marcas.length === 0 || marcas[marcas.length - 1] <= corte) janelas.delete(chave);
  }
}

/**
 * Registra uma tentativa. Lança 429 quando o teto da janela foi atingido.
 *
 * `chave` deve identificar quem está consumindo (ex.: `chat-ia:42`). Nunca use
 * só o nome da rota: isso transformaria o limite de um usuário em limite global.
 */
export function consumir(chave, { limite, janelaMs }) {
  const agora = Date.now();
  const inicio = agora - janelaMs;

  const marcas = (janelas.get(chave) || []).filter((marca) => marca > inicio);

  if (marcas.length >= limite) {
    const esperaMs = marcas[0] + janelaMs - agora;
    const segundos = Math.max(1, Math.ceil(esperaMs / 1000));
    throw tooManyRequests(
      `Limite de ${limite} requisições atingido. Tente novamente em ${segundos} segundo(s).`,
    );
  }

  marcas.push(agora);
  janelas.set(chave, marcas);
  if (janelas.size > MAX_CHAVES) limpar(inicio);
}
