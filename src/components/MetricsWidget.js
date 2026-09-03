import { Icon } from "./icons";

export default function MetricsWidget({ metric }) {
  return (
    <article className={`card metric ${metric.down ? "needs-attention" : ""}`}>
      <div className="card-top">
        <h3 className="metric-label">
          <span className="icon-badge sm">
            <Icon name={metric.icon} size={16} />
          </span>
          {metric.label}
        </h3>

        {/* Direção nunca vai só na cor: acompanha seta + texto para leitor
            de tela (WCAG 1.4.1). */}
        <span className={`trend ${metric.down ? "down" : ""}`}>
          <Icon name={metric.down ? "trendDown" : "trendUp"} size={13} />
          {metric.trend}
          <span className="sr-only">
            {metric.down ? " de queda" : " de alta"} no período
          </span>
        </span>
      </div>

      <p className="metric-value">{metric.value}</p>
      <p className="metric-note">{metric.note}</p>
    </article>
  );
}
