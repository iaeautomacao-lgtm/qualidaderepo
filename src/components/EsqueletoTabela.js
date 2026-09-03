/**
 * Esqueleto de carregamento no formato da tabela que vai substituí-lo.
 *
 * Existe para o layout não pular: reserva a mesma altura de linha que os dados
 * reais vão ocupar. Um spinner centralizado no lugar da tabela encolheria o
 * card e empurraria tudo abaixo dele quando a resposta chegasse.
 *
 * `aria-hidden`: o leitor de tela não deve narrar barras cinzas. Quem anuncia o
 * carregamento é a região viva da tela, com texto.
 */
export default function EsqueletoTabela({ colunas, linhas = 8 }) {
  return (
    <div aria-hidden="true" style={{ display: "grid", gap: "var(--sp-3)" }}>
      {Array.from({ length: linhas }, (_, linha) => (
        <div
          key={linha}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
            gap: "var(--sp-3)",
          }}
        >
          {Array.from({ length: colunas }, (_, coluna) => (
            <span
              className="skeleton"
              key={coluna}
              style={{ height: "18px", width: coluna === 0 ? "80%" : "100%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
