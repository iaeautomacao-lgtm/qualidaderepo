import styles from "./GraficoLinha.module.css";

/**
 * Evolução da qualidade no tempo — linha com área, em SVG inline.
 *
 * Por que linha e não barra: a pergunta do gestor aqui é "está subindo ou
 * caindo?", e barra de altura variável responde isso pior que uma linha. O
 * volume de monitorias do dia continua visível, mas como barra de fundo
 * discreta: sem ele, dois pontos com a mesma nota parecem ter o mesmo peso
 * quando um veio de 1 avaliação e o outro de 40.
 *
 * Acessibilidade: o desenho é `aria-hidden` e os dados vão numa tabela
 * `sr-only` — mesma regra do BarChart. `role="img"` com rótulo no container
 * cobre quem enxerga mas navega por teclado.
 */

const LARGURA = 720;
const ALTURA = 240;
const PAD_ESQ = 34;
const PAD_DIR = 8;
const PAD_TOPO = 12;
const PAD_BASE = 26;

const LINHAS_GUIA = [0, 25, 50, 75, 100];

export default function GraficoLinha({ pontos, titulo = "Evolução da qualidade", maximo = 100 }) {
  const lista = Array.isArray(pontos) ? pontos.filter(Boolean) : [];

  if (lista.length === 0) return null;

  const areaLargura = LARGURA - PAD_ESQ - PAD_DIR;
  const areaAltura = ALTURA - PAD_TOPO - PAD_BASE;
  const volumeMaximo = Math.max(1, ...lista.map((ponto) => Number(ponto.volume) || 0));

  // Um ponto só não tem intervalo: ele fica no centro em vez de colado na borda.
  const x = (indice) =>
    lista.length === 1
      ? PAD_ESQ + areaLargura / 2
      : PAD_ESQ + (indice / (lista.length - 1)) * areaLargura;
  const y = (valor) => PAD_TOPO + areaAltura - (Math.min(Math.max(Number(valor) || 0, 0), maximo) / maximo) * areaAltura;

  const coordenadas = lista.map((ponto, indice) => ({ ...ponto, cx: x(indice), cy: y(ponto.valor) }));
  const linha = coordenadas.map((ponto) => `${ponto.cx.toFixed(1)},${ponto.cy.toFixed(1)}`).join(" ");
  const area = `${PAD_ESQ},${PAD_TOPO + areaAltura} ${linha} ${coordenadas.at(-1).cx.toFixed(1)},${PAD_TOPO + areaAltura}`;

  const media = Math.round((lista.reduce((soma, ponto) => soma + (Number(ponto.valor) || 0), 0) / lista.length) * 10) / 10;
  const primeiro = Number(lista[0].valor) || 0;
  const ultimo = Number(lista.at(-1).valor) || 0;

  // Rótulos do eixo X: com 31 dias, escrever todos vira borrão. Mostra o
  // primeiro, o último e um a cada N.
  const passo = Math.max(1, Math.ceil(lista.length / 6));

  return (
    <figure className={styles.figura}>
      <figcaption className="sr-only">
        {`${titulo}: ${lista.length} ponto(s). Média ${media}, começa em ${primeiro} e termina em ${ultimo}.`}
      </figcaption>

      <div className={styles.moldura} role="img" aria-label={`${titulo} (gráfico de linha)`}>
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {LINHAS_GUIA.map((valor) => (
            <g key={`guia-${valor}`}>
              <line className={styles.guia} x1={PAD_ESQ} x2={LARGURA - PAD_DIR} y1={y(valor)} y2={y(valor)} />
              <text className={styles.rotuloY} x={PAD_ESQ - 8} y={y(valor) + 4} textAnchor="end">
                {valor}
              </text>
            </g>
          ))}

          {/* Volume do dia atrás da linha: contexto, não protagonista. */}
          {coordenadas.map((ponto, indice) => {
            const altura = ((Number(ponto.volume) || 0) / volumeMaximo) * (areaAltura * 0.32);
            const largura = Math.max(3, Math.min(18, areaLargura / Math.max(lista.length, 1) - 4));
            return (
              <rect
                className={styles.volume}
                key={`volume-${ponto.rotulo}-${indice}`}
                x={ponto.cx - largura / 2}
                y={PAD_TOPO + areaAltura - altura}
                width={largura}
                height={altura}
                rx="2"
              />
            );
          })}

          <polyline className={styles.area} points={area} />
          <polyline className={styles.linha} points={linha} />

          {coordenadas.map((ponto, indice) => (
            <circle className={styles.ponto} cx={ponto.cx} cy={ponto.cy} key={`ponto-${ponto.rotulo}-${indice}`} r="3.5" />
          ))}

          {coordenadas.map((ponto, indice) => {
            const mostra = indice === 0 || indice === lista.length - 1 || indice % passo === 0;
            if (!mostra) return null;
            return (
              <text
                className={styles.rotuloX}
                key={`eixo-${ponto.rotulo}-${indice}`}
                x={ponto.cx}
                y={ALTURA - 8}
                textAnchor={indice === 0 ? "start" : indice === lista.length - 1 ? "end" : "middle"}
              >
                {ponto.rotulo}
              </text>
            );
          })}
        </svg>
      </div>

      <table className="data-table sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th className="num" scope="col">Nota média</th>
            <th className="num" scope="col">Monitorias</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((ponto, indice) => (
            <tr key={`linha-tabela-${ponto.rotulo}-${indice}`}>
              <th scope="row">{ponto.rotulo}</th>
              <td className="num">{Number(ponto.valor ?? 0).toFixed(1)}</td>
              <td className="num">{Number(ponto.volume ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
