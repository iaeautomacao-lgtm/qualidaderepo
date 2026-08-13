import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import {
  dashboardKpis,
  evolucao,
  quadrantes,
  statusAtual,
  topOfensores,
} from "@/data/seed";
import styles from "./page.module.css";

/* ==========================================================================
   Gráfico de linha com eixo duplo — SVG inline, sem biblioteca.

   Toda a geometria está em unidades do viewBox: o SVG escala junto com a
   largura do card, então nada aqui precisa ser medido em pixels.
   ========================================================================== */

const AREA = { largura: 720, altura: 190, esquerda: 62, direita: 662, topo: 14, base: 152 };

// O último tick de cada eixo é o teto da escala — vem do seed, não é chutado.
const MAX_ESQUERDA = evolucao.leftTicks[evolucao.leftTicks.length - 1];
const MAX_DIREITA = evolucao.rightTicks[evolucao.rightTicks.length - 1];

const ESTILO_SERIE = { avaliacoes: styles.serieA, qualidade: styles.serieB };
const MARCA_SERIE = { avaliacoes: styles.marcaCirculo, qualidade: styles.marcaLosango };

// Arredonda para 2 casas: em unidades de viewBox a diferença é invisível e
// evita atributos com 16 dígitos no HTML.
function arredonda(numero) {
  return Math.round(numero * 100) / 100;
}

function eixoX(indice) {
  const passo = (AREA.direita - AREA.esquerda) / (evolucao.labels.length - 1);
  return arredonda(AREA.esquerda + passo * indice);
}

function eixoY(valor, maximo) {
  return arredonda(AREA.base - (valor / maximo) * (AREA.base - AREA.topo));
}

