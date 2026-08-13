import { Icon } from "./icons";

const wave = [30, 54, 42, 68, 92, 48, 36, 72, 61, 44, 83, 52, 38, 66, 75, 46, 57, 90, 64, 40];

/**
 * Player do áudio da chamada.
 *
 * Usa o <audio controls> nativo: play/pause, busca e volume já vêm acessíveis
 * pelo teclado e traduzidos pelo sistema. O botão anterior não tinha handler
 * nem elemento de áudio — era decorativo.
 *
 * Sem `src` a interface diz que não há arquivo, em vez de mostrar um controle
 * que não faz nada.
 *
 * `className` existe para a tela hospedeira ajustar a densidade (a ficha, por
 * exemplo, encolhe a onda para caber sem rolagem) sem duplicar o componente.
 */
export default function AudioPlayer({
  src,
  duration = "03:42",
  format = "MP3 importado",
  title = "Áudio da chamada",
  emptyTitle = "Áudio ainda não anexado",
  emptyHint = "Envie o arquivo pela central de upload para ouvir a chamada aqui.",
  className,
}) {
  return (
    <div className={className ? `audio-player ${className}` : "audio-player"}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p>
            {duration} min - {format}
          </p>
        </div>
        <span className="icon-badge">
          <Icon name="fileAudio" size={18} />
        </span>
      </div>

      {/* Onda decorativa: a informação real está no player e na duração. */}
      <div className="wave" aria-hidden="true">
        {wave.map((height, index) => (
          <span key={`onda-${index}`} style={{ "--h": `${height}%` }} />
        ))}
      </div>

      {src ? (
        <audio controls preload="metadata" src={src}>
          <a href={src}>Baixar o áudio da chamada</a>
        </audio>
      ) : (
        <p className="alert">
          <Icon name="info" size={18} />
          <span className="alert-body">
            <strong>{emptyTitle}</strong>
            <span className="text-soft">{emptyHint}</span>
          </span>
        </p>
      )}
    </div>
  );
}
