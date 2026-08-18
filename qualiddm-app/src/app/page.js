"use client";

import Link from "next/link";
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

function formatarScore(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(1) : "0.0";
}

function resumoPeriodo(data) {
  const kpis = data?.kpis || {};
  const score = Number(kpis.averageScore || 0);
  const total = Number(kpis.reviews || 0);
  const falhas = Number(kpis.nonConformities || 0);
  if (total === 0) return "Sem base de monitorias no periodo. O painel ganha leitura estrategica conforme os uploads forem analisados.";
  if (falhas > 0) return `Periodo com ${falhas} nao conformidade(s). Priorize feedback, calibragem e treinamento dos criterios ofensores.`;
  if (score >= 90) return "Qualidade em nivel de excelencia. Use as evidencias para reconhecer boas praticas e padronizar o roteiro.";
  if (score >= 80) return "Operacao conforme, mas acompanhe a evolucao semanal para evitar queda de aderencia.";
  return "Operacao em atencao. Revise as monitorias prioritarias e transforme achados em plano de acao.";
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
  const prioridades = data?.priorities || [];
  const recentes = data?.recentReviews || [];
  const clientes = data?.clients || [];

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

          <section className={`card pad ${styles.leitura}`} aria-labelledby="titulo-leitura">
            <div className="section-head">
              <div>
                <h2 id="titulo-leitura">Leitura estratégica do período</h2>
                <p>{period === "weekly" ? "Recorte operacional dos últimos 7 dias." : "Recorte mensal para gestão da qualidade."}</p>
              </div>
              <span className="chip warning">{prioridades.length} prioridade(s)</span>
            </div>
            <div className={styles.leituraGrid}>
              <article>
                <Icon name="sparkles" size={18} />
                <strong>Diagnóstico</strong>
                <span>{resumoPeriodo(data)}</span>
              </article>
              <article>
                <Icon name="target" size={18} />
                <strong>Foco de gestão</strong>
                <span>
                  {data?.offenders?.[0]?.name
                    ? `Treinar e calibrar o critério "${data.offenders[0].name}".`
                    : "Aguardar mais monitorias analisadas para identificar ofensores recorrentes."}
                </span>
              </article>
              <article>
                <Icon name="users" size={18} />
                <strong>Carteiras</strong>
                <span>
                  {clientes.length > 0
                    ? `${clientes.length} carteira(s) com visão no painel.`
                    : "Cadastre e processe arquivos por carteira para comparar performance."}
                </span>
              </article>
            </div>
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
                  <dt>Revisões pendentes</dt>
                  <dd>{Number(data?.priorities?.length || 0)}</dd>
                </div>
                <div>
                  <dt>Avaliações Zeradas</dt>
                  <dd>{Number(status.zeroedReviews || 0)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className={styles.gradePrincipal}>
            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-prioridades">
              <div className="section-head">
                <div>
                  <h2 id="titulo-prioridades">Prioridades da Gestão</h2>
                  <p>Monitorias que pedem revisão, feedback ou calibragem.</p>
                </div>
              </div>

              {prioridades.length > 0 ? (
                <ul className={styles.listaEstrategica}>
                  {prioridades.map((item) => (
                    <li key={`${item.public_id}-${item.wallet_name}`}>
                      <Link href={item.href || "/avaliacoes"}>
                        <span>
                          <strong>{item.public_id}</strong>
                          <small>{item.wallet_name || "Sem carteira"} · {item.operator_name || "Sem operador"}</small>
                        </span>
                        <span className="chip warning">
                          {Number(item.non_conformities || 0)} falha(s) · nota {formatarScore(item.score)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="checkCircle" size={32} />
                  <h3>Nenhuma prioridade crítica</h3>
                  <p>Quando houver nota baixa ou não conformidade, a gestão aparece aqui.</p>
                </div>
              )}
            </section>

            <section className={`card ${styles.cartao}`} aria-labelledby="titulo-carteiras">
              <div className="section-head">
                <h2 id="titulo-carteiras">Carteiras em foco</h2>
              </div>

              {clientes.length > 0 ? (
                <ul className={styles.listaCarteiras}>
                  {clientes.map((cliente) => (
                    <li key={cliente.name}>
                      <span>
                        <strong>{cliente.name}</strong>
                        <small>{Number(cliente.reviews || 0)} monitoria(s)</small>
                      </span>
                      <strong>{formatarScore(cliente.score)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="wallet" size={32} />
                  <h3>Sem carteiras analisadas</h3>
                  <p>Os uploads analisados por IA alimentam este ranking.</p>
                </div>
              )}
            </section>
          </div>

          <section className={`card ${styles.cartao}`} aria-labelledby="titulo-recentes">
            <div className="section-head">
              <div>
                <h2 id="titulo-recentes">Monitorias recentes</h2>
                <p>Base que alimenta dashboard, avaliações e gestão de feedback.</p>
              </div>
              <Link className="btn" href="/avaliacoes">
                Ver avaliações
                <Icon name="chevronRight" size={16} />
              </Link>
            </div>

            {recentes.length > 0 ? (
              <ul className={styles.monitoriasRecentes}>
                {recentes.map((item) => (
                  <li key={`${item.public_id}-${item.created_at}`}>
                    <Link href={item.href || "/avaliacoes"}>
                      <span className="icon-badge" aria-hidden="true">
                        <Icon name="review" size={16} />
                      </span>
                      <span>
                        <strong>{item.public_id}</strong>
                        <small>{item.form_name || "Análise IA"} · {item.wallet_name || "Sem carteira"}</small>
                      </span>
                      <span className={`score ${Number(item.score || 0) < 80 ? "danger" : "success"}`}>
                        {formatarScore(item.score)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <Icon name="review" size={32} />
                <h3>Nenhuma monitoria recente</h3>
                <p>Depois do upload com Gemini, a análise aparece aqui e alimenta os KPIs.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
