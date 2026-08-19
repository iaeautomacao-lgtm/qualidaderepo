"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import GraficoLinha from "@/components/GraficoLinha";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

/**
 * Dashboard — painel executivo da qualidade.
 *
 * A tela responde quatro perguntas, nesta ordem, e o layout segue essa ordem:
 *   1. Como estamos?      -> faixa de KPIs com tendência contra o período anterior
 *   2. O que piorou?      -> evolução no tempo + distribuição por faixa
 *   3. O que faço agora?  -> prioridades (com CTA) + foco da gestão
 *   4. Onde está?         -> ofensores + carteiras
 *
 * O que saiu: os três cartões de texto ("Diagnóstico", "Foco de gestão",
 * "Carteiras") que abriam a página. Ocupavam a primeira dobra inteira com
 * frases genéricas antes de qualquer número — o gestor rolava para chegar ao
 * que veio buscar. O conteúdo útil deles virou dado: "Foco da gestão" agora
 * mostra critério, ocorrências, impacto e ação; "Carteiras" virou ranking por
 * nota; e o "Diagnóstico" virou a tendência dentro de cada KPI.
 */

const PERIODOS = [
  { value: "weekly", label: "Últimos 7 dias", curto: "7 dias" },
  { value: "monthly", label: "Últimos 31 dias", curto: "31 dias" },
];

const TODOS = "todos";

