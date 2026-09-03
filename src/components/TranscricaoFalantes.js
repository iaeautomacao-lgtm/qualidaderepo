import { Icon } from "./icons";
import styles from "./TranscricaoFalantes.module.css";

/**
 * Transcrição em turnos de fala.
 *
 * O prompt da análise pede a transcrição em linhas `SPEAKER_00: texto`
 * (seção 4 do contrato). Renderizar isso como `<pre>` obriga o monitor a ler
 * um bloco monoespaçado sem hierarquia — aqui cada linha vira um turno com
 * rótulo do falante, e falantes diferentes recebem tratamento visual distinto.
 *
 * Transcrição antiga (sem falantes) continua legível: linha sem rótulo entra
 * como parágrafo corrido.
 */

/* Rótulo curto, sem pontuação de fim de frase e com no máximo 3 palavras —
   o suficiente para pegar "SPEAKER_00", "Operador" e "Cliente Kleber" sem
   confundir uma frase que por acaso tenha dois-pontos no meio. */
const RE_FALA = /^([\p{L}\p{N}_.\s-]{2,24}?)\s*:\s+(\S.*)$/u;

function ehRotuloDeFalante(rotulo) {
  if (/[.!?]$/.test(rotulo)) return false;
  return rotulo.trim().split(/\s+/).length <= 3;
}

/** "SPEAKER_00" não diz nada a um monitor; "Falante 1" diz. */
function humanizar(rotulo) {
  const casa = /^speaker[_\s-]?(\d{1,2})$/i.exec(rotulo);
  if (!casa) return rotulo;
  return `Falante ${Number(casa[1]) + 1}`;
}

export function separarFalas(texto) {
  const linhas = String(texto ?? "").split(/\r?\n/);
  const falas = [];

  for (const linha of linhas) {
    const conteudo = linha.trim();
    if (!conteudo) continue;

    const casa = RE_FALA.exec(conteudo);
    if (casa && ehRotuloDeFalante(casa[1])) {
      falas.push({ falante: casa[1].trim(), texto: casa[2].trim() });
      continue;
    }

    // Continuação da fala anterior (a IA às vezes quebra uma linha longa).
    if (falas.length > 0 && falas[falas.length - 1].falante) {
      falas[falas.length - 1].texto += ` ${conteudo}`;
    } else {
      falas.push({ falante: null, texto: conteudo });
    }
  }

  return falas;
}

export default function TranscricaoFalantes({
  texto,
  titulo = "Transcrição",
  vazioTexto = "Nenhuma transcrição salva para esta gravação.",
}) {
  const falas = separarFalas(texto);
  // Ordem de entrada define o tom de cada falante — assim SPEAKER_00 tem
  // sempre o mesmo tratamento ao longo da conversa.
  const ordemFalantes = [];
  for (const fala of falas) {
    if (fala.falante && !ordemFalantes.includes(fala.falante)) ordemFalantes.push(fala.falante);
  }

  return (
    <section className="card pad">
      <div className="section-head">
        <div>
          <h2>{titulo}</h2>
          {falas.length > 0 ? (
            <p>
              {falas.length} {falas.length === 1 ? "fala" : "falas"}
              {ordemFalantes.length > 0
                ? ` · ${ordemFalantes.length} ${ordemFalantes.length === 1 ? "falante" : "falantes"}`
                : ""}
            </p>
          ) : null}
        </div>
        <span className="icon-badge" aria-hidden="true">
          <Icon name="waveform" size={18} />
        </span>
      </div>

      {falas.length === 0 ? (
        <div className="empty-state">
          <span className="icon-badge">
            <Icon name="mic" size={20} />
          </span>
          <h3>Sem transcrição</h3>
          <p>{vazioTexto}</p>
        </div>
      ) : (
        <ol className={styles.dialogo} tabIndex={0} aria-label="Turnos de fala da gravação">
          {falas.map((fala, indice) => {
            const posicao = fala.falante ? ordemFalantes.indexOf(fala.falante) : -1;
            return (
              <li
                className={styles.turno}
                data-falante={posicao >= 0 ? posicao % 4 : "narrativa"}
                key={`fala-${indice}`}
              >
                {fala.falante ? (
                  <span className={styles.rotulo} title={fala.falante}>
                    {humanizar(fala.falante)}
                  </span>
                ) : null}
                <p className={styles.fala}>{fala.texto}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
