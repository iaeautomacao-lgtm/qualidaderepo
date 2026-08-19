"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import GraficoLinha from "@/components/GraficoLinha";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import styles from "./page.module.css";

/**
 * Dashboard de Formulários — análises e métricas das avaliações aplicadas.
 *
 * Era o card "Relatórios" dentro do painel de Formulários; virou aba própria
 * porque medir o resultado dos formulários é rotina de gestão, não um atalho
 * escondido dentro do cadastro.
 *
 * Reusa `/api/dashboard`, que já agrega as duas fontes de monitoria com os
 * mesmos filtros. Uma segunda agregação faria esta tela discordar do Dashboard
 * principal sobre o mesmo período.
 */

const PERIODOS = [
  { value: "monthly", label: "Últimos 31 dias" },
  { value: "weekly", label: "Últimos 7 dias" },
];

const TODOS = "todos";
const META_PADRAO = 90;

function decimal(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(1).replace(".", ",") : "0,0";
}

function duracao(segundos) {
  const total = Math.max(0, Number(segundos || 0));
  return `${Math.floor(total / 60)} min`;
}

function dia(valor) {
  const [data] = String(valor || "").split(/[ T]/);
  const [ano, mes, numeroDia] = data.split("-");
  return numeroDia && mes && ano ? `${numeroDia}/${mes}` : String(valor);
}

