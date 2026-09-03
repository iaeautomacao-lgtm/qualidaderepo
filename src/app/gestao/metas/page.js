"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi, excluirApi } from "@/lib/api";
import styles from "./page.module.css";

/**
 * Metas mensais de monitoria — definir e acompanhar no mesmo lugar.
 *
 * A meta é POR AGENTE ("quantas monitorias cada agente desta campanha deve
 * receber no mês"), como no processo da DDM. O esperado do mês é meta × agentes
 * com monitoria na campanha, e o progresso é o concluído sobre esse esperado.
 *
 * Quando não há agente medido, o progresso aparece como "—" e não como 0%: zero
 * por cento afirma que nada foi feito, e a verdade é que não há como calcular.
 */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function agora() {
  const data = new Date();
  return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
}

export default function MetasPage() {
  const inicial = agora();
  const [ano, setAno] = useState(inicial.ano);
  const [mes, setMes] = useState(inicial.mes);
  const { dados, carregando, erro, recarregar, definir } = useRecurso(`/api/metas?ano=${ano}&mes=${mes}`);

  const [opcoes, setOpcoes] = useState({ clientes: [], campanhas: [] });
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [clienteId, setClienteId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/relatorios/opcoes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (payload?.ok && ativo) {
          setOpcoes({ clientes: payload.data?.clientes ?? [], campanhas: payload.data?.campanhas ?? [] });
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  // Memorizado para o `useMemo` dos totais não recalcular a cada render.
  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const anos = useMemo(() => {
    const atual = agora().ano;
    return [atual - 1, atual, atual + 1];
  }, []);

  // Campanha só das campanhas da operação escolhida: meta de campanha de outra
  // carteira não faz sentido e o banco recusaria pela chave composta.
  const campanhasDaOperacao = useMemo(
    () => opcoes.campanhas.filter((campanha) => !clienteId || campanha.clienteId === clienteId),
    [opcoes.campanhas, clienteId],
  );

  const totais = useMemo(() => {
    const comEsperado = itens.filter((item) => item.esperado != null);
    const esperado = comEsperado.reduce((soma, item) => soma + item.esperado, 0);
    const concluidas = itens.reduce((soma, item) => soma + item.concluidas, 0);
    return {
      metas: itens.length,
      esperado,
      concluidas,
      progresso: esperado > 0 ? Math.round((concluidas / esperado) * 100) : null,
    };
  }, [itens]);

  async function salvar(evento) {
    evento.preventDefault();
    if (salvando) return;

    const formulario = new FormData(evento.currentTarget);
    setSalvando(true);
    setErroAcao("");
    try {
      const resposta = await enviarApi("/api/metas", {
        clienteId: String(formulario.get("clienteId") || ""),
        campanhaId: String(formulario.get("campanhaId") || "") || null,
        ano,
        mes,
        metaAgente: String(formulario.get("metaAgente") || ""),
        metaScore: String(formulario.get("metaScore") || "") || null,
        observacao: String(formulario.get("observacao") || "") || null,
      });
      if (resposta && definir) definir(resposta);
      else await recarregar();
      setFormAberto(false);
      setEditando(null);
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível salvar a meta.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(meta) {
    if (salvando) return;
    setSalvando(true);
    setErroAcao("");
    try {
      const resposta = await excluirApi(`/api/metas/${meta.id}`);
      if (resposta && definir) definir(resposta);
      else await recarregar();
      setConfirmando(null);
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível excluir a meta.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(meta) {
    setEditando(meta);
    setClienteId(meta.clienteId ?? "");
    setFormAberto(true);
    setErroAcao("");
  }

  return (
    <AppShell active="Gestão" breadcrumb="Gestão > Metas mensais">
      <section className={styles.cabecalho}>
        <div className={styles.cabecalhoIdent}>
          <Link className="btn ghost icon-only" href="/gestao">
            <Icon name="chevronLeft" size={16} label="Voltar para Gestão" />
          </Link>
          <span className={styles.marca} aria-hidden="true">
            <Icon name="target" size={22} />
          </span>
          <div>
            <h1>Metas mensais de monitoria</h1>
            <p>Definir a meta por agente e acompanhar o realizado do mês.</p>
          </div>
        </div>

        <div className={styles.cabecalhoAcoes}>
          <div className="field">
            <label className="sr-only" htmlFor="meta-ano">
              Ano
            </label>
            <select
              className="select"
              id="meta-ano"
              value={ano}
              onChange={(evento) => setAno(Number(evento.target.value))}
            >
              {anos.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="sr-only" htmlFor="meta-mes">
              Mês
            </label>
            <select
              className="select"
              id="meta-mes"
              value={mes}
              onChange={(evento) => setMes(Number(evento.target.value))}
            >
              {MESES.map((nome, indice) => (
                <option key={nome} value={indice + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn primary"
            type="button"
            aria-expanded={formAberto}
            onClick={() => {
              setEditando(null);
              setClienteId("");
              setFormAberto((aberto) => !aberto);
              setErroAcao("");
            }}
          >
            <Icon name={formAberto ? "close" : "plus"} size={16} />
            {formAberto ? "Cancelar" : "Nova meta"}
          </button>
        </div>
      </section>

      <section className={styles.kpis} aria-label="Resumo do mês">
        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Metas definidas</p>
          <p className={styles.kpiValor}>{totais.metas}</p>
        </article>
        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Esperado no mês</p>
          <p className={styles.kpiValor}>{totais.esperado || "—"}</p>
          <p className={styles.kpiNota}>meta por agente × agentes com monitoria</p>
        </article>
        <article className={styles.kpi}>
          <p className={styles.kpiRotulo}>Concluídas</p>
          <p className={styles.kpiValor}>{totais.concluidas}</p>
        </article>
        <article className={styles.kpi} data-tom="accent">
          <p className={styles.kpiRotulo}>Progresso</p>
          <p className={styles.kpiValor}>{totais.progresso == null ? "—" : `${totais.progresso}%`}</p>
        </article>
      </section>

      {erro ? (
        <p className="alert danger">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Não foi possível carregar as metas</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {erroAcao ? (
        <p className="alert danger" role="alert">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Operação não concluída</strong>
            <span>{erroAcao}</span>
          </span>
        </p>
      ) : null}

      {formAberto ? (
        <section className={`card pad ${styles.formulario}`} aria-labelledby="titulo-meta">
          <div className="section-head">
            <div>
              <h2 id="titulo-meta">
                {editando ? `Editar meta — ${editando.campanha}` : "Nova meta"} · {MESES[mes - 1]} {ano}
              </h2>
              <p>Salvar sobre a mesma operação e campanha do mês edita a meta em vez de duplicar.</p>
            </div>
          </div>

          <form className={styles.formGrade} onSubmit={salvar}>
            <div className="field">
              <label htmlFor="meta-cliente">Operação *</label>
              <select
                className="select"
                id="meta-cliente"
                name="clienteId"
                required
                value={clienteId}
                onChange={(evento) => setClienteId(evento.target.value)}
              >
                <option value="">Selecione</option>
                {opcoes.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="meta-campanha">Campanha</label>
              <select
                className="select"
                id="meta-campanha"
                name="campanhaId"
                defaultValue={editando?.campanhaId ?? ""}
              >
                <option value="">Todas as campanhas da operação</option>
                {campanhasDaOperacao.map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>
                    {campanha.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="meta-agente">Meta por agente (monitorias/mês) *</label>
              <input
                className="input"
                id="meta-agente"
                name="metaAgente"
                type="number"
                min={1}
                max={999}
                required
                defaultValue={editando?.metaAgente ?? 6}
              />
              <span className="field-hint">
                Quantas monitorias cada agente dessa campanha deve receber no mês.
              </span>
            </div>

            <div className="field">
              <label htmlFor="meta-score">Meta de nota (0–100)</label>
              <input
                className="input"
                id="meta-score"
                name="metaScore"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={editando?.metaScore ?? ""}
              />
              <span className="field-hint">Usada em relatórios e painéis para medir atingimento.</span>
            </div>

            <div className="field">
              <label htmlFor="meta-observacao">Observação</label>
              <input
                className="input"
                id="meta-observacao"
                name="observacao"
                type="text"
                maxLength={400}
                defaultValue={editando?.observacao ?? ""}
              />
            </div>

            <div className="btn-row">
              <button className="btn primary" type="submit" disabled={salvando}>
                <Icon name="check" size={16} />
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setFormAberto(false);
                  setEditando(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card pad" aria-labelledby="tabela-metas">
        <div className="section-head">
          <div>
            <h2 id="tabela-metas">
              {MESES[mes - 1]} de {ano}
            </h2>
            <p>Meta por agente, agentes medidos, concluídas e progresso.</p>
          </div>
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon className={carregando ? "spinning" : undefined} name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
        </div>

        {itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="target" size={20} />
            </span>
            <h3>Nenhuma meta neste mês</h3>
            <p>Defina a meta por agente das campanhas que precisam de acompanhamento.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <caption className="sr-only">
                Metas mensais de {MESES[mes - 1]} de {ano}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Operação</th>
                  <th scope="col">Campanha</th>
                  <th className="num" scope="col">Meta/agente</th>
                  <th className="num" scope="col">Agentes</th>
                  <th className="num" scope="col">Esperado</th>
                  <th className="num" scope="col">Concluídas</th>
                  <th scope="col">Progresso</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((meta) => (
                  <tr key={meta.id}>
                    <th scope="row">{meta.cliente}</th>
                    <td>
                      {meta.campanha}
                      {meta.canalRotulo ? <span className={styles.canal}>{meta.canalRotulo}</span> : null}
                    </td>
                    <td className="num">{meta.metaAgente ?? "—"}</td>
                    <td className="num">{meta.agentes}</td>
                    <td className="num">{meta.esperado ?? "—"}</td>
                    <td className="num">{meta.concluidas}</td>
                    <td>
                      {meta.progresso == null ? (
                        <span className="subtle-text">sem agente medido</span>
                      ) : (
                        <span className={styles.progresso}>
                          <span
                            className="progress-track"
                            role="img"
                            aria-label={`${meta.progresso}% da meta`}
                          >
                            <span
                              className="progress-bar"
                              style={{ "--w": `${Math.min(100, meta.progresso)}%` }}
                            />
                          </span>
                          <strong>{meta.progresso}%</strong>
                        </span>
                      )}
                    </td>
                    <td>
                      {confirmando === meta.id ? (
                        <span className={styles.acoes}>
                          <button
                            className="btn danger"
                            type="button"
                            disabled={salvando}
                            onClick={() => remover(meta)}
                          >
                            Confirmar
                          </button>
                          <button className="btn" type="button" onClick={() => setConfirmando(null)}>
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <span className={styles.acoes}>
                          <button className="btn ghost icon-only" type="button" onClick={() => abrirEdicao(meta)}>
                            <Icon name="edit" size={16} label={`Editar meta de ${meta.campanha}`} />
                          </button>
                          <button
                            className="btn ghost icon-only"
                            type="button"
                            onClick={() => setConfirmando(meta.id)}
                          >
                            <Icon name="trash" size={16} label={`Excluir meta de ${meta.campanha}`} />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
