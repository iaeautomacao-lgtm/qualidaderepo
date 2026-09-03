"use client";

import { Icon } from "./icons";

/**
 * Barra de filtros das telas de listagem.
 *
 * Estado mora na página (fonte única); aqui só renderiza e avisa a mudança.
 * filters: { key, label, options: [{ value, label }] }
 */
export default function FilterBar({ filters, value, onChange, onReset, searchable = true }) {
  const dirty = Object.entries(value).some(([key, item]) => {
    if (key === "q") return Boolean(item);
    return item !== "todos";
  });

  return (
    <div className="filter-bar">
      {searchable ? (
        <div className="search-field filter-search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="filtro-busca">
            Buscar na lista
          </label>
          <input
            className="input"
            id="filtro-busca"
            type="search"
            placeholder="Buscar..."
            value={value.q ?? ""}
            onChange={(event) => onChange({ ...value, q: event.target.value })}
          />
        </div>
      ) : null}

      {filters.map((filter) => (
        <div className="field filter-field" key={filter.key}>
          <label htmlFor={`filtro-${filter.key}`}>{filter.label}</label>
          <select
            className="select"
            id={`filtro-${filter.key}`}
            value={value[filter.key] ?? "todos"}
            onChange={(event) => onChange({ ...value, [filter.key]: event.target.value })}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Só aparece quando há o que limpar — botão morto polui a barra. */}
      {dirty ? (
        <button className="btn ghost filter-reset" type="button" onClick={onReset}>
          <Icon name="undo" size={16} />
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
