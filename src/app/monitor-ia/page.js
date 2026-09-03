"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function nomeVisivelMonitor(nome) {
  const texto = String(nome || "").trim();
  if (!texto || /^gemini$/i.test(texto)) return "Acordito";
  return texto;
}

function formatarData(valor) {
  if (!valor) return "Sem avaliações";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function uploadHref(monitor) {
  const params = new URLSearchParams();
  if (monitor?.cliente && monitor.cliente !== "Sem cliente vinculado") {
    params.set("cliente", monitor.cliente.split(",")[0].trim());
  }
  const campanha = String(monitor?.campanhasNomes || "").split(",")[0].trim();
  if (campanha) params.set("campanha", campanha);
  const query = params.toString();
  return query ? `/upload?${query}` : "/upload";
}

export default function MonitorIaPage() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      try {
        const resposta = await fetch("/api/monitores-ia", { cache: "no-store" });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar o Acordito.");
        }
        if (ativo) {
          setDados(payload.data);
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setDados(null);
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o Acordito.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const monitores = dados?.itens || [];
    const alvo = normalizar(busca);
    if (!alvo) return monitores;
    return monitores.filter((monitor) =>
      [nomeVisivelMonitor(monitor.nome), monitor.cliente, monitor.campanhasNomes].some((campo) =>
        normalizar(campo).includes(alvo),
      ),
    );
  }, [busca, dados]);

  const kpis = [
    {
      id: "total",
      badge: "Total",
      value: carregando ? "..." : String(dados?.kpis?.total ?? 0),
      label: "Carteiras monitoradas",
      icon: "sparkles",
    },
    {
      id: "ativos",
      badge: "Ativos",
      value: carregando ? "..." : String(dados?.kpis?.ativos ?? 0),
      label: "Prontos para uso",
      icon: "checkCircle",
    },
    {
      id: "config",
      badge: "Configuração",
      value: carregando ? "..." : String(dados?.kpis?.emConfiguracao ?? 0),
      label: "Ainda não ativados",
      icon: "clock",
    },
    {
      id: "campanhas",
      badge: "Campanhas",
      value: carregando ? "..." : String(dados?.kpis?.campanhasCobertas ?? 0),
      label: "Escopo configurado",
      icon: "metrics",
    },
  ];

  return (
    <AppShell active="Acordito" breadcrumb="Qualidade > Acordito">
      <section className="page-header">
        <div>
          <h1>Acordito</h1>
          <p>Assistente DDM para monitoria automática de chamadas e chats.</p>
        </div>

        <div className="actions">
          <form className={`search-field ${styles.busca}`} role="search" onSubmit={(evento) => evento.preventDefault()}>
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="busca-monitor-ia">
              Buscar carteiras do Acordito
            </label>
            <input
              className="input"
              id="busca-monitor-ia"
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar carteiras do Acordito..."
              type="search"
              value={busca}
            />
          </form>
          <Link className="btn" href="/upload">
            <Icon name="upload" size={16} />
            Subir gravação
          </Link>
        </div>
      </section>

      <div className={styles.painel}>
        <section className="grid kpi-grid" aria-label="Indicadores do Acordito">
          {kpis.map((kpi) => (
            <KpiCard badge={kpi.badge} icon={kpi.icon} key={kpi.id} label={kpi.label} value={kpi.value} />
          ))}
        </section>

        <section className="card pad" aria-labelledby="monitores-recentes">
          <div className="section-head">
            <div>
              <h2 id="monitores-recentes">Carteiras do Acordito</h2>
              <p>Selecione uma carteira para ações rápidas</p>
            </div>
            <Link className="btn ghost" href="/">
              Ver dashboard
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>

          {erro ? (
            <div className="empty-state">
              <Icon name="error" size={38} />
              <h3>Não foi possível carregar o Acordito</h3>
              <p>{erro}</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={38} />
              <h3>Nenhuma carteira encontrada</h3>
              <p>Revise a busca para ver as carteiras cadastradas.</p>
            </div>
          ) : (
            <ul className={styles.grade}>
              {filtrados.map((monitor) => {
                const nomeMonitor = nomeVisivelMonitor(monitor.nome);
                const monitorQuery = monitor.nome || nomeMonitor;

                return (
                  <li className={`card ${styles.monitor}`} key={monitor.id}>
                    <span className={styles.mascoteFrame} aria-hidden="true">
                      <Image alt="" height={96} src="/acordito.jpeg" width={96} />
                    </span>

                    <div className={styles.monitorTexto}>
                      <h3>{nomeMonitor}</h3>
                      <span className="chip success">{monitor.statusLabel || "Ativo"}</span>
                      <p>{monitor.cliente}</p>
                      <p>{monitor.campanhasNomes || "Sem campanha vinculada"}</p>
                    </div>

                    <dl className={styles.metricas}>
                      <div>
                        <dt>Avaliações</dt>
                        <dd>{Number(monitor.avaliacoes ?? 0)}</dd>
                      </div>
                      <div>
                        <dt>Score médio</dt>
                        <dd>{Number(monitor.scoreMedio ?? 0).toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt>Última avaliação</dt>
                        <dd>{formatarData(monitor.ultimaAvaliacao)}</dd>
                      </div>
                    </dl>

                    <div className={styles.acoes}>
                      <Link className="btn primary" href="/administracao">
                        <Icon name="settings" size={15} />
                        Configurar
                      </Link>
                      <Link className="btn" href={uploadHref(monitor)}>
                        <Icon name="upload" size={15} />
                        Subir Gravação
                      </Link>
                      <Link className="btn" href={`/avaliacoes?monitor=${encodeURIComponent(monitorQuery)}`}>
                        <Icon name="metrics" size={15} />
                        Ver Avaliações
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card pad" aria-labelledby="acoes-rapidas-monitor-ia">
          <div className="section-head">
            <div>
              <h2 id="acoes-rapidas-monitor-ia">Ações Rápidas</h2>
              <p>Acesse rapidamente as principais funcionalidades</p>
            </div>
          </div>

          <div className={styles.acoesRapidas}>
            <Link className="quick-action compact" href="/upload">
              <span className="icon-badge" aria-hidden="true">
                <Icon name="upload" size={18} />
              </span>
              <strong>Subir gravação</strong>
              <span>Enviar áudio para análise</span>
            </Link>
            <Link className="quick-action compact" href="/avaliacoes">
              <span className="icon-badge" aria-hidden="true">
                <Icon name="review" size={18} />
              </span>
              <strong>Avaliações do Acordito</strong>
              <span>Ver resultados criados</span>
            </Link>
            <Link className="quick-action compact" href="/">
              <span className="icon-badge" aria-hidden="true">
                <Icon name="metrics" size={18} />
              </span>
              <strong>Dashboard</strong>
              <span>Acompanhar indicadores do Acordito</span>
            </Link>
            <Link className="quick-action compact" href="/transcricoes">
              <span className="icon-badge" aria-hidden="true">
                <Icon name="waveform" size={18} />
              </span>
              <strong>Transcrições</strong>
              <span>Consultar gravações</span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
