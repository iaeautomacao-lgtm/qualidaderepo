"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

const ACOES = [
  {
    id: "cadastro",
    titulo: "Gerenciamento de Formulários",
    detalhe: "Crie, edite e configure os Formulários de avaliação",
    icon: "plus",
    tom: "blue",
    href: "/formularios/novo",
  },
  {
    id: "iniciar",
    titulo: "Iniciar avaliação",
    detalhe: "Inicie uma nova avaliação de monitoria",
    icon: "play",
    tom: "green",
    href: "/formularios/iniciar",
  },
  {
    id: "avaliacoes",
    titulo: "Visualizar avaliações",
    detalhe: "Acesse e gerencie avaliações realizadas",
    icon: "checklist",
    tom: "purple",
    href: "/avaliacoes",
  },
  {
    id: "dashboard",
    titulo: "Dashboard de Formulários",
    detalhe: "Análises e métricas das avaliações aplicadas",
    icon: "metrics",
    tom: "orange",
    href: "/dashboard-formularios",
  },
];

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

function formatarData(valor) {
  if (!valor) return "N/A";
  const [data] = String(valor).split(/[ T]/);
  const [ano, mes, dia] = data.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : String(valor);
}

export default function FormulariosPage() {
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState({ kpis: null, recentes: [], monitoriasIa: [] });
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarFormularios() {
      try {
        const [respostaFormularios, respostaAvaliacoes] = await Promise.all([
          fetch("/api/formularios", { cache: "no-store" }),
          fetch("/api/avaliacoes?limit=8", { cache: "no-store" }),
        ]);
        const [payloadFormularios, payloadAvaliacoes] = await Promise.all([
          respostaFormularios.json().catch(() => null),
          respostaAvaliacoes.json().catch(() => null),
        ]);
        if (!respostaFormularios.ok || !payloadFormularios?.ok) {
          throw new Error(payloadFormularios?.error?.message || "Não foi possível carregar formulários do banco.");
        }
        if (ativo) {
          setDados({
            ...payloadFormularios.data,
            monitoriasIa: respostaAvaliacoes.ok && payloadAvaliacoes?.ok ? payloadAvaliacoes.data.avaliacoes || [] : [],
          });
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setDados({ kpis: null, recentes: [], monitoriasIa: [] });
          setErro(error.message);
        }
      }
    }

    carregarFormularios();

    return () => {
      ativo = false;
    };
  }, []);

  const formulariosKpis = [
    {
      id: "total",
      label: "Total de Formulários",
      detail: `${dados.kpis?.ativos ?? 0} ativos`,
      value: dados.kpis?.total ?? 0,
      icon: "review",
      tom: "blue",
    },
    {
      id: "ativos",
      label: "Formulários Ativos",
      detail: "Prontos para avaliação",
      value: dados.kpis?.ativos ?? 0,
      icon: "checkCircle",
      tom: "green",
    },
    {
      id: "desenvolvimento",
      label: "Em Desenvolvimento",
      detail: "Aguardando configuração",
      value: dados.kpis?.desenvolvimento ?? 0,
      icon: "clock",
      tom: "yellow",
    },
    {
      id: "questoes",
      label: "Total de Questões",
      detail: "Critérios de avaliação",
      value: dados.kpis?.questoes ?? 0,
      icon: "trendUp",
      tom: "purple",
    },
  ];

  const recentesFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return dados.recentes;
    return dados.recentes.filter((form) => normalizar(form.nome).includes(termo));
  }, [busca, dados.recentes]);

  const monitoriasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    const monitorias = dados.monitoriasIa || [];
    if (!termo) return monitorias;
    return monitorias.filter((item) =>
      [item.id, item.formulario, item.cliente, item.campanha, item.codGravacao].some((campo) =>
        normalizar(campo || "").includes(termo),
      ),
    );
  }, [busca, dados.monitoriasIa]);

  return (
    <AppShell active="Formulários" breadcrumb="Qualidade > Formulários">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <span className="icon-badge neutral" aria-hidden="true">
            <Icon name="review" size={18} />
          </span>
          <div>
            <h1>Formulários</h1>
            <p>Gerencie Formulários e avaliações</p>
          </div>
        </div>

        <div className="actions">
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

        <ul className={styles.kpiGrid}>
          {formulariosKpis.map((kpi) => (
            <li className={`card ${styles.kpi}`} key={kpi.id}>
              <div className={styles.kpiTopo}>
                <span className={styles.kpiIcone} data-tom={kpi.tom}>
                  <Icon name={kpi.icon} size={20} />
                </span>
                <strong className="metric-value">{kpi.value}</strong>
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
          {ACOES.map((acao) => (
            <li key={acao.id}>
              <Link className={styles.acao} href={acao.href}>
                <span className={styles.acaoTopo}>
                  <span className={styles.acaoIcone} data-tom={acao.tom}>
                    <Icon name={acao.icon} size={22} />
                  </span>
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

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="error" size={20} />
            </span>
            <h3>Não foi possível carregar os formulários</h3>
            <p>{erro}</p>
          </div>
        ) : recentesFiltrados.length > 0 ? (
          <ul className={styles.formList}>
            {recentesFiltrados.map((form) => (
              <li key={form.id}>
                <Link className={styles.formRow} href={`/formularios/${form.id}`}>
                  <span className={styles.formIcone}>
                    <Icon name="review" size={18} />
                  </span>
                  <span className={styles.formMain}>
                    <strong>{form.nome}</strong>
                    <span>
                      <span className="chip neutral">{String(form.versao).padStart(2, "0")}</span>
                      <span>{form.questoes} Questões</span>
                      <span>Criado: {formatarData(form.criadoEm)}</span>
                    </span>
                  </span>
                  <span className={styles.linhaFim}>
                    <strong>{rotuloCampanhas(form.campanhas)}</strong>
                    <span className={form.status === "ativo" ? "chip success" : "chip warning"}>
                      {form.status === "ativo" ? "Ativo" : form.status}
                    </span>
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
            <p>Nada corresponde a “{busca}”.</p>
          </div>
        )}
      </section>

      <section className="card pad" aria-labelledby="monitorias-ia-recentes">
        <div className={`section-head ${styles.cabecalhoComBotao}`}>
          <div>
            <h2 id="monitorias-ia-recentes">Monitorias IA recentes</h2>
            <p>Análises geradas por upload, já disponíveis para revisão e gestão</p>
          </div>
          <Link className="btn" href="/avaliacoes">
            <Icon name="checklist" size={16} />
            Ver avaliações
          </Link>
        </div>

        {monitoriasFiltradas.length > 0 ? (
          <ul className={styles.formList}>
            {monitoriasFiltradas.map((item) => (
              <li key={item.id}>
                <Link className={styles.formRow} href={item.href || `/avaliacoes/${item.id}`}>
                  <span className={styles.formIcone}>
                    <Icon name="sparkles" size={18} />
                  </span>
                  <span className={styles.formMain}>
                    <strong>{item.codGravacao || item.id}</strong>
                    <span>
                      <span className="chip warning">IA</span>
                      <span>{item.cliente}</span>
                      <span>{item.campanha}</span>
                      <span>{item.dataFormatada}</span>
                    </span>
                  </span>
                  <span className={styles.linhaFim}>
                    <strong>Nota {item.score}</strong>
                    {item.confianca != null ? <span className="chip success">{item.confianca}% confiança</span> : null}
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="sparkles" size={20} />
            </span>
            <h3>Nenhuma monitoria IA encontrada</h3>
            <p>As análises aparecem aqui depois que o upload é processado com o Gemini.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
