"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros, enviarApi, enviarArquivos } from "@/lib/api";
import styles from "./page.module.css";

const SEVERIDADES = [
  { id: "todos", rotulo: "Todos" },
  { id: "critica", rotulo: "Crítico" },
  { id: "alta", rotulo: "Alto" },
  { id: "media", rotulo: "Médio" },
  { id: "baixa", rotulo: "Baixo" },
];

const TIPOS = [
  { id: "todos", rotulo: "Todos" },
  { id: "bug", rotulo: "Bug" },
  { id: "melhoria", rotulo: "Melhoria" },
  { id: "feature", rotulo: "Feature" },
];

const STATUS = [
  { id: "todos", rotulo: "Todos" },
  { id: "aberto", rotulo: "Aberto" },
  { id: "em_analise", rotulo: "Em andamento" },
  { id: "aguardando_teste", rotulo: "Aguardando teste" },
  { id: "resolvido", rotulo: "Resolvido" },
  { id: "nao_corrigir", rotulo: "Não corrigir" },
  { id: "descartado", rotulo: "Descartado" },
];

const METRICAS = [
  { chave: "total", rotulo: "Total", icon: "bug", tom: "blue" },
  { chave: "abertos", rotulo: "Abertos", icon: "alert", tom: "red" },
  { chave: "emAndamento", rotulo: "Em andamento", icon: "settings", tom: "yellow" },
  { chave: "aguardandoTeste", rotulo: "Aguardando teste", icon: "clock", tom: "cyan" },
  { chave: "resolvidos", rotulo: "Resolvidos", icon: "checkCircle", tom: "green" },
  { chave: "naoCorrigir", rotulo: "Não corrigir", icon: "close", tom: "purple" },
];

const STATUS_MUTAVEIS = STATUS.filter((item) => item.id !== "todos");

function textoJson(valor, fallback = "{}") {
  if (valor == null || valor === "") return fallback;
  if (typeof valor === "string") return valor;
  return JSON.stringify(valor, null, 2);
}

