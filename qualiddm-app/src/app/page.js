"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

function formatarDuracao(segundos) {
  const total = Math.max(0, Number(segundos || 0));
  const minutos = Math.floor(total / 60);
  const resto = Math.round(total % 60);
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

function formatarData(valor) {
  if (!valor) return "N/A";
  const [data] = String(valor).split(/[ T]/);
  const [ano, mes, dia] = data.split("-");
  return dia && mes && ano ? `${dia}/${mes}` : String(valor);
}

function maximo(lista, chave) {
  return Math.max(1, ...lista.map((item) => Number(item[chave] || 0)));
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/dashboard?period=${period}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar o dashboard.");
        if (active) {
          setData(payload.data);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  function alterarPeriodo(proximoPeriodo) {
    if (proximoPeriodo === period) return;
    setLoading(true);
    setPeriod(proximoPeriodo);
  }

  const kpis = useMemo(() => {
    const values = data?.kpis || {};
    return [
      {
        id: "total",
        label: "Total de Avaliações",
        value: String(values.reviews ?? 0),
        icon: "review",
      },
      {
        id: "score",
        label: "Score Médio de Qualidade",
        value: Number(values.averageScore ?? 0).toFixed(1),
        icon: "gauge",
      },
      {
        id: "tempo",
        label: "Tempo Médio (min:seg)",
        value: formatarDuracao(values.averageDurationSeconds),
        icon: "clock",
      },
      {
        id: "clientes",
        label: "Clientes Ativos",
        value: String(values.activeClients ?? 0),
        icon: "wallet",
      },
    ];
  }, [data]);

  const status = data?.status || {};
  const maiorDia = maximo(data?.qualityByDay || [], "reviews");
  const maiorQuadrante = maximo(data?.quadrants || [], "value");
  const maiorOfensor = maximo(data?.offenders || [], "failures");

  return (
    <AppShell active="Dashboard" breadcrumb="Visão geral > Dashboard">
      <section className="page-header">
        <div>
          <h1>Qualidade da Operação</h1>
          <p>Indicadores calculados a partir das avaliações registradas no banco.</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" aria-pressed={period === "weekly"} onClick={() => alterarPeriodo("weekly")}>
            7 dias
          </button>
          <button className="btn" type="button" aria-pressed={period === "monthly"} onClick={() => alterarPeriodo("monthly")}>
            31 dias
          </button>
        </div>
      </section>

      {error ? (
        <section className="card pad">
          <div className="empty-state">
            <Icon name="error" size={38} />
            <h3>Não foi possível carregar o dashboard</h3>
            <p>{error}</p>
          </div>
        </section>
      ) : (
        <div className={styles.painel}>
          <section className="grid kpi-grid" aria-label="Indicadores do período">
            {kpis.map((kpi) => (
              <KpiCard icon={kpi.icon} key={kpi.id} label={kpi.label} value={loading ? "..." : kpi.value} />
            ))}
          </section>

          <div className={styles.gradePrincipal}>
            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-evolucao">
              <div className="section-head">
                <h2 id="titulo-evolucao">Evolução de Avaliações e Qualidade</h2>
                <span className="section-meta">{period === "weekly" ? "Últimos 7 dias" : "Últimos 31 dias"}</span>
              </div>

              {data?.qualityByDay?.length > 0 ? (
                <ul className={styles.barras}>
                  {data.qualityByDay.map((item) => (
                    <li key={String(item.day)}>
                      <span>{formatarData(item.day)}</span>
                      <div className={styles.trilho}>
                        <span style={{ width: `${(Number(item.reviews || 0) / maiorDia) * 100}%` }} />
                      </div>
                      <strong>{Number(item.score ?? 0).toFixed(1)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="metrics" size={32} />
                  <h3>Sem série histórica</h3>
                  <p>A evolução aparece quando houver avaliações no período.</p>
                </div>
              )}
            </section>

            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-quadrante">
              <div className="section-head">
                <h2 id="titulo-quadrante">Distribuição por Quadrante</h2>
              </div>

              {data?.quadrants?.length > 0 ? (
                <ul className={styles.barras}>
                  {data.quadrants.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <div className={styles.trilho}>
                        <span style={{ width: `${(Number(item.value || 0) / maiorQuadrante) * 100}%` }} />
                      </div>
                      <strong>{Number(item.value || 0)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="gauge" size={32} />
                  <h3>Sem distribuição</h3>
                  <p>Os quadrantes aparecem quando houver avaliações pontuadas.</p>
                </div>
              )}
            </section>
          </div>

          <div className={styles.gradePrincipal}>
            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-ofensores">
              <div className="section-head">
                <h2 id="titulo-ofensores">Top 10 Ofensores</h2>
                <span className="section-meta">Critérios com Mais Falhas</span>
              </div>

              {data?.offenders?.length > 0 ? (
                <ul className={styles.barras}>
                  {data.offenders.map((item) => (
                    <li key={item.name}>
                      <span>{item.name}</span>
                      <div className={styles.trilho}>
                        <span style={{ width: `${(Number(item.failures || 0) / maiorOfensor) * 100}%` }} />
                      </div>
                      <strong>{Number(item.failures || 0)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="alert" size={32} />
                  <h3>Sem falhas no período</h3>
                  <p>Critérios ofensores aparecem quando houver não conformidades.</p>
                </div>
              )}
            </section>

            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-status">
              <div className="section-head">
                <h2 id="titulo-status">Status Atual</h2>
              </div>

              <dl className={styles.statusGrid}>
                <div>
                  <dt>Feedbacks Abertos</dt>
                  <dd>{Number(status.feedbackOpen || 0)}</dd>
                </div>
                <div>
                  <dt>Feedbacks Aplicados</dt>
                  <dd>{Number(status.feedbackApplied || 0)}</dd>
                </div>
                <div>
                  <dt>Contestações</dt>
                  <dd>{Number(status.contestations || 0)}</dd>
                </div>
                <div>
                  <dt>Avaliações Zeradas</dt>
                  <dd>{Number(status.zeroedReviews || 0)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