function formatarDuracao(segundos) {
  const total = Math.max(0, Number(segundos || 0));
  const minutos = Math.floor(total / 60);
  const resto = Math.round(total % 60);
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

function formatarDia(valor) {
  if (!valor) return "";
  const [data] = String(valor).split(/[ T]/);
  const [ano, mes, dia] = data.split("-");
  return dia && mes && ano ? `${dia}/${mes}` : String(valor);
}

function formatarScore(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(1).replace(".", ",") : "0,0";
}

function inteiro(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? String(numero) : "0";
}

/** Decimal com vírgula e sem casa inútil: "8,2" e "3", não "8.2" e "3.0". */
function decimal(valor) {
  const numero = Math.abs(Number(valor) || 0);
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(1).replace(".", ",");
}

const ROTULO_IMPACTO = { alto: "Impacto alto", medio: "Impacto médio", baixo: "Impacto baixo" };
const TOM_IMPACTO = { alto: "danger", medio: "warning", baixo: "info" };

export default function DashboardPage() {
  const [filtros, setFiltros] = useState({
    period: "monthly",
    clienteId: TODOS,
    campanhaId: TODOS,
    operadorId: TODOS,
  });
  const [opcoes, setOpcoes] = useState({ clientes: [], campanhas: [], avaliados: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Opções dos filtros: a rota de relatórios já devolve cliente, campanha e
  // avaliado com id. Buscar uma vez basta — a lista não muda com o período.
  useEffect(() => {
    let ativo = true;

    fetch("/api/relatorios/opcoes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok || !ativo) return;
        setOpcoes({
          clientes: payload.data?.clientes ?? [],
          campanhas: payload.data?.campanhas ?? [],
          avaliados: payload.data?.avaliados ?? [],
        });
      })
      .catch(() => {
        // Filtro é conveniência: sem as opções a tela continua mostrando o
        // período inteiro em vez de quebrar.
      });

    return () => {
      ativo = false;
    };
  }, []);

  // `setLoading` mora nos handlers de filtro, não aqui: chamar setState no corpo
  // de um efeito dispara render em cascata (react-hooks/set-state-in-effect).
  useEffect(() => {
    let ativo = true;

    const busca = new URLSearchParams({ period: filtros.period });
    for (const chave of ["clienteId", "campanhaId", "operadorId"]) {
      if (filtros[chave] !== TODOS) busca.set(chave, filtros[chave]);
    }

    fetch(`/api/dashboard?${busca}`, { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar o dashboard.");
        if (!ativo) return;
        setData(payload.data);
        setError("");
      })
      .catch((causa) => {
        if (ativo) setError(causa instanceof Error ? causa.message : "Não foi possível carregar o dashboard.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [filtros]);

  const periodo = PERIODOS.find((item) => item.value === filtros.period) ?? PERIODOS[1];
  const kpis = data?.kpis ?? {};
  const tendencias = data?.tendencias ?? {};
  const prioridades = data?.priorities ?? [];
  const ofensores = data?.offenders ?? [];
  const carteiras = data?.clients ?? [];
  const distribuicao = data?.quadrants ?? [];
  const foco = data?.foco ?? null;

  // Campanha depende do cliente escolhido: oferecer campanha de outra carteira
  // gera filtro que devolve zero e parece defeito.
  const campanhasVisiveis = useMemo(() => {
    if (filtros.clienteId === TODOS) return opcoes.campanhas;
    return opcoes.campanhas.filter(
      (campanha) => campanha.clienteId == null || campanha.clienteId === filtros.clienteId,
    );
  }, [opcoes.campanhas, filtros.clienteId]);

  const indicadores = [
    {
      id: "nota",
      rotulo: "Nota média",
      valor: formatarScore(kpis.averageScore),
      tendencia: tendencias.averageScore,
      contexto: `${inteiro(kpis.reviews)} monitoria(s) no período`,
      destaque: true,
    },
    {
      id: "avaliacoes",
      rotulo: "Avaliações",
      valor: inteiro(kpis.reviews),
      tendencia: tendencias.reviews,
      contexto: `Tempo médio ${formatarDuracao(kpis.averageDurationSeconds)}`,
    },
    {
      id: "naoconformidades",
      rotulo: "Não conformidades",
      valor: inteiro(kpis.nonConformities),
      tendencia: tendencias.nonConformities,
      contexto: ofensores.length > 0 ? `${ofensores.length} critério(s) ofensor(es)` : "Nenhum critério ofensor",
    },
    {
      id: "criticas",
      rotulo: "Avaliações críticas",
      valor: inteiro(kpis.criticalReviews),
      tendencia: tendencias.criticalReviews,
      contexto: Number(kpis.criticalReviews) > 0 ? "Zeradas por critério eliminatório" : "Nenhuma zerada",
      alerta: Number(kpis.criticalReviews) > 0,
    },
    {
      id: "pendencias",
      rotulo: "Pendências",
      valor: inteiro(kpis.feedbackPending),
      contexto: "Feedbacks aguardando aplicação",
      acao: { href: "/feedback", rotulo: "Revisar" },
    },
  ];

  const pontos = (data?.qualityByDay ?? []).map((dia) => ({
    rotulo: formatarDia(dia.day),
    valor: Number(dia.score ?? 0),
    volume: Number(dia.reviews ?? 0),
  }));

  const totalDistribuicao = distribuicao.reduce((soma, item) => soma + Number(item.value || 0), 0);
  const maiorOfensor = Math.max(1, ...ofensores.map((item) => Number(item.failures || 0)));
  const filtroAtivo = ["clienteId", "campanhaId", "operadorId"].some((chave) => filtros[chave] !== TODOS);

  function alterar(chave, valor) {
    setLoading(true);
    setFiltros((atual) => {
      // Trocar de cliente invalida a campanha escolhida.
      if (chave === "clienteId") return { ...atual, clienteId: valor, campanhaId: TODOS };
      return { ...atual, [chave]: valor };
    });
  }

  function limparRecortes() {
    setLoading(true);
    setFiltros((atual) => ({ ...atual, clienteId: TODOS, campanhaId: TODOS, operadorId: TODOS }));
  }

  return (
    <AppShell active="Dashboard" breadcrumb="Visão geral > Dashboard">
      <section className={styles.cabecalho}>
        <div>
          <h1>Dashboard</h1>
          <p>
            Visão geral da qualidade · {periodo.label.toLowerCase()}
            {filtroAtivo ? " · recorte filtrado" : ""}
          </p>
        </div>

        <div className={styles.filtros} role="group" aria-label="Filtros do painel">
          <div className="field">
            <label htmlFor="filtro-periodo">Período</label>
            <select
              className="select"
              id="filtro-periodo"
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
            <label htmlFor="filtro-cliente">Cliente</label>
            <select
              className="select"
              id="filtro-cliente"
              value={filtros.clienteId}
              onChange={(evento) => alterar("clienteId", evento.target.value)}
            >
              <option value={TODOS}>Todos</option>
              {opcoes.clientes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-carteira">Carteira</label>
            <select
              className="select"
              id="filtro-carteira"
              value={filtros.campanhaId}
              onChange={(evento) => alterar("campanhaId", evento.target.value)}
            >
              <option value={TODOS}>Todas</option>
              {campanhasVisiveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-operador">Operador</label>
            <select
              className="select"
              id="filtro-operador"
              value={filtros.operadorId}
              onChange={(evento) => alterar("operadorId", evento.target.value)}
            >
              <option value={TODOS}>Todos</option>
              {opcoes.avaliados.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          {filtroAtivo ? (
            <button
              className="btn ghost"
              type="button"
              onClick={limparRecortes}
            >
              <Icon name="undo" size={16} />
              Limpar
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h2>Não foi possível carregar o dashboard</h2>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.kpis} aria-label="Indicadores do período">
        {indicadores.map((item) => (
          <Indicador carregando={loading && !data} indicador={item} key={item.id} />
        ))}
      </section>

      <div className={styles.duasColunas} data-proporcao="dois-um">
        <section className="card pad" aria-labelledby="titulo-evolucao">
          <div className="section-head">
            <div>
              <h2 id="titulo-evolucao">Evolução da qualidade</h2>
              <p>Nota média por dia. A barra clara atrás mostra o volume de monitorias.</p>
            </div>
            <span className="section-meta">{periodo.label}</span>
          </div>

          {pontos.length > 0 ? (
            <GraficoLinha pontos={pontos} titulo="Nota média por dia" />
          ) : (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="metrics" size={20} />
              </span>
              <h3>Sem série histórica</h3>
              <p>A evolução aparece quando houver monitorias analisadas no período.</p>
            </div>
          )}
        </section>

        <section className="card pad" aria-labelledby="titulo-distribuicao">
          <div className="section-head">
            <div>
              <h2 id="titulo-distribuicao">Distribuição</h2>
              <p>Monitorias por faixa de nota.</p>
            </div>
          </div>

          {totalDistribuicao > 0 ? (
            <ul className={styles.faixas}>
              {distribuicao.map((faixa) => {
                const valor = Number(faixa.value || 0);
                const parcela = Math.round((valor / totalDistribuicao) * 100);
                return (
                  <li key={faixa.label} data-tom={faixa.tom}>
                    <span className={styles.faixaMarca} aria-hidden="true" />
                    <span className={styles.faixaNome}>{faixa.label}</span>
                    <span className={styles.faixaValor}>
                      <strong>{valor}</strong>
                      <small>{parcela}%</small>
                    </span>
                  </li>
                );
              })}
              <li className={styles.faixaTotal}>
                <span className={styles.faixaNome}>Monitorias pontuadas</span>
                <span className={styles.faixaValor}>
                  <strong>{totalDistribuicao}</strong>
                </span>
              </li>
            </ul>
          ) : (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="gauge" size={20} />
              </span>
              <h3>Sem distribuição</h3>
              <p>As faixas aparecem quando houver monitorias pontuadas.</p>
            </div>
          )}
        </section>
      </div>

      <div className={styles.duasColunas} data-proporcao="dois-um">
        <section className="card pad" aria-labelledby="titulo-prioridades">
          <div className="section-head">
            <div>
              <h2 id="titulo-prioridades">Prioridades</h2>
              <p>Monitorias que exigem ação, da mais crítica para a menos.</p>
            </div>
            <Link className="btn" href="/avaliacoes">
              Ver todas
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>

          {prioridades.length > 0 ? (
            /* A primeira vira cartão com botão; o resto vira linha clicável. Seis
               cartões iguais empurravam a metade de baixo do painel para fora da
               tela e diluíam justamente o item que deveria puxar a atenção. */
            <ul className={styles.prioridades}>
              {prioridades.map((item, indice) => {
                const primeira = indice === 0;
                const destino = item.href || "/avaliacoes";

                return (
                  <li
                    data-critica={item.critica ? "true" : undefined}
                    data-primeira={primeira ? "true" : undefined}
                    key={`${item.public_id}-${indice}`}
                  >
                    <div className={styles.prioridadeTopo}>
                      <span className={styles.prioridadeSelo} data-tom={item.critica ? "danger" : "warning"}>
                        <Icon name={item.critica ? "alert" : "clock"} size={13} />
                        {item.critica ? "Crítica" : "Atenção"}
                      </span>
                      <strong className={styles.prioridadeCodigo}>{item.public_id}</strong>
                      <span className={styles.prioridadeNumeros}>
                        nota <strong>{formatarScore(item.score)}</strong>
                        <span aria-hidden="true">•</span>
                        {Number(item.non_conformities || 0)} falha(s)
                      </span>
                    </div>

                    <p className={styles.prioridadeMeta}>
                      {item.wallet_name || "Sem carteira"} · {item.operator_name || "Operador não informado"}
                    </p>

                    {primeira ? (
                      <Link className="btn" href={destino}>
                        <Icon name="review" size={16} />
                        Revisar monitoria
                      </Link>
                    ) : (
                      <Link className={styles.prioridadeLink} href={destino}>
                        Revisar monitoria
                        <Icon name="chevronRight" size={14} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="icon-badge success">
                <Icon name="checkCircle" size={20} />
              </span>
              <h3>Nenhuma prioridade no período</h3>
              <p>Quando houver nota baixa, falha ou feedback pendente, a fila aparece aqui.</p>
            </div>
          )}
        </section>

        <section className="card pad" aria-labelledby="titulo-foco">
          <div className="section-head">
            <div>
              <h2 id="titulo-foco">Foco da gestão</h2>
              <p>O critério que mais custou qualidade no período.</p>
            </div>
          </div>

          {foco ? (
            <div className={styles.foco}>
              <div className={styles.focoTopo}>
                <span className={`chip ${TOM_IMPACTO[foco.impacto] || "info"}`}>
                  <Icon name={foco.impacto === "alto" ? "alert" : "target"} size={13} />
                  {ROTULO_IMPACTO[foco.impacto] || "Impacto"}
                </span>
                {foco.eliminatoria ? (
                  <span className="chip danger">
                    <Icon name="error" size={13} />
                    Eliminatório
                  </span>
                ) : null}
              </div>

              <h3 className={styles.focoCriterio}>{foco.criterio}</h3>

              <dl className={styles.focoNumeros}>
                <div>
                  <dt>Ocorrências</dt>
                  <dd>{foco.ocorrencias}</dd>
                </div>
                <div>
                  <dt>Do total de falhas</dt>
                  <dd>{foco.share}%</dd>
                </div>
              </dl>

              <p className={styles.focoAcao}>
                <Icon name="workflow" size={15} />
                {foco.acao}
              </p>

              {/* De onde vem o "impacto": frequência do critério e a flag de
                  eliminatório do formulário. Dizer isso na tela evita que a
                  leitura seja tomada como regra do POP. */}
              <p className={styles.focoNota}>
                Impacto estimado pela frequência ({foco.ocorrencias} de {foco.totalFalhas} falhas) e pela marcação
                de eliminatório no formulário.
              </p>

              <Link className="btn" href="/formularios">
                <Icon name="checklist" size={16} />
                Ver critérios
              </Link>
            </div>
          ) : (
            <div className="empty-state">
              <span className="icon-badge success">
                <Icon name="checkCircle" size={20} />
              </span>
              <h3>Nenhum ofensor no período</h3>
              <p>Sem não conformidades registradas, não há critério para priorizar.</p>
            </div>
          )}
        </section>
      </div>

      <div className={styles.duasColunas}>
        <section className="card pad" aria-labelledby="titulo-ofensores">
          <div className="section-head">
            <div>
              <h2 id="titulo-ofensores">Principais ofensores</h2>
              <p>Critérios com mais não conformidades.</p>
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
                          <span className={styles.marcaEliminatoria} title="Critério eliminatório">
                            <Icon name="alert" size={12} />
                            <span className="sr-only">Critério eliminatório</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="progress-value">
                        {falhas} falha{falhas === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      role="img"
                      aria-label={`${item.name}: ${falhas} não conformidade(s)`}
                    >
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
              <h3>Sem falhas no período</h3>
              <p>Critérios ofensores aparecem quando houver não conformidade.</p>
            </div>
          )}
        </section>

        <section className="card pad" aria-labelledby="titulo-carteiras">
          <div className="section-head">
            <div>
              <h2 id="titulo-carteiras">Carteiras em foco</h2>
              <p>Da pior para a melhor nota média.</p>
            </div>
          </div>

          {carteiras.length > 0 ? (
            <ul className="list">
              {carteiras.map((carteira) => (
                <li className={`row ${styles.linhaCarteira}`} key={carteira.name}>
                  <div className="row-main">
                    <strong className="row-title">{carteira.name}</strong>
                    <span className="row-meta">{Number(carteira.reviews || 0)} monitoria(s)</span>
                  </div>
                  <span className={`score ${classeScore(carteira.score)}`}>{formatarScore(carteira.score)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="wallet" size={20} />
              </span>
              <h3>Sem carteiras no período</h3>
              <p>Os uploads analisados alimentam este ranking.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function classeScore(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero === 0) return "danger";
  if (numero >= 90) return "success";
  if (numero >= 80) return "accent";
  if (numero >= 70) return "warning";
  return "danger";
}

/**
 * KPI com tendência.
 *
 * A seta nunca vai sozinha na cor: acompanha ícone e texto lido por leitor de
 * tela (WCAG 1.4.1). E `direcao` vem do servidor porque "subiu" não significa
 * "melhorou" em não conformidades — a regra mora num lugar só.
 */
function Indicador({ indicador, carregando }) {
  const { tendencia } = indicador;
  const mostraTendencia = tendencia && tendencia.direcao !== "estavel" && tendencia.comparavel;

  return (
    <article
      className={styles.kpi}
      data-destaque={indicador.destaque ? "true" : undefined}
      data-alerta={indicador.alerta ? "true" : undefined}
    >
      <p className={styles.kpiRotulo}>{indicador.rotulo}</p>

      <p className={styles.kpiValor}>{carregando ? "—" : indicador.valor}</p>

      <div className={styles.kpiPe}>
        {mostraTendencia ? (
          <span className={styles.kpiTendencia} data-direcao={tendencia.direcao}>
            <Icon name={tendencia.delta > 0 ? "trendUp" : "trendDown"} size={13} />
            {tendencia.delta > 0 ? "+" : "−"}
            {decimal(tendencia.delta)}
            {typeof tendencia.percentual === "number" ? ` (${decimal(tendencia.percentual)}%)` : ""}
            <span className="sr-only">
              {tendencia.direcao === "melhora" ? " de melhora" : " de piora"} contra o período anterior
            </span>
          </span>
        ) : null}

        {indicador.acao ? (
          <Link className={styles.kpiAcao} href={indicador.acao.href}>
            {indicador.acao.rotulo}
            <Icon name="chevronRight" size={13} />
          </Link>
        ) : (
          <span className={styles.kpiContexto}>{indicador.contexto}</span>
        )}
      </div>
    </article>
  );
}
