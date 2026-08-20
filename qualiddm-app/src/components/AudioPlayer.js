"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import styles from "./AudioPlayer.module.css";

const VELOCIDADES = [1, 1.5, 2];

/** Segundos -> "8:28". A gravação é sempre minutos, nunca horas. */
function tempo(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`;
}

/**
 * Player da gravação avaliada.
 *
 * Controles próprios em vez de `<audio controls>` porque a ficha precisa de
 * velocidade de reprodução (1x/1.5x/2x) — monitor ouve a chamada em 2x para
 * conferir um critério — e o controle nativo não oferece isso de forma
 * consistente entre navegadores.
 *
 * Trocar o nativo por controles próprios só se justifica se a acessibilidade
 * não piorar, então cada peça é um elemento nativo: `<button>` para play/mudo,
 * `<input type="range">` para posição e volume (setas do teclado funcionam de
 * graça) e `<select>` para a velocidade. O `<audio>` fica sem `controls`, mas
 * segue no DOM como fonte da verdade do estado.
 *
 * Sem `src` a interface explica a ausência em vez de mostrar controle morto.
 */
export default function AudioPlayer({
  src,
  titulo = "Gravação",
  descricao,
  duracaoLabel,
  emptyTitle = "Áudio não disponível",
  emptyHint = "Esta avaliação não tem arquivo de áudio vinculado.",
  className,
  /* Marcadores na linha do tempo: `[{ segundos, rotulo, tom, id }]`.
     Cada um é uma falha apontada pela IA, e clicar leva o áudio até ela — é o
     que liga o apontamento à evidência sem o supervisor procurar o trecho. */
  marcadores = [],
  /* Pedido de salto vindo de fora: `{ segundos, nonce }`. O `nonce` existe para
     dois cliques no MESMO marcador voltarem ao trecho: sem ele o valor não muda
     e o efeito não roda de novo. */
  saltoExterno = null,
}) {
  const audioRef = useRef(null);
  const idBase = useId();
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [falhou, setFalhou] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(src));

  // Trocar de gravação (ou receber o audioUrl depois da carga do JSON) precisa
  // zerar posição/estado, senão o player mostra o tempo da faixa anterior.
  // O ajuste é feito na renderização, não num efeito: assim não há um render
  // intermediário mostrando o tempo da faixa antiga com a nova fonte.
  const [srcAnterior, setSrcAnterior] = useState(src);
  if (src !== srcAnterior) {
    setSrcAnterior(src);
    setTocando(false);
    setPosicao(0);
    setDuracao(0);
    setFalhou(false);
    setCarregando(Boolean(src));
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = velocidade;
  }, [velocidade, src]);

  /* Salta quando `saltoExterno` muda. Em efeito, e não no clique de quem chama,
     porque só este componente tem a referência do <audio>. */
  useEffect(() => {
    const audio = audioRef.current;
    const alvo = Number(saltoExterno?.segundos);
    if (!audio || !Number.isFinite(alvo) || alvo < 0) return;

    audio.currentTime = alvo;
    queueMicrotask(() => setPosicao(alvo));
    // Toca junto: quem clica em "ouvir trecho" quer ouvir, não posicionar.
    audio.play().then(
      () => setTocando(true),
      () => {},
    );
  }, [saltoExterno]);

  // Daqui para baixo pode haver `return` antecipado, então nenhum hook novo
  // depois desta linha.
  if (!src) {
    return (
      <div className={className ? `${styles.player} ${className}` : styles.player}>
        <PlayerCabecalho titulo={titulo} descricao={descricao} />
        <p className="alert">
          <Icon name="info" size={18} />
          <span className="alert-body">
            <strong>{emptyTitle}</strong>
            <span className="text-soft">{emptyHint}</span>
          </span>
        </p>
      </div>
    );
  }

  const duracaoConhecida = Number.isFinite(duracao) && duracao > 0;
  const totalLabel = duracaoConhecida ? tempo(duracao) : duracaoLabel || "--:--";

  function alternarPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setFalhou(true));
    } else {
      audio.pause();
    }
  }

  function irPara(valor) {
    const audio = audioRef.current;
    const alvo = Number(valor);
    if (!audio || !Number.isFinite(alvo)) return;
    audio.currentTime = alvo;
    setPosicao(alvo);
  }

  function ajustarVolume(valor) {
    const audio = audioRef.current;
    const alvo = Number(valor);
    if (!audio || !Number.isFinite(alvo)) return;
    audio.volume = alvo;
    audio.muted = alvo === 0;
    setVolume(alvo);
    setMudo(alvo === 0);
  }

  function alternarMudo() {
    const audio = audioRef.current;
    if (!audio) return;
    const proximo = !audio.muted;
    audio.muted = proximo;
    setMudo(proximo);
  }

  return (
    <div className={className ? `${styles.player} ${className}` : styles.player}>
      <PlayerCabecalho titulo={titulo} descricao={descricao} />

      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        onLoadedMetadata={(evento) => {
          const total = evento.currentTarget.duration;
          setDuracao(Number.isFinite(total) ? total : 0);
          setCarregando(false);
          evento.currentTarget.playbackRate = velocidade;
        }}
        onTimeUpdate={(evento) => setPosicao(evento.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => setTocando(false)}
        onError={() => {
          setFalhou(true);
          setCarregando(false);
        }}
      />

      {falhou ? (
        <p className="alert danger" role="status">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Não foi possível carregar o áudio</strong>
            <span>
              O arquivo pode ter sido movido no servidor.{" "}
              <a className={styles.link} href={src} download>
                Tentar baixar o arquivo
              </a>
              .
            </span>
          </span>
        </p>
      ) : (
        <div className={styles.controles}>
          <button
            className={styles.botaoPlay}
            type="button"
            onClick={alternarPlay}
            aria-label={tocando ? "Pausar gravação" : "Reproduzir gravação"}
          >
            <Icon name={tocando ? "pause" : "play"} size={20} />
          </button>

          <span className={styles.tempo} aria-hidden="true">
            {tempo(posicao)}
          </span>

          <label className="sr-only" htmlFor={`${idBase}-posicao`}>
            Posição da gravação
          </label>
          {/* O range e os marcadores dividem a mesma faixa. Os marcadores são
              botões de verdade, alcançáveis por teclado — um <span> decorativo
              deixaria o atalho para a evidência inacessível. */}
          <span className={styles.faixa}>
            <input
              className={styles.trilha}
              id={`${idBase}-posicao`}
              type="range"
              min="0"
              max={duracaoConhecida ? duracao : 0}
              step="0.5"
              value={posicao}
              disabled={!duracaoConhecida}
              onChange={(evento) => irPara(evento.target.value)}
              aria-valuetext={`${tempo(posicao)} de ${totalLabel}`}
            />

            {duracaoConhecida
              ? marcadores
                  // Marcador além do fim do áudio sairia da faixa: a IA pode
                  // devolver um instante que não existe no arquivo.
                  .filter((marca) => Number(marca?.segundos) > 0 && Number(marca.segundos) <= duracao)
                  .map((marca) => (
                    <button
                      className={styles.marcador}
                      key={marca.id ?? `${marca.segundos}-${marca.rotulo}`}
                      type="button"
                      data-tom={marca.tom || "danger"}
                      style={{ "--posicao": `${(Number(marca.segundos) / duracao) * 100}%` }}
                      onClick={() => irPara(marca.segundos)}
                      title={`${tempo(Number(marca.segundos))} — ${marca.rotulo}`}
                    >
                      <span className="sr-only">
                        Ir para {tempo(Number(marca.segundos))}: {marca.rotulo}
                      </span>
                    </button>
                  ))
              : null}
          </span>

          <span className={styles.tempo}>
            <span className="sr-only">Duração total </span>
            {totalLabel}
          </span>

          <button
            className={styles.botaoIcone}
            type="button"
            onClick={alternarMudo}
            aria-label={mudo ? "Ativar som" : "Silenciar"}
          >
            <Icon name={mudo ? "volumeMute" : "volume"} size={18} />
          </button>

          <label className="sr-only" htmlFor={`${idBase}-volume`}>
            Volume
          </label>
          <input
            className={`${styles.trilha} ${styles.trilhaVolume}`}
            id={`${idBase}-volume`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={mudo ? 0 : volume}
            onChange={(evento) => ajustarVolume(evento.target.value)}
            aria-valuetext={`${Math.round((mudo ? 0 : volume) * 100)}%`}
          />

          <label className="sr-only" htmlFor={`${idBase}-velocidade`}>
            Velocidade de reprodução
          </label>
          <select
            className={styles.velocidade}
            id={`${idBase}-velocidade`}
            value={velocidade}
            onChange={(evento) => setVelocidade(Number(evento.target.value))}
          >
            {VELOCIDADES.map((taxa) => (
              <option key={taxa} value={taxa}>
                {taxa}x
              </option>
            ))}
          </select>
        </div>
      )}

      {carregando && !falhou ? (
        <p className={styles.aviso} role="status">
          Carregando o áudio…
        </p>
      ) : null}
    </div>
  );
}

function PlayerCabecalho({ titulo, descricao }) {
  if (!titulo && !descricao) return null;

  return (
    <div className={styles.cabecalho}>
      <span className="icon-badge sm" aria-hidden="true">
        <Icon name="fileAudio" size={16} />
      </span>
      <span className={styles.cabecalhoTexto}>
        <strong>{titulo}</strong>
        {descricao ? <span className="text-soft">{descricao}</span> : null}
      </span>
    </div>
  );
}
