"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import { Icon } from "@/components/icons";
import { STATUS_PENDENTE, getAvaliacao, tomDoScore } from "@/data/avaliacoes";
import { secoes } from "@/data/seed";
import styles from "./page.module.css";

/**
 * A aba de NEGOCIAÇÃO/COBRANÇA abre por padrão porque é onde está o único
 * critério Não Conforme da avaliação. Quem abre a ficha quer ver o problema,
 * não percorrer as quatro seções até achá-lo.
 */
const ABA_INICIAL = Math.max(
  0,
  secoes.findIndex((secao) => secao.criterios.some((c) => c.status === "Não Conforme")),
);

const ACOES = [
  { rotulo: "Histórico", icone: "history" },
  { rotulo: "Edições", icone: "edit" },
  { rotulo: "Feedback", icone: "feedback" },
  { rotulo: "Exportar PDF", icone: "download" },
];

function contar(secao) {
  const conformes = secao.criterios.filter((c) => c.status === "Conforme").length;
  return { conformes, naoConformes: secao.criterios.length - conformes };
}

export default function FichaAvaliacaoPage({ params }) {
  // Em Next 16 `params` é uma Promise; em componente cliente ela é desembrulhada
  // com `use()`, que suspende até o valor chegar.
  const { id } = use(params);

  const [aba, setAba] = useState(ABA_INICIAL);
  const [copia, setCopia] = useState(null);
  const abasRef = useRef([]);
  const relogioRef = useRef(null);

  useEffect(() => () => clearTimeout(relogioRef.current), []);

  const ficha = getAvaliacao(id);
  if (!ficha) notFound();

  const pendente = ficha.statusFeedback === STATUS_PENDENTE;
  const secaoAtiva = secoes[aba];

  async function copiarId() {
    try {
      await navigator.clipboard.writeText(ficha.id);
      setCopia("ok");
    } catch {
      setCopia("erro");
    }
    clearTimeout(relogioRef.current);
    relogioRef.current = setTimeout(() => setCopia(null), 2600);
  }

  // Setas percorrem as abas em ciclo, Home/End vão aos extremos — o teclado
  // navega a lista de abas, não a tabulação (padrão ARIA de tablist).
  function aoTeclarNaAba(evento, indice) {
    const total = secoes.length;
    let alvo = null;

    if (evento.key === "ArrowRight") alvo = (indice + 1) % total;
    else if (evento.key === "ArrowLeft") alvo = (indice - 1 + total) % total;
    else if (evento.key === "Home") alvo = 0;
    else if (evento.key === "End") alvo = total - 1;

    if (alvo === null) return;
    evento.preventDefault();
    setAba(alvo);
    abasRef.current[alvo]?.focus();
  }

  const metricas = [
    { rotulo: "Cliente", valor: ficha.cliente },
    { rotulo: "Campanha", valor: ficha.campanha },
    { rotulo: "Cód. Gravação", valor: ficha.codGravacao },
    { rotulo: "Score", valor: ficha.score, score: true },
    { rotulo: "Duração", valor: ficha.duracao },
  ];

  const metadados = [
    { rotulo: "Usuário avaliado", valor: ficha.avaliado.nome, largo: true },
    { rotulo: "Formulário", valor: ficha.formulario, largo: true },
    { rotulo: "Monitor", valor: ficha.avaliador.nome },
    { rotulo: "Categoria", valor: ficha.categoria },
    { rotulo: "Data da avaliação", valor: ficha.dataAvaliacao },
    { rotulo: "Data do contato", valor: ficha.dataContato },
    { rotulo: "Prazo feedback", valor: ficha.prazoFeedback },
    { rotulo: "Prazo contestação", valor: ficha.prazoContestacao },
  ];

  const pessoas = [ficha.avaliado, ficha.avaliador, ficha.supervisor];

  const conformidade = [
    { rotulo: "Conformes", valor: ficha.resumo.conformes, tom: "success", icone: "checkCircle" },
    { rotulo: "Não Conformes", valor: ficha.resumo.naoConformes, tom: "danger", icone: "error" },
    { rotulo: "Não Aplicáveis", valor: ficha.resumo.naoAplicaveis, tom: "warning", icone: "info" },
    { rotulo: "Total", valor: ficha.resumo.total, tom: "neutral", icone: "checklist" },
  ];

  return (
    <AppShell active="Dashboard" breadcrumb={`Avaliações > ${ficha.id}`}>
      <div className={styles.ficha}>
        {/* ------------------------------------------------------------------
            1. Cabeçalho + faixa de métricas no mesmo cartão. Separá-los custaria
            mais 48px de altura, e a ficha inteira precisa caber em 900px.
           ------------------------------------------------------------------ */}
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

                <button
                  aria-label={`Copiar o identificador da avaliação ${ficha.id}`}
                  className={`btn ghost ${styles.copiar}`}
                  onClick={copiarId}
                  type="button"
                >
                  <Icon name={copia === "ok" ? "check" : "checklist"} size={14} />
                  {copia === "ok" ? "Copiado" : "Copiar ID"}
                </button>

                {/* Confirmação em texto para leitor de tela — o ícone que troca
                    resolve só para quem enxerga. */}
                <span className="sr-only" role="status">
                  {copia === "ok" ? `Identificador ${ficha.id} copiado.` : null}
                  {copia === "erro"
                    ? "Não foi possível copiar. Selecione o identificador e copie manualmente."
                    : null}
                </span>
              </div>
            </div>

            <div className={styles.heroAcoes}>
              {ACOES.map((acao) => (
                <button className={`btn ${styles.acao}`} key={acao.rotulo} type="button">
                  <Icon name={acao.icone} size={16} />
                  {acao.rotulo}
                </button>
              ))}
            </div>
          </div>

          <dl className={styles.metricas} aria-label="Dados da chamada avaliada">
            {metricas.map((metrica) => (
              <div key={metrica.rotulo}>
                <dt className="label-micro">{metrica.rotulo}</dt>
                <dd>
                  {metrica.score ? (
                    <span className={`score ${tomDoScore(metrica.valor)}`}>
                      {metrica.valor}
                      <span className="sr-only"> pontos</span>
                    </span>
                  ) : (
                    metrica.valor
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className={styles.banda}>
          {/* --------------------------------------------------------------
              2. Coluna de contexto: o áudio e quem está envolvido.
             -------------------------------------------------------------- */}
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

            <section className={`card pad ${styles.cartaoDenso}`} aria-labelledby="pessoas-titulo">
              <h2 className={styles.tituloSecao} id="pessoas-titulo">
                Pessoas envolvidas
              </h2>
              <ul className={styles.pessoas}>
                {pessoas.map((pessoa) => (
                  <li className={styles.pessoa} key={pessoa.papel}>
                    <span className="icon-badge sm neutral" aria-hidden="true">
                      <Icon name="user" size={15} />
                    </span>
                    <span className={styles.pessoaTexto}>
                      <span className="label-micro">{pessoa.papel}</span>
                      <strong>{pessoa.nome}</strong>
                      <a className={styles.pessoaEmail} href={`mailto:${pessoa.email}`}>
                        {pessoa.email}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* --------------------------------------------------------------
              3. Coluna de identificação: metadados e o placar de conformidade.
             -------------------------------------------------------------- */}
          <div className={styles.coluna}>
            <section className={`card pad ${styles.cartaoDenso}`} aria-labelledby="metadados-titulo">
              <h2 className={styles.tituloSecao} id="metadados-titulo">
                Identificação da avaliação
              </h2>
              <dl className={styles.metadados}>
                {metadados.map((dado) => (
                  <div key={dado.rotulo} data-largo={dado.largo ? "true" : undefined}>
                    <dt className="label-micro">{dado.rotulo}</dt>
                    <dd>{dado.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={`card pad ${styles.cartaoDenso}`} aria-labelledby="resumo-titulo">
              <h2 className={styles.tituloSecao} id="resumo-titulo">
                Resumo de Conformidade
              </h2>
              <dl className={styles.resumo}>
                {conformidade.map((linha) => (
                  <div className={styles.resumoItem} data-tom={linha.tom} key={linha.rotulo}>
                    <dt>
                      <Icon name={linha.icone} size={14} />
                      {linha.rotulo}
                    </dt>
                    <dd>{linha.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* --------------------------------------------------------------
              4. Respostas: 25 critérios divididos em abas por seção.
             -------------------------------------------------------------- */}
          <section className={`card pad ${styles.respostas}`} aria-labelledby="respostas-titulo">
            <div className={styles.respostasHead}>
              <h2 className={styles.tituloSecao} id="respostas-titulo">
                Respostas e Avaliações
              </h2>
              <span className="section-meta">{ficha.resumo.total} critérios</span>
            </div>

            <div aria-label="Seções do formulário" className={styles.abas} role="tablist">
              {secoes.map((secao, indice) => {
                const { conformes, naoConformes } = contar(secao);
                const ativa = indice === aba;

                return (
                  <button
                    aria-controls={`painel-${secao.id}`}
                    aria-selected={ativa}
                    className={styles.aba}
                    id={`aba-${secao.id}`}
                    key={secao.id}
                    onClick={() => setAba(indice)}
                    onKeyDown={(evento) => aoTeclarNaAba(evento, indice)}
                    ref={(elemento) => {
                      abasRef.current[indice] = elemento;
                    }}
                    role="tab"
                    tabIndex={ativa ? 0 : -1}
                    type="button"
                  >
                    <span className={styles.abaNome}>{secao.nome}</span>
                    <span className={styles.abaContagem} aria-hidden="true">
                      <span className={styles.abaOk}>
                        <Icon name="check" size={12} />
                        {conformes}
                      </span>
                      {naoConformes > 0 ? (
                        <span className={styles.abaNok}>
                          <Icon name="close" size={12} />
                          {naoConformes}
                        </span>
                      ) : null}
                    </span>
                    <span className="sr-only">
                      {`, ${conformes} conformes e ${naoConformes} não conformes`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              aria-labelledby={`aba-${secaoAtiva.id}`}
              className={styles.painel}
              id={`painel-${secaoAtiva.id}`}
              role="tabpanel"
            >
              {secaoAtiva.descricao ? (
                <p className={styles.painelDescricao}>{secaoAtiva.descricao}</p>
              ) : null}

              <ul className={styles.criterios}>
                {secaoAtiva.criterios.map((criterio) => {
                  const conforme = criterio.status === "Conforme";

                  return (
                    <li className={styles.criterio} data-conforme={conforme} key={criterio.nome}>
                      {/* O enunciado é longo (até 400 caracteres). Ele fica atrás
                          de um disclosure para que os 25 critérios caibam na
                          tela; o que o monitor precisa ver de relance — nome,
                          status, resposta e peso — continua sempre visível. */}
                      <details className={styles.disclosure}>
                        {/* O <summary> só aceita conteúdo de frase e cabeçalho,
                            então o layout é uma grade no próprio summary — sem
                            <div> de apoio, que invalidaria a marcação. */}
                        <summary className={styles.criterioTopo}>
                          <h3 className={styles.criterioNome}>{criterio.nome}</h3>

                          <span className={styles.criterioMeta}>
                            <span>
                              Resposta: <strong>{criterio.resposta ?? "—"}</strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            {criterio.eliminatoria ? (
                              <span className="chip danger">
                                <Icon name="alert" size={12} />
                                Eliminatória
                              </span>
                            ) : (
                              <span>
                                Peso:{" "}
                                <strong>
                                  {criterio.peso === null || criterio.peso === undefined
                                    ? "—"
                                    : `${criterio.peso} pts`}
                                </strong>
                              </span>
                            )}
                          </span>

                          <span className={`chip ${conforme ? "success" : "danger"}`}>
                            <Icon name={conforme ? "check" : "close"} size={12} />
                            {criterio.status}
                          </span>

                          <span className={styles.criterioSeta} aria-hidden="true">
                            <Icon name="chevronDown" size={16} />
                          </span>
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
            </div>
          </section>
        </div>

        <footer className={styles.rodape}>
          <Link className="btn" href="/avaliacoes">
            <Icon name="chevronLeft" size={16} />
            Voltar para Avaliações
          </Link>
        </footer>
      </div>
    </AppShell>
  );
}