function lista(valor) {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function dataCurta(dataHora) {
  return String(dataHora || "").split(",")[0] || "N/A";
}

export default function BugsPage() {
  const [busca, setBusca] = useState("");
  const [severidade, setSeveridade] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [aberto, setAberto] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const [anexando, setAnexando] = useState(null);

  const url = useMemo(
    () => comFiltros("/api/bug-reports", { busca, severidade, tipo, status }),
    [busca, severidade, tipo, status],
  );

  const { dados, carregando, erro, recarregar, definir } = useRecurso(url, {
    itens: [],
    contadores: {},
    opcoes: {},
  });

  const itens = dados?.itens ?? [];
  const contadores = dados?.contadores ?? {};

  async function mudarStatus(item, proximoStatus) {
    setSalvando(item.id);
    try {
      const resposta = await enviarApi(`/api/bug-reports/${item.id}`, {
        status: proximoStatus,
      }, { metodo: "PATCH" });
      definir(resposta);
    } finally {
      setSalvando(null);
    }
  }

  async function anexarTela(item, arquivo) {
    if (!arquivo) return;
    setAnexando(item.id);
    try {
      const formData = new FormData();
      formData.set("file", arquivo);
      const resposta = await enviarArquivos(`/api/bug-reports/${item.id}/anexo`, formData);
      definir(resposta);
    } finally {
      setAnexando(null);
    }
  }

  return (
    <AppShell active="Gestão" breadcrumb="Gestão > Bugs e Reports">
      <section className="page-header">
        <div className={styles.headerTitle}>
          <Link className="btn ghost icon-only" href="/gestao" aria-label="Voltar para Gestão">
            <Icon name="chevronLeft" size={18} />
          </Link>
          <span className="icon-badge">
            <Icon name="bug" size={22} />
          </span>
          <div>
            <h1>Bug Reports</h1>
            <p>Bugs, melhorias e features reportados pelos usuários do tenant.</p>
          </div>
        </div>
        <button className="btn" type="button" onClick={recarregar}>
          <Icon name="refresh" size={16} />
          Atualizar
        </button>
      </section>

      <section className={styles.metricas} aria-label="Resumo dos bug reports">
        {METRICAS.map((metrica) => (
          <article className={styles.metrica} data-tom={metrica.tom} key={metrica.chave}>
            <span className={styles.metricaIcon}>
              <Icon name={metrica.icon} size={18} />
            </span>
            <strong>{contadores[metrica.chave] ?? 0}</strong>
            <span>{metrica.rotulo}</span>
          </article>
        ))}
      </section>

      <section className="card pad">
        <div className={styles.filtros}>
          <div className={styles.chips}>
            <span className={styles.rotuloFiltro}>Severidade:</span>
            {SEVERIDADES.map((item) => (
              <button
                className={`btn ${severidade === item.id ? "primary" : "ghost"}`}
                type="button"
                key={item.id}
                onClick={() => setSeveridade(item.id)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Tipo</span>
            <select className="input" value={tipo} onChange={(event) => setTipo(event.target.value)}>
              {TIPOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className={`${styles.busca} field`}>
            <span>Buscar</span>
            <span className="input-with-icon">
              <Icon name="search" size={16} />
              <input
                className="input"
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar título, rota, usuário ou descrição..."
              />
            </span>
          </label>
        </div>
      </section>

      <section className="card pad">
        <header className={styles.listaHeader}>
          <h2>
            <Icon name="bug" size={20} />
            Bug Reports ({contadores.total ?? itens.length})
          </h2>
          {carregando ? <span className="chip warning">Atualizando</span> : null}
        </header>

        {erro ? (
          <div className="empty-state">
            <Icon name="close" size={28} />
            <h3>Não foi possível carregar os reports</h3>
            <p>{erro}</p>
          </div>
        ) : null}

        {!erro && itens.length === 0 ? (
          <div className="empty-state">
            <Icon name="bug" size={28} />
            <h3>Nenhum bug report encontrado</h3>
            <p>Quando houver reportes, eles aparecerão aqui com contexto, rota e logs.</p>
          </div>
        ) : null}

        {!erro && itens.length > 0 ? (
          <div className={styles.lista}>
            {itens.map((item) => {
              const expandido = aberto === item.id;
              return (
                <article className={styles.report} key={item.id} data-aberto={expandido ? "true" : "false"}>
                  <div className={styles.reportHead}>
                    <button
                      className={styles.expansor}
                      type="button"
                      aria-expanded={expandido}
                      onClick={() => setAberto(expandido ? null : item.id)}
                    >
                      <Icon name={expandido ? "chevronDown" : "chevronRight"} size={18} />
                    </button>

                    <div className={styles.reportData}>
                      <strong>{dataCurta(item.criadoEm)}</strong>
                      <span>{item.reportadoPor}</span>
                    </div>

                    <div className={styles.tags}>
                      <span className={styles.chip} data-severidade={item.severidade}>
                        {item.severidadeLabel}
                      </span>
                      <span className={styles.chip} data-tipo={item.tipo}>
                        {item.tipoLabel}
                      </span>
                    </div>

                    <div className={styles.reportTitulo}>
                      <strong>{item.titulo}</strong>
                      <span>{item.rota || "Sem rota"}</span>
                      {item.referencia ? <code>{item.referencia}</code> : null}
                    </div>

                    <div className={styles.reportStatus}>
                      <span className={styles.statusChip} data-status={item.status}>
                        {item.statusLabel}
                      </span>
                      <small>Última: {item.ultimaInteracao || item.atualizadoEm || "N/A"}</small>
                    </div>

                    <div className={styles.acoes}>
                      {item.anexoPath ? (
                        <a className="btn" href={item.anexoPath} target="_blank" rel="noreferrer">
                          <Icon name="paperclip" size={16} />
                          Ver tela
                        </a>
                      ) : (
                        <label className={`btn ${styles.anexoBotao}`} aria-disabled={anexando === item.id}>
                          <Icon name="paperclip" size={16} />
                          {anexando === item.id ? "Anexando..." : "Anexar Tela"}
                          <input
                            className={styles.anexoInput}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,application/pdf"
                            disabled={anexando === item.id}
                            onChange={(event) => {
                              anexarTela(item, event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      <label className={styles.statusSelect}>
                        <span className="sr-only">Mudar status</span>
                        <select
                          className="input"
                          value={item.status}
                          disabled={salvando === item.id}
                          onChange={(event) => mudarStatus(item, event.target.value)}
                        >
                          {STATUS_MUTAVEIS.map((opcao) => (
                            <option key={opcao.id} value={opcao.id}>
                              {opcao.rotulo}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  {expandido ? (
                    <div className={styles.detalhes}>
                      <section className={styles.bloco}>
                        <h3>
                          <Icon name="review" size={16} />
                          Descrição
                        </h3>
                        <p>{item.descricao || "Sem descrição registrada."}</p>
                      </section>

                      <section className={styles.bloco}>
                        <h3>Contexto da Página</h3>
                        <pre>{textoJson(item.contexto)}</pre>
                      </section>

                      <section className={styles.bloco}>
                        <h3>Reportado por</h3>
                        <dl className={styles.metaGrid}>
                          <div>
                            <dt>Nome</dt>
                            <dd>{item.reportadoPor}</dd>
                          </div>
                          <div>
                            <dt>E-mail</dt>
                            <dd>{item.reportadoEmail || "N/A"}</dd>
                          </div>
                          <div>
                            <dt>Criado em</dt>
                            <dd>{item.criadoEm}</dd>
                          </div>
                          <div>
                            <dt>Rota</dt>
                            <dd>{item.rota || "N/A"}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className={styles.bloco}>
                        <h3>Ações do Usuário</h3>
                        {lista(item.acoesUsuario).length ? (
                          <ul className={styles.linhas}>
                            {lista(item.acoesUsuario).map((acao, index) => (
                              <li key={`${item.id}-acao-${index}`}>{typeof acao === "string" ? acao : textoJson(acao)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>Nenhuma ação registrada.</p>
                        )}
                      </section>

                      <section className={styles.blocoLargo}>
                        <h3>
                          <Icon name="alert" size={16} />
                          Requisições com Erro
                        </h3>
                        {lista(item.requisicoesErro).length ? (
                          <div className={styles.erros}>
                            {lista(item.requisicoesErro).map((req, index) => (
                              <pre key={`${item.id}-req-${index}`}>{textoJson(req, "")}</pre>
                            ))}
                          </div>
                        ) : (
                          <p>Nenhuma requisição com erro registrada.</p>
                        )}
                      </section>

                      <section className={styles.blocoLargo}>
                        <h3>Erros do Console</h3>
                        {lista(item.consoleErros).length ? (
                          <div className={styles.erros}>
                            {lista(item.consoleErros).map((log, index) => (
                              <pre key={`${item.id}-console-${index}`}>{textoJson(log, "")}</pre>
                            ))}
                          </div>
                        ) : (
                          <p>Nenhum erro de console registrado.</p>
                        )}
                      </section>

                      <section className={styles.bloco}>
                        <h3>Informações do navegador</h3>
                        <pre>{textoJson(item.browser)}</pre>
                      </section>

                      <section className={styles.bloco}>
                        <h3>Usuário da sessão</h3>
                        <pre>{textoJson(item.usuarioSessao)}</pre>
                      </section>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

