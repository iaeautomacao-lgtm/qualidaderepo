"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import { enviarApi } from "@/lib/api";
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
  if (!texto || /^gemini$/i.test(texto)) return "Monitor IA";
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
  const [editando, setEditando] = useState(null);
  const [config, setConfig] = useState({ nome: "", formularioId: "", prompt: "" });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      try {
        const resposta = await fetch("/api/monitores-ia", { cache: "no-store" });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar o Monitor IA.");
        }
        if (ativo) {
          setDados(payload.data);
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setDados(null);
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o Monitor IA.");
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


  function abrirConfiguracao(monitor) {
    setEditando(monitor);
    setConfig({
      nome: monitor.configuracao?.nome || monitor.nome || "Monitor IA",
      formularioId: monitor.configuracao?.formularioId || monitor.formulariosIa?.[0]?.id || "",
      prompt: monitor.prompt || "",
    });
    setErroSalvar("");
  }

  async function salvarConfiguracao(evento) {
    evento.preventDefault();
    if (!editando) return;
    setSalvando(true);
    setErroSalvar("");
    try {
      const resposta = await enviarApi("/api/monitores-ia", {
        clienteId: editando.clienteId,
        formularioId: config.formularioId,
        nome: config.nome,
        prompt: config.prompt,
        ativo: true,
      });
      setDados(resposta);
      setEditando(null);
    } catch (causa) {
      setErroSalvar(causa instanceof Error ? causa.message : "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }
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
      label: "Pendentes",
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
    <AppShell active="Monitor IA" breadcrumb="Qualidade > Monitor IA">
      <section className="page-header">
        <div>
          <h1>Monitor IA</h1>
          <p>Cadastre e gerencie Monitores IA por carteira.</p>
        </div>

        <div className="actions">
          <form className={`search-field ${styles.busca}`} role="search" onSubmit={(evento) => evento.preventDefault()}>
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="busca-monitor-ia">
              Buscar Monitores IA
            </label>
            <input
              className="input"
              id="busca-monitor-ia"
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar Monitores IA..."
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
        <section className="grid kpi-grid" aria-label="Indicadores do Monitor IA">
          {kpis.map((kpi) => (
            <KpiCard badge={kpi.badge} icon={kpi.icon} key={kpi.id} label={kpi.label} value={kpi.value} />
          ))}
        </section>


        {editando ? (
          <section className="card pad" aria-labelledby="configurar-monitor-ia">
            <div className="section-head">
              <div>
                <h2 id="configurar-monitor-ia">Configurar {editando.nome}</h2>
                <p>{editando.cliente} · vincule o formulário e o prompt usados pelo Monitor IA.</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
            <form className={styles.configForm} onSubmit={salvarConfiguracao}>
              <div className="field">
                <label htmlFor="monitor-ia-nome">Nome do perfil</label>
                <input className="input" id="monitor-ia-nome" value={config.nome} onChange={(evento) => setConfig((atual) => ({ ...atual, nome: evento.target.value }))} required minLength={2} />
              </div>
              <div className="field">
                <label htmlFor="monitor-ia-formulario">Formulário IA</label>
                <select className="select" id="monitor-ia-formulario" value={config.formularioId} onChange={(evento) => setConfig((atual) => ({ ...atual, formularioId: evento.target.value }))} required>
                  <option value="">Selecione</option>
                  {(editando.formulariosIa || []).map((formulario) => <option key={formulario.id} value={formulario.id}>{formulario.nome}</option>)}
                </select>
              </div>
              <div className={`field ${styles.campoInteiro}`}>
                <label htmlFor="monitor-ia-prompt">Prompt da análise</label>
                <textarea className="input" id="monitor-ia-prompt" rows={8} value={config.prompt} onChange={(evento) => setConfig((atual) => ({ ...atual, prompt: evento.target.value }))} required minLength={20} />
              </div>
              {erroSalvar ? <p className={`alert danger ${styles.campoInteiro}`}><Icon name="alert" size={16} /><span className="alert-body"><strong>Configuração não salva</strong><span>{erroSalvar}</span></span></p> : null}
              <div className={styles.campoInteiro}>
                <button className="btn primary" type="submit" disabled={salvando || !editando.clienteId}>
                  <Icon name={salvando ? "spinner" : "settings"} size={16} />
                  {salvando ? "Salvando..." : "Salvar configuração"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
        <section className="card pad" aria-labelledby="monitores-recentes">
          <div className="section-head">
            <div>
              <h2 id="monitores-recentes">Monitores IA Recentes</h2>
              <p>Selecione um monitor para ações rápidas</p>
            </div>
            <Link className="btn ghost" href="/">
              Ver dashboard
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>

          {erro ? (
            <div className="empty-state">
              <Icon name="error" size={38} />
              <h3>Não foi possível carregar o Monitor IA</h3>
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
                      <span className={`chip ${monitor.configurado ? "success" : "warning"}`}>{monitor.configurado ? "Configurado" : "Configuração pendente"}</span>
                      <p>{monitor.cliente}</p>
                      <p>{monitor.campanhasNomes || "Sem campanha vinculada"}</p>
                      <p>{monitor.formularioIa ? `Formulário: ${monitor.formularioIa}` : "Sem formulário IA vinculado"}</p>
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
                      <button className="btn primary" type="button" onClick={() => abrirConfiguracao(monitor)}>
                        <Icon name="settings" size={15} />
                        Configurar
                      </button>
                      <Link className="btn" href={uploadHref(monitor)}>
                        <Icon name="upload" size={15} />
                        Subir Gravação
                      </Link>
                      <Link className="btn" href={`/avaliacoes?origem=ia&monitor=${encodeURIComponent(monitorQuery)}`}>
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
              <strong>Avaliações do Monitor IA</strong>
              <span>Ver resultados criados</span>
            </Link>
            <Link className="quick-action compact" href="/">
              <span className="icon-badge" aria-hidden="true">
                <Icon name="metrics" size={18} />
              </span>
              <strong>Dashboard</strong>
              <span>Acompanhar indicadores do Monitor IA</span>
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
