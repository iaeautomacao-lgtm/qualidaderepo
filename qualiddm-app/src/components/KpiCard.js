import { Icon } from "./icons";
import styles from "./KpiCard.module.css";

/**
 * Cartão de indicador da faixa superior das telas (Dashboard e Clientes).
 *
 * Layout horizontal (ícone à esquerda, número à direita) em vez de empilhado:
 * economiza ~30px de altura por faixa, e as duas telas precisam caber inteiras
 * em 900px sem rolagem.
 *
 * `MetricsWidget` não serve aqui: ele espera `trend`/`note` (variação no
 * período), e estes indicadores carregam um selo de recorte (`badge`), que é
 * outra informação.
 */
export default function KpiCard({ badge, value, label, icon }) {
  // Indicador sem valor mostra travessão, e não zero: zero é uma medição
  // ("nenhuma avaliação"), travessão é a ausência dela ("ainda não medido").
  const semValor = value == null || value === "";

  return (
    <article className={`card ${styles.kpi}`}>
      <span className="icon-badge" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>

      <div className={styles.corpo}>
        {badge ? <span className={`chip ${styles.selo}`}>{badge}</span> : null}
        <p className={styles.valor}>
          {semValor ? (
            <span aria-label="sem dados">
              —<span className="sr-only"> sem dados</span>
            </span>
          ) : (
            value
          )}
        </p>
        <p className={styles.rotulo}>{label}</p>
      </div>
    </article>
  );
}
