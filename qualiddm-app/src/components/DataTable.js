"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";

/**
 * Tabela de dados com ordenação e paginação.
 *
 * Pagina em vez de rolar: a exigência do produto é que nenhuma tela precise de
 * scroll, então a tabela mostra `pageSize` linhas e troca de página. Aumentar o
 * pageSize aqui é o caminho errado — quem precisa de mais linhas exporta.
 *
 * columns: { key, label, align?: "num", sortable?, render?(row), sortValue?(row) }
 */
export default function DataTable({
  caption,
  columns,
  rows,
  pageSize = 8,
  initialSort = null,
  rowHref = null,
  emptyMessage = "Nenhum registro encontrado.",
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;

    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;

    const read = column.sortValue ?? ((row) => row[column.key]);
    const direction = sort.direction === "desc" ? -1 : 1;

    // Copia antes de ordenar: `rows` pode ser um array vindo de props/cache.
    // Ordenar no lugar mutaria a prop e faria o React perder a referência.
    return [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }

      return String(left).localeCompare(String(right), "pt-BR", { numeric: true }) * direction;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  function toggleSort(key) {
    setPage(0);
    setSort((previous) => {
      if (previous?.key !== key) return { key, direction: "asc" };
      if (previous.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <span className="icon-badge neutral" aria-hidden="true">
          <Icon name="filter" size={18} />
        </span>
        <h3>Sem resultados</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-block">
      <div className="table-scroll">
        <table className="data-table">
          {caption ? <caption>{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const ariaSort = active
                  ? sort.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.align === "num" ? "num" : undefined}
                    aria-sort={column.sortable ? ariaSort : undefined}
                  >
                    {column.sortable ? (
                      <button className="th-sort" type="button" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <Icon
                          name={active && sort.direction === "desc" ? "chevronDown" : "chevronUp"}
                          size={12}
                          className={active ? "th-sort-icon on" : "th-sort-icon"}
                        />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {slice.map((row, index) => {
              const href = rowHref?.(row) ?? null;

              return (
                <tr key={row.id ?? index}>
                  {columns.map((column, columnIndex) => {
                    const content = column.render ? column.render(row) : row[column.key];
                    const className = column.align === "num" ? "num" : undefined;

                    // O link fica na primeira célula: uma linha inteira como <a>
                    // quebra a semântica da tabela para o leitor de tela.
                    if (columnIndex === 0 && href) {
                      return (
                        <td className={className} key={column.key}>
                          <Link className="table-link" href={href}>
                            {content}
                          </Link>
                        </td>
                      );
                    }

                    return (
                      <td className={className} key={column.key}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav className="pagination" aria-label="Paginação da tabela">
          <button
            className="btn ghost"
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
          >
            <Icon name="chevronLeft" size={16} />
            Anterior
          </button>

          <span aria-live="polite">
            Página {current + 1} de {pageCount}
            <span className="sr-only"> — {sorted.length} registros no total</span>
          </span>

          <button
            className="btn ghost"
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
          >
            Próxima
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
