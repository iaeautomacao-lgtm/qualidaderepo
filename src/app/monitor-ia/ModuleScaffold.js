import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

export function MonitorIaPageShell({ children, title, subtitle, eyebrow = "Monitor IA", actions = null }) {
  return (
    <AppShell active="Monitor IA" breadcrumb={`Qualidade > Monitor IA > ${title}`}>
      <section className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="actions">
          {actions}
          <Link className="btn" href="/monitor-ia">
            <Icon name="chevronLeft" size={16} />
            Voltar
          </Link>
        </div>
      </section>
      <div className={styles.painel}>{children}</div>
    </AppShell>
  );
}

export function ModuleKpis({ items }) {
  return (
    <section className="grid kpi-grid" aria-label="Indicadores">
      {items.map((item) => (
        <article className="card pad" key={item.label}>
          <span className="icon-badge" aria-hidden="true"><Icon name={item.icon || "metrics"} size={18} /></span>
          <p className={styles.kpiValue}>{item.value}</p>
          <p className={styles.kpiLabel}>{item.label}</p>
        </article>
      ))}
    </section>
  );
}

export function FilterBar({ children }) {
  return <section className={`card pad ${styles.filterBar}`}>{children}</section>;
}

export function StatusDot({ tone = "success", label }) {
  return <span className={styles.statusDot} data-tone={tone}>{label}</span>;
}

export function SimpleTable({ columns, rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}