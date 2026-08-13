"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { acoesRapidas, formulariosKpis, formulariosRecentes } from "@/data/seed";
import styles from "./page.module.css";

/**
 * Compara ignorando acentos e caixa: quem digita "formulario" precisa achar
 * "Formulário", senão a busca parece quebrada.
 */
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function rotuloCampanhas(quantidade) {
  return `${quantidade} ${quantidade === 1 ? "campanha" : "campanhas"}`;
}

export default function FormulariosPage() {
  const [busca, setBusca] = useState("");

  // A busca do cabeçalho filtra a lista de recentes de verdade. Campo que não
  // faz nada é pior do que campo nenhum: o usuário tenta, não entende e desiste.
  const recentesFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return formulariosRecentes;
    return formulariosRecentes.filter((form) => normalizar(form.nome).includes(termo));
  }, [busca]);

  return (
    <AppShell active="Formulários" breadcrumb="Qualidade > Formulários">
      <section className="page-header">
        <div>
          <h1>Formulários</h1>
          <p>Gerencie Formulários e avaliações</p>
        </div>

        <div className="actions">
          {/* Busca desta tela, não a global da topbar: filtra ao digitar, sem
              botão de enviar, por isso não é um <form>. */}
          <div className={`search-field ${styles.busca}`}>
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="busca-formularios">
              Buscar Formulários
            </label>
            <input
              className="input"
              id="busca-formularios"
              type="search"
              placeholder="Buscar Formulários..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="indicadores-formularios">
        <h2 className="sr-only" id="indicadores-formularios">
          Indicadores dos Formulários
        </h2>

        <ul className="grid kpi-grid">
          {formulariosKpis.map((kpi) => (
            <li className={`card ${styles.kpi}`} key={kpi.id}>
              <div className={styles.kpiTopo}>
                <strong className="metric-value">{kpi.value}</strong>
                <span className="icon-badge">
                  <Icon name={kpi.icon} size={18} />
                </span>
              </div>
              <p className={styles.kpiTitulo}>{kpi.label}</p>
              <p className="metric-note">{kpi.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card pad" aria-labelledby="acoes-rapidas">
        <div className="section-head">
          <div>
            <h2 id="acoes-rapidas">Ações Rápidas</h2>
            <p>Acesse rapidamente as principais funcionalidades dos Formulários</p>
          </div>
        </div>

        <ul className={styles.acoesGrid}>
          {acoesRapidas.map((acao) => (
            <li key={acao.id}>
              <Link className={styles.acao} href={acao.href}>
                <span className={styles.acaoTopo}>
                  <span className="icon-badge">
                    <Icon name={acao.icon} size={18} />
                  </span>
                  <Icon className={styles.acaoSeta} name="chevronRight" size={16} />
                </span>
                <strong>{acao.titulo}</strong>
                <span className={styles.acaoDetalhe}>{acao.detalhe}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card pad" aria-labelledby="formularios-recentes">
        <div className={`section-head ${styles.cabecalhoComBotao}`}>
          <div>
            <h2 id="formularios-recentes">Formulários Recentes</h2>
            <p>Últimos Formulários criados e utilizados</p>
          </div>
          <Link className="btn primary" href="/formularios/novo">
            <Icon name="plus" size={16} />
            Novo Formulário
          </Link>
        </div>

        {recentesFiltrados.length > 0 ? (
          <ul className="list">
            {recentesFiltrados.map((form) => (
              <li key={form.id}>
                <Link className="row" href={`/formularios/${form.id}`}>
                  <span className="row-main">
                    <span className="row-title">{form.nome}</span>
                  </span>
                  <span className={styles.linhaFim}>
                    <span className="chip">{rotuloCampanhas(form.campanhas)}</span>
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="search" size={20} />
            </span>
            <h3>Nenhum Formulário encontrado</h3>
            <p>
              Nada corresponde a “{busca}”. Revise o termo ou limpe a busca para ver todos
              os Formulários recentes.
            </p>
            <div className="btn-row">
              <button className="btn" type="button" onClick={() => setBusca("")}>
                <Icon name="undo" size={16} />
                Limpar busca
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
