"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

const STATUS_PENDENTE = "Feedback Pendente";

function tomDoScore(score) {
  const valor = Number(score);
  if (valor >= 90) return "success";
  if (valor >= 80) return "warning";
  return "danger";
}

function contar(secao) {
  const conformes = secao.criterios.filter((criterio) => criterio.status === "Conforme").length;
  return { conformes, naoConformes: secao.criterios.length - conformes };
}

function PainelModal({ ficha, tipo }) {
  if (tipo === "feedback") {
    const feedbacks = ficha.feedbacks || [];
    return feedbacks.length > 0 ? (
      feedbacks.map((feedback) => (
        <article className={styles.modalItem} key={`${feedback.criadoEm}-${feedback.status}`}>
          <strong>{feedback.status}</strong>
          <p>{feedback.mensagem || "Sem mensagem registrada."}</p>
          <span>{feedback.autor} · {feedback.criadoEm}</span>
        </article>
      ))
    ) : (
      <p className={styles.modalVazio}>Nenhum feedback registrado no banco para esta avaliação.</p>
    );
  }

  const historico = (ficha.historico || []).filter((item) =>
    tipo === "edicoes" ? /edi|edit/.test(item.acao?.toLowerCase() || "") : true
  );

  return historico.length > 0 ? (
    historico.map((item) => (
      <article className={styles.modalItem} key={`${item.criadoEm}-${item.acao}`}>
        <strong>{item.acao}</strong>
        <p>{item.detalhe || "Sem detalhe registrado."}</p>
        <span>{item.usuario} · {item.criadoEm}</span>
      </article>
    ))
  ) : (
    <p className={styles.modalVazio}>Nenhum registro encontrado no histórico desta avaliação.</p>
  );
}