export default function DashboardFormulariosPage() {
  const [filtros, setFiltros] = useState({
    period: "monthly",
    clienteId: TODOS,
    campanhaId: TODOS,
    operadorId: TODOS,
  });
  const [opcoes, setOpcoes] = useState({ clientes: [], campanhas: [], avaliados: [] });

  useEffect(() => {
    let ativo = true;
    fetch("/api/relatorios/opcoes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (payload?.ok && ativo) {
          setOpcoes({
            clientes: payload.data?.clientes ?? [],
            campanhas: payload.data?.campanhas ?? [],
            avaliados: payload.data?.avaliados ?? [],
          });
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const consulta = useMemo(() => {
    const busca = new URLSearchParams({ period: filtros.period });
    for (const chave of ["clienteId", "campanhaId", "operadorId"]) {
      if (filtros[chave] !== TODOS) busca.set(chave, filtros[chave]);
    }
    return `/api/dashboard?${busca}`;
  }, [filtros]);

  const { dados, carregando, erro, recarregar } = useRecurso(consulta);

  const kpis = dados?.kpis ?? {};
  const ofensores = dados?.offenders ?? [];
  const faixas = dados?.quadrants ?? [];
  const totalFaixas = faixas.reduce((soma, faixa) => soma + Number(faixa.value || 0), 0);
  const maiorOfensor = Math.max(1, ...ofensores.map((item) => Number(item.failures || 0)));

  const campanhasVisiveis = useMemo(() => {
    if (filtros.clienteId === TODOS) return opcoes.campanhas;
    return opcoes.campanhas.filter(
      (campanha) => campanha.clienteId == null || campanha.clienteId === filtros.clienteId,
    );
  }, [opcoes.campanhas, filtros.clienteId]);

  const filtroAtivo = ["clienteId", "campanhaId", "operadorId"].some((chave) => filtros[chave] !== TODOS);
  const atingimento = Math.min(100, Math.round(((Number(kpis.averageScore) || 0) / META_PADRAO) * 100));

  const serie = (dados?.qualityByDay ?? []).map((ponto) => ({
    rotulo: dia(ponto.day),
    valor: Number(ponto.score ?? 0),
    volume: Number(ponto.reviews ?? 0),
  }));

  function alterar(chave, valor) {
    setFiltros((atual) =>
      chave === "clienteId"
        ? { ...atual, clienteId: valor, campanhaId: TODOS }
        : { ...atual, [chave]: valor },
    );
  }

  return (
    <AppShell active="Dashboard de Formulários" breadcrumb="Formulários > Dashboard">
      <section className={styles.cabecalho}>
        <div className={styles.cabecalhoIdent}>
          <span className={styles.marca} aria-hidden="true">
            <Icon name="metrics" size={22} />
          </span>
          <div>
            <h1>Dashboard de Formulários</h1>
            <p>Análises e métricas das avaliações aplicadas.</p>
          </div>
        </div>

        <div className={styles.cabecalhoAcoes}>
          <Link className="btn" href="/formularios">
            <Icon name="checklist" size={16} />
            Painel de formulários
          </Link>
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon className={carregando ? "spinning" : undefined} name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
        </div>
      </section>

      <section className={`card pad ${styles.filtros}`} aria-labelledby="filtros-dashboard">
        <div className="section-head">
          <div>
            <h2 id="filtros-dashboard">Filtros do dashboard</h2>
            <p>O recorte vale para todos os blocos da tela.</p>
          </div>
          {filtroAtivo ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                setFiltros((atual) => ({ ...atual, clienteId: TODOS, campanhaId: TODOS, operadorId: TODOS }))
              }
            >
              <Icon name="undo" size={16} />
              Limpar filtros
            </button>
          ) : null}
        </div>

        <div className={styles.filtrosGrade}>
          <div className="field">
            <label htmlFor="df-periodo">Período</label>
            <select
              className="select"
              id="df-periodo"
              value={filtros.period}
              onChange={(evento) => alterar("period", evento.target.value)}
            >
              {PERIODOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="df-operacao">Operação</label>
            <select
              className="select"
              id="df-operacao"
              value={filtros.clienteId}
              onChange={(evento) => alterar("clienteId", evento.target.value)}
            >
              <option value={TODOS}>Todas as operações</option>
              {opcoes.clientes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="df-campanha">Campanha</label>
            <select
              className="select"
              id="df-campanha"
              value={filtros.campanhaId}
              onChange={(evento) => alterar("campanhaId", evento.target.value)}
            >
              <option value={TODOS}>Todas as campanhas</option>
              {campanhasVisiveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="df-avaliado">Avaliado</label>
            <select
              className="select"
              id="df-avaliado"
              value={filtros.operadorId}
              onChange={(evento) => alterar("operadorId", evento.target.value)}
            >
              <option value={TODOS}>Todos os avaliados</option>
              {opcoes.avaliados.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {erro ? (
        <p className="alert danger">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Não foi possível carregar as métricas</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      <section className={styles.kpis} aria-label="Indicadores das avaliações">
        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Total de avaliações</p>
          <p className={styles.kpiValor}>{carregando && !dados ? "—" : (kpis.reviews ?? 0)}</p>
          <p className={styles.kpiNota}>{PERIODOS.find((item) => item.value === filtros.period)?.label}</p>
        </article>

        <article className={styles.kpi} data-tom="accent">
          <p className={styles.kpiRotulo}>Score médio</p>
          <p className={styles.kpiValor}>{carregando && !dados ? "—" : decimal(kpis.averageScore)}</p>
          <span
            className="progress-track"
            role="img"
            aria-label={`${atingimento}% da meta de ${META_PADRAO}`}
          >
            <span className="progress-bar" style={{ "--w": `${atingimento}%` }} />
          </span>
          <p className={styles.kpiNota}>Meta: {META_PADRAO}</p>
        </article>

        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Não conformidades</p>
          <p className={styles.kpiValor}>{carregando && !dados ? "—" : (kpis.nonConformities ?? 0)}</p>
          <p className={styles.kpiNota}>{ofensores.length} critério(s) ofensor(es)</p>
        </article>

        <article className={styles.kpi} data-tom={(kpis.criticalReviews ?? 0) > 0 ? "danger" : undefined}>
          <p className={styles.kpiRotulo}>Avaliações críticas</p>
          <p className={styles.kpiValor}>{carregando && !dados ? "—" : (kpis.criticalReviews ?? 0)}</p>
          <p className={styles.kpiNota}>zeradas por critério eliminatório</p>
        </article>

        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Tempo médio</p>
          <p className={styles.kpiValor}>{carregando && !dados ? "—" : duracao(kpis.averageDurationSeconds)}</p>
          <p className={styles.kpiNota}>por avaliação</p>
        </article>
      </section>

      <div className={styles.duasColunas}>
        <section className="card pad" aria-labelledby="df-evolucao">
          <div className="section-head">
            <div>
              <h2 id="df-evolucao">Evolução do score</h2>
              <p>Nota média por dia no recorte selecionado.</p>
            </div>
          </div>

          {serie.length > 0 ? (
            <GraficoLinha pontos={serie} titulo="Score médio por dia" />
          ) : (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="metrics" size={20} />
              </span>
              <h3>Sem série no recorte</h3>
              <p>Ajuste os filtros ou aguarde novas avaliações.</p>
            </div>
          )}
        </section>

        <section className="card pad" aria-labelledby="df-faixas">
          <div className="section-head">
            <div>
              <h2 id="df-faixas">Distribuição por faixa</h2>
              <p>Avaliações por faixa de nota.</p>
            </div>
          </div>

          {totalFaixas > 0 ? (
            <ul className={styles.faixas}>
              {faixas.map((faixa) => (
                <li data-tom={faixa.tom} key={faixa.label}>
                  <span className={styles.faixaMarca} aria-hidden="true" />
                  <span className={styles.faixaNome}>{faixa.label}</span>
                  <span className={styles.faixaValor}>
                    <strong>{faixa.value}</strong>
                    <small>{Math.round((Number(faixa.value || 0) / totalFaixas) * 100)}%</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="gauge" size={20} />
              </span>
              <h3>Sem avaliações pontuadas</h3>
              <p>As faixas aparecem quando houver nota calculada.</p>
            </div>
          )}
        </section>
      </div>

      <section className="card pad" aria-labelledby="df-ofensores">
        <div className="section-head">
          <div>
            <h2 id="df-ofensores">Critérios ofensores</h2>
            <p>Onde os formulários mais registram não conformidade.</p>
          </div>
        </div>

        {ofensores.length > 0 ? (
          <div className="progress-list">
            {ofensores.map((item) => {
              const falhas = Number(item.failures || 0);
              return (
                <div className="progress-item" key={item.name}>
                  <div className="progress-head">
                    <span className="progress-name">
                      {item.name}
                      {item.eliminatoria ? (
                        <span className={styles.eliminatoria} title="Critério eliminatório">
                          <Icon name="alert" size={12} />
                          <span className="sr-only">Critério eliminatório</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="progress-value">
                      {falhas} falha{falhas === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="progress-track" role="img" aria-label={`${item.name}: ${falhas} falha(s)`}>
                    <div className="progress-bar" style={{ "--w": `${(falhas / maiorOfensor) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span className="icon-badge success">
              <Icon name="checkCircle" size={20} />
            </span>
            <h3>Sem não conformidade no recorte</h3>
            <p>Nenhum critério registrou falha no período filtrado.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
