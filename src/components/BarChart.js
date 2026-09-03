/**
 * Gráfico de barras da qualidade diária.
 *
 * Acessibilidade: as barras são puramente visuais (aria-hidden). Os dados vão
 * numa tabela para leitor de tela — antes o aria-label ficava num <div> sem
 * role, o que não era anunciado, e o `title` das barras não alcança teclado.
 */
export default function BarChart({ values, label = "Qualidade por dia" }) {
  const total = values.length;
  const media = Math.round(values.reduce((sum, v) => sum + v, 0) / total);
  const melhor = Math.max(...values);
  const pior = Math.min(...values);

  return (
    <figure>
      <figcaption className="sr-only">
        {`${label}: ${total} dias. Média ${media}%, melhor dia ${melhor}%, pior dia ${pior}%.`}
      </figcaption>

      {/* Gráfico largo rola no próprio container; o body nunca rola na
          horizontal. tabindex=0 porque container com rolagem precisa ser
          alcançável pelo teclado. */}
      <div className="scroll-x" tabIndex={0} role="group" aria-label={`${label} (gráfico)`}>
        <div className="bar-chart" aria-hidden="true">
          {values.map((value, index) => (
            <span
              className="bar"
              key={`dia-${index + 1}`}
              style={{ "--h": `${value}%` }}
            />
          ))}
        </div>
      </div>

      <table className="data-table sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th className="num" scope="col">Qualidade</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={`linha-${index + 1}`}>
              <th scope="row">{`Dia ${index + 1}`}</th>
              <td className="num">{`${value}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
