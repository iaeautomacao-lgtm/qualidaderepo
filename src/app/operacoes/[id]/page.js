"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi, excluirApi } from "@/lib/api";
import styles from "./page.module.css";

/**
 * Campanhas de uma operação — o "Acessar" da tela de Operações.
 *
 * As campanhas são agrupadas por CANAL (Chat e Telefone ativo), como na tela de
 * referência: é assim que a operação pensa o trabalho, e é o corte que separa
 * duas realidades diferentes de atendimento dentro da mesma carteira.
 *
 * Cada cartão mostra o cadastro (status, criação, meta, faixas) e o desempenho
 * do período, porque decidir sobre uma campanha sem ver como ela está indo é
 * decidir no escuro.
 */

const CANAIS = [
  { id: "telefone", rotulo: "Telefone ativo", icone: "mic" },
  { id: "chat", rotulo: "Chat", icone: "feedback" },
];

function texto(valor) {
  return valor == null ? "—" : String(valor).replace(".", ",");
}

export default function OperacaoCampanhasPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/operacoes/${encodeURIComponent(id)}` : null,
  );

  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [confirmando, setConfirmando] = useState(null);

  const operacao = dados?.operacao ?? null;
  const campanhas = dados?.campanhas ?? [];

  async function criarCampanha(evento) {
    evento.preventDefault();
    if (salvando) return;

    const formulario = new FormData(evento.currentTarget);
    setSalvando(true);
    setErroAcao("");
    try {
      await enviarApi("/api/campanhas", {
        clienteId: String(id),
        nome: String(formulario.get("nome") || "").trim(),
        canal: String(formulario.get("canal") || "telefone"),
      });
      setFormAberto(false);
      await recarregar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível criar a campanha.");
    } finally {
      setSalvando(false);
    }
  }

  async function removerCampanha(campanha) {
    if (salvando) return;
    setSalvando(true);
    setErroAcao("");
    try {
      await excluirApi(`/api/campanhas/${campanha.id}`);
      setConfirmando(null);
      await recarregar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível excluir a campanha.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && !operacao) {
    return (
      <AppShell active="Operações" breadcrumb="Cadastro > Operações">
        <div className={styles.esqueleto} aria-busy="true">
          <div className={`skeleton ${styles.esqueletoHero}`} />
          <div className={`skeleton ${styles.esqueletoBloco}`} />
        </div>
      </AppShell>
    );
  }

  if (erro || !operacao) {
    return (
      <AppShell active="Operações" breadcrumb="Cadastro > Operações">
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h1>Não foi possível abrir a operação</h1>
            <p>{erro || "Operação não encontrada."}</p>
            <div className="btn-row">
              <Link className="btn primary" href="/operacoes">
                <Icon name="chevronLeft" size={16} />
                Voltar para Operações
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="Operações" breadcrumb={`Operações > ${operacao.nome}`}>
      <section className={styles.cabecalho}>
        <div className={styles.cabecalhoIdent}>
          <Link className="btn ghost icon-only" href="/operacoes">
            <Icon name="chevronLeft" size={16} label="Voltar para Operações" />
          </Link>
          <span className={styles.marca} aria-hidden="true">
            <Icon name="target" size={22} />
          </span>
          <div>
            <h1>Campanhas — {operacao.nome}</h1>
            <p>
              {operacao.campanhas ?? campanhas.length} campanha(s) ·{" "}
              {operacao.contrato ? `contrato ${operacao.contrato} · ` : ""}
              criada em {operacao.criadaEm}
            </p>
          </div>
          <span className={`chip ${operacao.ativo ? "success" : "warning"}`}>
            {operacao.ativo ? "Ativa" : "Inativa"}
          </span>
        </div>

        <div className={styles.cabecalhoAcoes}>
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon className={carregando ? "spinning" : undefined} name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
          <button
            className="btn primary"
            type="button"
            aria-expanded={formAberto}
            onClick={() => setFormAberto((aberto) => !aberto)}
          >
            <Icon name={formAberto ? "close" : "plus"} size={16} />
            {formAberto ? "Cancelar" : "Nova campanha"}
          </button>
        </div>
      </section>

      {/* Desempenho da operação inteira antes das campanhas: o total é o que
          responde "como está a carteira", e a quebra por canal diz onde olhar. */}
      <section className={`card pad ${styles.resumo}`} aria-labelledby="resumo-operacao">
        <div className="section-head">
          <div>
            <h2 id="resumo-operacao">Desempenho da operação</h2>
            <p>Últimos 31 dias, somando monitoria com formulário e análise da IA.</p>
          </div>
        </div>

        <dl className={styles.resumoNumeros}>
          <div>
            <dt>Monitorias</dt>
            <dd>{operacao.monitorias}</dd>
          </div>
          <div>
            <dt>Nota</dt>
            <dd data-tom={operacao.score != null && operacao.score < 70 ? "danger" : "accent"}>
              {texto(operacao.score)}
            </dd>
          </div>
          <div>
            <dt>Não conformidades</dt>
            <dd data-tom={operacao.naoConformes > 0 ? "warning" : undefined}>{operacao.naoConformes}</dd>
          </div>
          <div>
            <dt>Críticas</dt>
            <dd data-tom={operacao.criticas > 0 ? "danger" : undefined}>{operacao.criticas}</dd>
          </div>
        </dl>

        <ul className={styles.canaisResumo}>
          {(operacao.canais || []).map((canal) => (
            <li key={canal.canal} data-vazio={canal.monitorias === 0 ? "true" : undefined}>
              <span className={styles.canalRotulo}>{canal.rotulo}</span>
              <span className={styles.canalNota}>{texto(canal.score)}</span>
              <span className={styles.canalMeta}>
                {canal.monitorias} monitoria(s)
                {canal.naoConformes > 0 ? ` · ${canal.naoConformes} falha(s)` : ""}
                {canal.criticas > 0 ? ` · ${canal.criticas} crítica(s)` : ""}
              </span>
            </li>
          ))}
        </ul>

        {operacao.insight ? (
          <p className={styles.insight}>
            <Icon name="sparkles" size={15} />
            {operacao.insight}
          </p>
        ) : null}
      </section>

      {formAberto ? (
        <section className={`card pad ${styles.formulario}`} aria-labelledby="nova-campanha">
          <div className="section-head">
            <div>
              <h2 id="nova-campanha">Nova campanha em {operacao.nome}</h2>
              <p>O canal define em qual grupo a campanha aparece nesta tela.</p>
            </div>
          </div>

          <form className={styles.formGrade} onSubmit={criarCampanha}>
            <div className="field">
              <label htmlFor="campanha-nome">Nome da campanha *</label>
              <input
                className="input"
                id="campanha-nome"
                name="nome"
                type="text"
                required
                minLength={2}
                maxLength={160}
                placeholder="Ex.: Telefone ativo"
              />
            </div>

            <div className="field">
              <label htmlFor="campanha-canal">Canal *</label>
              <select className="select" defaultValue="telefone" id="campanha-canal" name="canal" required>
                {CANAIS.map((canal) => (
                  <option key={canal.id} value={canal.id}>
                    {canal.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="btn-row">
              <button className="btn primary" type="submit" disabled={salvando}>
                <Icon name="check" size={16} />
                {salvando ? "Salvando..." : "Criar campanha"}
              </button>
              <button className="btn" type="button" onClick={() => setFormAberto(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
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

      {CANAIS.map((canal) => {
        const doCanal = campanhas.filter((campanha) => campanha.canal === canal.id);

        return (
          <section className={styles.grupo} key={canal.id} aria-labelledby={`canal-${canal.id}`}>
            <div className={styles.grupoTopo}>
              <span className={styles.grupoIcone} aria-hidden="true">
                <Icon name={canal.icone} size={18} />
              </span>
              <h2 id={`canal-${canal.id}`}>{canal.rotulo}</h2>
              <span className="count-badge">{doCanal.length}</span>
            </div>

            {doCanal.length === 0 ? (
              <p className={styles.grupoVazio}>
                Nenhuma campanha de {canal.rotulo.toLowerCase()} nesta operação.
              </p>
            ) : (
              <ul className={styles.grade}>
                {doCanal.map((campanha) => (
                  <li key={campanha.id}>
                    <article
                      className={`card pad ${styles.cartao}`}
                      data-inativo={campanha.ativa ? undefined : "true"}
                    >
                      <header className={styles.cartaoTopo}>
                        <span className={styles.cartaoIcone} aria-hidden="true">
                          <Icon name={canal.icone} size={20} />
                        </span>
                        <h3>{campanha.nome}</h3>
                        <span className={`chip ${campanha.ativa ? "success" : "warning"}`}>
                          {campanha.ativa ? "Ativa" : "Inativa"}
                        </span>
                      </header>

                      <dl className={styles.cartaoCampos}>
                        <div>
                          <dt>Criada em</dt>
                          <dd>{campanha.criadaEm}</dd>
                        </div>
                        <div>
                          <dt>Meta de nota</dt>
                          <dd>{campanha.metaScore == null ? "—" : `${texto(campanha.metaScore)}`}</dd>
                        </div>
                        <div>
                          <dt>Conjunto de faixas</dt>
                          <dd>{campanha.faixaConjunto || "Padrão"}</dd>
                        </div>
                        <div>
                          <dt>Formulários</dt>
                          <dd>{campanha.formularios ?? "—"}</dd>
                        </div>
                      </dl>

                      <dl className={styles.cartaoDesempenho}>
                        <div>
                          <dt>Monitorias</dt>
                          <dd>{campanha.monitorias}</dd>
                        </div>
                        <div>
                          <dt>Nota</dt>
                          <dd data-tom={campanha.score != null && campanha.score < 70 ? "danger" : "accent"}>
                            {texto(campanha.score)}
                          </dd>
                        </div>
                        <div>
                          <dt>Falhas</dt>
                          <dd data-tom={campanha.naoConformes > 0 ? "warning" : undefined}>
                            {campanha.naoConformes}
                          </dd>
                        </div>
                        <div>
                          <dt>Críticas</dt>
                          <dd data-tom={campanha.criticas > 0 ? "danger" : undefined}>{campanha.criticas}</dd>
                        </div>
                      </dl>

                      {campanha.insight ? (
                        <p className={styles.insightCartao}>
                          <Icon name="sparkles" size={14} />
                          {campanha.insight}
                        </p>
                      ) : null}

                      <div className={styles.cartaoAcoes}>
                        {/* Gerenciar vem primeiro: é onde se configura a régua da
                            campanha. "Ver monitorias" é consulta. */}
                        <Link className="btn primary" href={`/campanhas/${campanha.id}`}>
                          <Icon name="settings" size={16} />
                          Gerenciar
                        </Link>
                        <Link className="btn" href={`/avaliacoes?campanha=${encodeURIComponent(campanha.nome)}`}>
                          <Icon name="review" size={16} />
                          Ver monitorias
                        </Link>

                        {confirmando === campanha.id ? (
                          <span className={styles.confirmar}>
                            <span>Confirma?</span>
                            <button
                              className="btn danger"
                              type="button"
                              disabled={salvando}
                              onClick={() => removerCampanha(campanha)}
                            >
                              <Icon name="trash" size={16} />
                              Excluir
                            </button>
                            <button className="btn" type="button" onClick={() => setConfirmando(null)}>
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button className="btn" type="button" onClick={() => setConfirmando(campanha.id)}>
                            <Icon name="trash" size={16} />
                            Excluir
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {/* Campanha com canal fora de Chat/Telefone existe no banco (e-mail,
          WhatsApp, offline). Ela aparece aqui em vez de desaparecer da tela. */}
      {campanhas.some((campanha) => !CANAIS.some((canal) => canal.id === campanha.canal)) ? (
        <section className={styles.grupo} aria-labelledby="canal-outros">
          <div className={styles.grupoTopo}>
            <span className={styles.grupoIcone} aria-hidden="true">
              <Icon name="layers" size={18} />
            </span>
            <h2 id="canal-outros">Outros canais</h2>
          </div>
          <ul className={styles.grade}>
            {campanhas
              .filter((campanha) => !CANAIS.some((canal) => canal.id === campanha.canal))
              .map((campanha) => (
                <li key={campanha.id}>
                  <article className={`card pad ${styles.cartao}`}>
                    <header className={styles.cartaoTopo}>
                      <h3>{campanha.nome}</h3>
                      <span className="chip">{campanha.canalRotulo}</span>
                    </header>
                    <dl className={styles.cartaoDesempenho}>
                      <div>
                        <dt>Monitorias</dt>
                        <dd>{campanha.monitorias}</dd>
                      </div>
                      <div>
                        <dt>Nota</dt>
                        <dd>{texto(campanha.score)}</dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
