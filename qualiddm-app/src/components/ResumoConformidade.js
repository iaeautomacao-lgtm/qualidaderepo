import { Icon } from "./icons";
import styles from "./ResumoConformidade.module.css";

/**
 * Resumo de Conformidade — os quatro números grandes da ficha.
 *
 * Compartilhado entre a ficha de monitoria e os detalhes da avaliação IA, que
 * recebem o mesmo objeto `{ conformes, naoConformes, naoAplicaveis, total }`.
 *
 * `total` não é recalculado a partir dos outros três: o backend é a fonte da
 * verdade e uma soma local esconderia divergência de dados em vez de mostrá-la.
 */
export default function ResumoConformidade({
  resumo,
  titulo = "Resumo de Conformidade",
  nivelTitulo = 2,
  pesos,
}) {
  const Titulo = `h${Math.min(Math.max(nivelTitulo, 2), 6)}`;

  if (!resumo) {
    return (
      <section className="card pad">
        <Titulo className={styles.titulo}>{titulo}</Titulo>
        <div className="empty-state">
          <span className="icon-badge">
            <Icon name="checklist" size={20} />
          </span>
          <h3>Conformidade ainda não calculada</h3>
          <p>Esta avaliação não trouxe o resumo de critérios conformes.</p>
        </div>
      </section>
    );
  }

  const numero = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);
  const itens = [
    { rotulo: "Conformes", valor: numero(resumo.conformes), tom: "success" },
    { rotulo: "Não Conformes", valor: numero(resumo.naoConformes), tom: "danger" },
    { rotulo: "Não Aplicáveis", valor: numero(resumo.naoAplicaveis), tom: "warning" },
    { rotulo: "Total", valor: numero(resumo.total), tom: "neutro" },
  ];

  const pontosValidos =
    pesos && Number.isFinite(Number(pesos.total)) && Number(pesos.total) > 0;

  return (
    <section className="card pad">
      <Titulo className={styles.titulo}>{titulo}</Titulo>

      <dl className={styles.grade}>
        {itens.map((item) => (
          <div className={styles.item} data-tom={item.tom} key={item.rotulo}>
            {/* dt antes de dd no DOM (exigência do <dl>); o CSS inverte a ordem
                visual para o número ficar acima do rótulo, como no QualiTalk. */}
            <dt className={styles.rotulo}>{item.rotulo}</dt>
            <dd className={styles.valor}>{item.valor}</dd>
          </div>
        ))}
      </dl>

      {pontosValidos ? (
        <p className={styles.pontos}>
          Pontuação obtida: <strong>{numero(pesos.obtido)}</strong> de{" "}
          <strong>{numero(pesos.total)}</strong> pontos possíveis.
        </p>
      ) : null}
    </section>
  );
}