function GraficoEvolucao() {
  if (evolucao.series.every((serie) => serie.values.length === 0)) {
    return (
      <SemDados
        titulo="Sem série histórica"
        texto="A evolução aparece quando houver avaliações cadastradas no período."
      />
    );
  }

  const series = evolucao.series.map((serie) => {
    const maximo = serie.axis === "left" ? MAX_ESQUERDA : MAX_DIREITA;
    return {
      ...serie,
      maximo,
      pontos: serie.values.map((valor, indice) => ({
        x: eixoX(indice),
        y: eixoY(valor, maximo),
      })),
    };
  });

  const resumo = series
    .map((serie) => {
      const primeiro = serie.values[0];
      const ultimo = serie.values[serie.values.length - 1];
      return `${serie.label} de ${primeiro} a ${ultimo}`;
    })
    .join("; ");

  return (
    <figure className={styles.figura}>
      <svg
        className={styles.grafico}
        viewBox={`0 0 ${AREA.largura} ${AREA.altura}`}
        role="img"
        aria-label={`Gráfico de linha dos últimos ${evolucao.labels.length} meses: ${resumo}. Os valores exatos estão na tabela seguinte.`}
      >
        {/* Uma linha de grade por par de ticks: os dois eixos dividem a mesma
            altura em 5 faixas, então cada grade serve aos dois. */}
        {evolucao.leftTicks.map((tick, indice) => {
          const y = eixoY(tick, MAX_ESQUERDA);
          return (
            <g key={tick}>
              <line
                className={styles.grade}
                x1={AREA.esquerda}
                y1={y}
                x2={AREA.direita}
                y2={y}
              />
              <text className={styles.tick} x={AREA.esquerda - 10} y={y + 4} textAnchor="end">
                {tick}
              </text>
              <text className={styles.tick} x={AREA.direita + 10} y={y + 4}>
                {evolucao.rightTicks[indice]}
              </text>
            </g>
          );
        })}

        {series.map((serie) => (
          <g className={ESTILO_SERIE[serie.key]} key={serie.key}>
            <polyline
              className={styles.linha}
              points={serie.pontos.map((ponto) => `${ponto.x},${ponto.y}`).join(" ")}
            />
            {/* Marcador com forma própria por série (círculo x losango): duas
                linhas próximas não podem depender só da cor para se separar. */}
            {serie.pontos.map((ponto, indice) =>
              serie.key === "avaliacoes" ? (
                <circle
                  className={styles.marcador}
                  cx={ponto.x}
                  cy={ponto.y}
                  key={evolucao.labels[indice]}
                  r="3.6"
                />
              ) : (
                <rect
                  className={styles.marcador}
                  height="6.4"
                  key={evolucao.labels[indice]}
                  transform={`rotate(45 ${ponto.x} ${ponto.y})`}
                  width="6.4"
                  x={ponto.x - 3.2}
                  y={ponto.y - 3.2}
                />
              )
            )}
          </g>
        ))}

        {evolucao.labels.map((rotulo, indice) => (
          <text
            className={styles.tick}
            key={rotulo}
            textAnchor="middle"
            x={eixoX(indice)}
            y={AREA.base + 24}
          >
            {rotulo}
          </text>
        ))}
      </svg>

      <table className="data-table sr-only">
        <caption>Evolução de avaliações e qualidade por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            {evolucao.series.map((serie) => (
              <th className="num" key={serie.key} scope="col">
                {serie.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evolucao.labels.map((rotulo, indice) => (
            <tr key={rotulo}>
              <th scope="row">{rotulo}</th>
              {evolucao.series.map((serie) => (
                <td className="num" key={serie.key}>
                  {serie.values[indice]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Estado vazio dos gráficos.
 *
 * Enquanto o banco não entra, os dados de série não existem — e mostrar linha
 * ou rosca com número inventado seria pior que mostrar nada: alguém leria
 * tendência de uma operação que não foi medida.
 */
function SemDados({ titulo, texto }) {
  return (
    <div className="empty-state">
      <span className="icon-badge neutral" aria-hidden="true">
        <Icon name="metrics" size={20} />
      </span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
    </div>
  );
}

/* ==========================================================================
   Rosca de distribuição por quadrante
   ========================================================================== */

const TOTAL_QUADRANTES = quadrantes.reduce((soma, item) => soma + item.value, 0);
const RAIO = 48;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
// Folga entre fatias vizinhas: separa 4Q de 5Q mesmo para quem não distingue
// os dois vermelhos.
const FOLGA = 3;

const TOM_QUADRANTE = {
  success: styles.tomSuccess,
  info: styles.tomInfo,
  warning: styles.tomWarning,
  danger: styles.tomDanger,
  "danger-deep": styles.tomDangerDeep,
};

/* Cada fatia é um círculo com o traço cortado no tamanho dela; o deslocamento
   acumula o que veio antes, por isso a soma dos anteriores em vez de um
   acumulador mutável. Os dados são estáticos: calcula uma vez, no módulo. */
const FATIAS = quadrantes.map((quadrante, indice) => {
  const anteriores = quadrantes
    .slice(0, indice)
    .reduce((soma, item) => soma + item.value, 0);
  const comprimento = (quadrante.value / TOTAL_QUADRANTES) * CIRCUNFERENCIA;

  return {
    ...quadrante,
    traco: arredonda(Math.max(comprimento - FOLGA, 1)),
    resto: arredonda(CIRCUNFERENCIA - Math.max(comprimento - FOLGA, 1)),
    deslocamento: arredonda(-(anteriores / TOTAL_QUADRANTES) * CIRCUNFERENCIA),
  };
});

// `reduce` sem valor inicial estoura em array vazio, e a lista fica vazia
// enquanto o banco não responde. O `null` inicial evita isso.
const MAIOR_QUADRANTE = quadrantes.reduce(
  (atual, item) => (atual === null || item.value > atual.value ? item : atual),
  null
);

function GraficoQuadrantes() {
  if (quadrantes.length === 0) {
    return <SemDados titulo="Sem distribuição" texto="Depende das avaliações no banco." />;
  }

  return (
    <div className={styles.rosca}>
      <svg
        className={styles.roscaSvg}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Rosca da distribuição por quadrante: ${quadrantes
          .map((item) => `${item.label} com ${item.value}`)
          .join(", ")}.`}
      >
        {/* Começa às 12h em vez das 3h — leitura natural, sentido horário. */}
        <g transform="rotate(-90 60 60)">
          {FATIAS.map((fatia) => (
            <circle
              className={`${styles.fatia} ${TOM_QUADRANTE[fatia.tone]}`}
              cx="60"
              cy="60"
              key={fatia.key}
              r={RAIO}
              strokeDasharray={`${fatia.traco} ${fatia.resto}`}
              strokeDashoffset={fatia.deslocamento}
            />
          ))}
        </g>
        <text className={styles.roscaValor} textAnchor="middle" x="60" y="58">
          {MAIOR_QUADRANTE.value}
        </text>
        <text className={styles.roscaRotulo} textAnchor="middle" x="60" y="74">
          {MAIOR_QUADRANTE.label} · maior
        </text>
      </svg>

      {/* A legenda carrega rótulo e valor em texto: a cor da fatia é reforço
          visual, nunca o único canal de informação. */}
      <ul className={styles.roscaLegenda}>
        {quadrantes.map((quadrante) => (
          <li key={quadrante.key}>
            <span
              aria-hidden="true"
              className={`${styles.amostra} ${TOM_QUADRANTE[quadrante.tone]}`}
            />
            <span className={styles.roscaLegendaRotulo}>{quadrante.label}</span>
            <span className={styles.roscaLegendaValor}>{quadrante.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Status atual

   O chip precisa de texto: cor sozinha não comunica estado (WCAG 1.4.1). O
   ícone do chip é diferente do ícone da linha para não repetir o mesmo desenho
   duas vezes lado a lado.
   ========================================================================== */

const CHIP_POR_TOM = {
  warning: { rotulo: "Atenção", icone: "alert" },
  success: { rotulo: "Em dia", icone: "check" },
  info: { rotulo: "Resolvidas", icone: "info" },
  danger: { rotulo: "Crítico", icone: "alert" },
};

// O selo de ícone é próprio da tela em vez de `.icon-badge.<tom>`: a primitiva
// global não tem variante `info`, e a linha de Contestações ficaria laranja no
// meio de três linhas em tom semântico.
const TOM_LINHA = {
  warning: styles.linhaWarning,
  success: styles.linhaSuccess,
  info: styles.linhaInfo,
  danger: styles.linhaDanger,
};

export default function DashboardPage() {
  return (
    <AppShell active="Dashboard" breadcrumb="Visão geral > Dashboard">
      <section className="page-header">
        <div>
          <h1>Qualidade da Operação</h1>
        </div>
      </section>

      <div className={styles.painel}>
        <section className="grid kpi-grid" aria-label="Indicadores do mês">
          {dashboardKpis.map((kpi) => (
            <KpiCard
              badge={kpi.badge}
              icon={kpi.icon}
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
            />
          ))}
        </section>

        <div className={styles.faixa}>
          <section className={`card ${styles.cartao}`} aria-labelledby="titulo-evolucao">
            <div className="section-head">
              <h2 id="titulo-evolucao">Evolução de Avaliações e Qualidade</h2>

              <ul className={styles.legenda}>
                {evolucao.series.map((serie) => (
                  <li className={ESTILO_SERIE[serie.key]} key={serie.key}>
                    <span
                      aria-hidden="true"
                      className={`${styles.marca} ${MARCA_SERIE[serie.key]}`}
                    />
                    {serie.label} ({serie.axis === "left" ? "eixo esquerdo" : "eixo direito"})
                  </li>
                ))}
              </ul>
            </div>

            <GraficoEvolucao />
          </section>

          <section
            className={`card ${styles.cartao} ${styles.cartaoQuadrantes}`}
            aria-labelledby="titulo-quadrantes"
          >
            <div className="section-head">
              <h2 id="titulo-quadrantes">Distribuição por Quadrante</h2>
            </div>

            <GraficoQuadrantes />
          </section>
        </div>

        <div className={styles.faixa}>
          <section className={`card ${styles.cartaoBaixo}`} aria-labelledby="titulo-ofensores">
            <div className="section-head">
              <h2 id="titulo-ofensores">Top 10 Ofensores (Critérios com Mais Falhas)</h2>
            </div>

            <div className={styles.corpoCentral}>
              {topOfensores.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge neutral" aria-hidden="true">
                    <Icon name="checklist" size={20} />
                  </span>
                  <h3>Nenhum ofensor identificado</h3>
                  <p>
                    Nenhum critério acumulou reprovações no período. Assim que houver falhas, os
                    dez critérios mais recorrentes aparecem aqui.
                  </p>
                </div>
              ) : (
                <ul className={`list ${styles.ofensores}`}>
                  {topOfensores.map((ofensor) => (
                    <li className="row" key={ofensor.nome}>
                      <span className="row-main">
                        <span className="row-title">{ofensor.nome}</span>
                      </span>
                      <span className="score danger">
                        {ofensor.falhas}
                        <span className="sr-only"> falhas</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={`card ${styles.cartaoBaixo}`} aria-labelledby="titulo-status">
            <div className="section-head">
              <h2 id="titulo-status">Status Atual</h2>
            </div>

            <ul className={styles.statusLista}>
              {statusAtual.map((item) => {
                const chip = CHIP_POR_TOM[item.tone];
                const critico = item.tone === "danger";

                return (
                  <li
                    className={`${styles.statusItem} ${TOM_LINHA[item.tone]} ${
                      critico ? styles.statusCritico : ""
                    }`}
                    key={item.label}
                  >
                    <span className={styles.statusIcone} aria-hidden="true">
                      <Icon name={item.icon} size={15} />
                    </span>

                    <span className={styles.statusTexto}>
                      <strong>{item.label}</strong>
                      {/* Sem contagem, diz que não há contagem — não inventa. */}
                      <span>{item.detail ?? "Sem dados no período"}</span>
                    </span>

                    <span className={`chip ${item.tone}`}>
                      <Icon name={chip.icone} size={12} />
                      {chip.rotulo}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