export default function FichaAvaliacaoPage({ params }) {
  const { id } = use(params);
  const [ficha, setFicha] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState(0);
  const [painel, setPainel] = useState(null);

  useEffect(() => {
    let ativo = true;

    fetch(`/api/avaliacoes/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar a avaliação.");
        if (ativo) setFicha(payload.data.avaliacao);
      })
      .catch((error) => {
        if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível carregar a avaliação.");
      });

    return () => {
      ativo = false;
    };
  }, [id]);

  if (erro) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > ${id}`}>
        <section className="card pad">
          <div className="empty-state">
            <Icon name="error" size={38} />
            <h1>Não foi possível carregar avaliação</h1>
            <p>{erro}</p>
            <Link className="btn" href="/avaliacoes">
              Voltar para Avaliações
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!ficha) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > ${id}`}>
        <div className="empty-state">
          <Icon name="review" size={32} />
          <h1>Carregando avaliação</h1>
          <p>Buscando os dados no banco.</p>
        </div>
      </AppShell>
    );
  }

  const secoes = ficha.secoes || [];
  const secaoAtiva = secoes[Math.min(aba, Math.max(secoes.length - 1, 0))];
  const pendente = ficha.statusFeedback === STATUS_PENDENTE;

  const metricas = [
    { rotulo: "Cliente", valor: ficha.cliente },
    { rotulo: "Campanha", valor: ficha.campanha },
    { rotulo: "Cód. Gravação", valor: ficha.codGravacao },
    { rotulo: "Score", valor: ficha.score, score: true },
    { rotulo: "Duração", valor: ficha.duracao },
  ];

  return (
    <AppShell active="Avaliações" breadcrumb={`Avaliações > ${ficha.id}`}>
      <div className={styles.ficha}>
        <header className={`card ${styles.hero}`}>
          <div className={styles.heroTopo}>
            <span className="icon-badge" aria-hidden="true">
              <Icon name="review" size={18} />
            </span>

            <div className={styles.heroIdent}>
              <h1 className={styles.heroTitulo}>{ficha.formulario}</h1>
              <div className={styles.heroLinha}>
                <span className={`chip ${pendente ? "warning" : "success"}`}>
                  <Icon name={pendente ? "clock" : "checkCircle"} size={13} />
                  {ficha.statusFeedback}
                </span>
                <span className={styles.heroId}>
                  ID: <strong>{ficha.id}</strong>
                </span>
              </div>
            </div>

            <div className={styles.heroAcoes}>
              <button className={`btn ${styles.acao}`} type="button" onClick={() => setPainel("historico")}>
                <Icon name="history" size={16} />
                Histórico
              </button>
              <button className={`btn ${styles.acao}`} type="button" onClick={() => setPainel("edicoes")}>
                <Icon name="edit" size={16} />
                Edições
              </button>
              <button className={`btn ${styles.acao}`} type="button" onClick={() => setPainel("feedback")}>
                <Icon name="feedback" size={16} />
                Feedback
              </button>
              <button className={`btn ${styles.acao}`} type="button" onClick={() => window.print()}>
                <Icon name="download" size={16} />
                Exportar PDF
              </button>
            </div>
          </div>

          <dl className={styles.metricas} aria-label="Dados da chamada avaliada">
            {metricas.map((metrica) => (
              <div key={metrica.rotulo}>
                <dt className="label-micro">{metrica.rotulo}</dt>
                <dd>
                  {metrica.score ? (
                    <span className={`score ${tomDoScore(metrica.valor)}`}>{metrica.valor}</span>
                  ) : (
                    metrica.valor
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className={styles.banda}>
          <div className={styles.coluna}>
            <section className={`card pad ${styles.cartaoDenso}`}>
              <AudioPlayer
                className={styles.player}
                duration={ficha.duracaoAudio}
                format={`gravação ${ficha.codGravacao}`}
                emptyTitle="Áudio não disponível na prévia"
                emptyHint="Aguardando a integração com o discador."
              />
            </section>

            <section className={`card pad ${styles.cartaoDenso}`}>
              <h2 className={styles.tituloSecao}>Pessoas envolvidas</h2>
              <ul className={styles.pessoas}>
                {[ficha.avaliado, ficha.avaliador, ficha.supervisor].map((pessoa) => (
                  <li className={styles.pessoa} key={pessoa.papel}>
                    <span className="icon-badge sm neutral" aria-hidden="true">
                      <Icon name="user" size={15} />
                    </span>
                    <span className={styles.pessoaTexto}>
                      <span className="label-micro">{pessoa.papel}</span>
                      <strong>{pessoa.nome}</strong>
                      <span className={styles.pessoaEmail}>{pessoa.email}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className={styles.coluna}>
            <section className={`card pad ${styles.cartaoDenso}`}>
              <h2 className={styles.tituloSecao}>Identificação da avaliação</h2>
              <dl className={styles.metadados}>
                <div data-largo="true">
                  <dt className="label-micro">Usuário avaliado</dt>
                  <dd>{ficha.avaliado.nome}</dd>
                </div>
                <div data-largo="true">
                  <dt className="label-micro">Formulário</dt>
                  <dd>{ficha.formulario}</dd>
                </div>
                <div>
                  <dt className="label-micro">Monitor</dt>
                  <dd>{ficha.avaliador.nome}</dd>
                </div>
                <div>
                  <dt className="label-micro">Categoria</dt>
                  <dd>{ficha.categoria}</dd>
                </div>
                <div>
                  <dt className="label-micro">Data da avaliação</dt>
                  <dd>{ficha.dataAvaliacao}</dd>
                </div>
                <div>
                  <dt className="label-micro">Data do contato</dt>
                  <dd>{ficha.dataContato}</dd>
                </div>
              </dl>
            </section>

            <section className={`card pad ${styles.cartaoDenso}`}>
              <h2 className={styles.tituloSecao}>Resumo de Conformidade</h2>
              <dl className={styles.resumo}>
                <div className={styles.resumoItem} data-tom="success">
                  <dt>Conformes</dt>
                  <dd>{ficha.resumo.conformes}</dd>
                </div>
                <div className={styles.resumoItem} data-tom="danger">
                  <dt>Não Conformes</dt>
                  <dd>{ficha.resumo.naoConformes}</dd>
                </div>
                <div className={styles.resumoItem} data-tom="warning">
                  <dt>Não Aplicáveis</dt>
                  <dd>{ficha.resumo.naoAplicaveis}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className={`card pad ${styles.respostas}`}>
            <div className={styles.respostasHead}>
              <h2 className={styles.tituloSecao}>Respostas e Avaliações</h2>
              <span className="section-meta">{ficha.resumo.total} critérios</span>
            </div>

            {secoes.length === 0 ? (
              <div className="empty-state">
                <Icon name="checklist" size={32} />
                <h3>Nenhuma resposta registrada</h3>
                <p>A avaliação existe, mas ainda não possui respostas vinculadas.</p>
              </div>
            ) : (
              <>
                <div className={styles.abas} role="tablist" aria-label="Seções do formulário">
                  {secoes.map((secao, index) => {
                    const total = contar(secao);
                    return (
                      <button
                        aria-selected={index === aba}
                        className={styles.aba}
                        key={secao.id}
                        onClick={() => setAba(index)}
                        role="tab"
                        type="button"
                      >
                        <span className={styles.abaNome}>{secao.nome}</span>
                        <span className={styles.abaContagem}>
                          <span className={styles.abaOk}>{total.conformes}</span>
                          {total.naoConformes > 0 ? <span className={styles.abaNok}>{total.naoConformes}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <ul className={styles.criterios}>
                  {secaoAtiva.criterios.map((criterio) => {
                    const conforme = criterio.status === "Conforme";
                    return (
                      <li className={styles.criterio} data-conforme={conforme} key={criterio.nome}>
                        <details className={styles.disclosure}>
                          <summary className={styles.criterioTopo}>
                            <h3 className={styles.criterioNome}>{criterio.nome}</h3>
                            <span className={styles.criterioMeta}>
                              Resposta: <strong>{criterio.resposta ?? "-"}</strong>
                            </span>
                            <span className={`chip ${conforme ? "success" : "danger"}`}>{criterio.status}</span>
                          </summary>
                          <p className={styles.criterioEnunciado}>{criterio.enunciado}</p>
                        </details>
                        {criterio.observacao ? (
                          <div className={styles.observacao}>
                            <p className="label-micro">Observação do Monitor</p>
                            <p>{criterio.observacao}</p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>

        <footer className={styles.rodape}>
          <Link className="btn" href="/avaliacoes">
            <Icon name="chevronLeft" size={16} />
            Voltar para Avaliações
          </Link>
        </footer>

        {painel ? (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setPainel(null)}>
            <section className={`card ${styles.modal}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <header className={styles.modalHead}>
                <h2>{painel === "historico" ? "Histórico" : painel === "edicoes" ? "Edições" : "Feedback"}</h2>
                <button className="btn ghost" type="button" aria-label="Fechar painel" onClick={() => setPainel(null)}>
                  <Icon name="close" size={16} />
                </button>
              </header>
              <div className={styles.modalLista}>
                <PainelModal ficha={ficha} tipo={painel} />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
