import { Icon } from "./icons";

export default function FeedbackCard({
  insights,
  confidence = "92%",
  summary = "A chamada tem boa condução, mas precisa de reforço no encerramento para garantir protocolo, prazo e rastreabilidade.",
}) {
  return (
    <article className="feedback-card" aria-labelledby="feedback-titulo">
      <div className="confidence">
        <div>
          <p className="eyebrow">Sugestão da IA</p>
          <h2 id="feedback-titulo">Feedback recomendado</h2>
        </div>
        <strong>
          {confidence}
          <span className="sr-only"> de confiança da IA</span>
        </strong>
      </div>

      <p>{summary}</p>

      {/* Insights são itens de lista, não <strong> soltos dentro de .row. */}
      <ul className="insight-list">
        {insights.map((insight) => (
          <li key={insight}>
            <Icon name="sparkles" size={16} />
            <span>{insight}</span>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn primary" type="button">
          <Icon name="check" size={17} />
          Aplicar feedback
        </button>
        <button className="btn" type="button">
          <Icon name="edit" size={17} />
          Editar
        </button>
      </div>
    </article>
  );
}
