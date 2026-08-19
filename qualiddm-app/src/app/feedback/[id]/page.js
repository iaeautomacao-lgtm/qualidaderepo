"use client";

import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import { SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const MINIMO_MENSAGEM = 20;
const MINIMO_COMENTARIO = 5;

const TIPOS_FEEDBACK = [
  { valor: "elogio", rotulo: "Elogio" },
  { valor: "orientacao", rotulo: "Orientação" },
  { valor: "alerta", rotulo: "Alerta" },
];

const STATUS_FEEDBACK = {
  pendente: { rotulo: "Feedback Pendente", tom: "warning", icone: "clock" },
  assinatura: { rotulo: "Aguardando Assinatura", tom: "info", icone: "edit" },
  concluida: { rotulo: "Feedback Concluído", tom: "success", icone: "checkCircle" },
  justificada: { rotulo: "Feedback Justificado", tom: "info", icone: "info" },
  revisao: { rotulo: "Em Revisão", tom: "warning", icone: "alert" },
  dispensado: { rotulo: "Feedback Dispensado", tom: "success", icone: "check" },
};

/**
 * As três abas que o print traz no topo da ficha.
 *
 * Ordem deliberada: "Feedback" primeiro porque é o que a tela existe para fazer.
 * "Edições" e "Histórico" são consulta — quem entra aqui precisa escrever, não
 * ler, e a aba aberta por padrão tem de ser a do trabalho.
 */
const ABAS = [
  { chave: "feedback", rotulo: "Feedback", icone: "feedback" },
  { chave: "edicoes", rotulo: "Edições", icone: "edit" },
  { chave: "historico", rotulo: "Histórico", icone: "history" },
];

function ou(valor) {
  if (valor === null || valor === undefined) return SEM_VALOR;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : SEM_VALOR;
}

/** Critérios eliminatórios reprovados: é o que zera a monitoria. */
function contarCriticas(ficha) {
  if (!Array.isArray(ficha?.secoes)) return 0;
  return ficha.secoes.reduce(
    (total, secao) =>
      total +
      (secao.criterios ?? []).filter(
        (criterio) => criterio.eliminatoria && criterio.statusChave === "nao_conforme",
      ).length,
    0,
  );
}

export default function FeedbackFichaPage({ params }) {
  const { id } = use(params);
  const codigo = decodeURIComponent(id);

  const [aba, setAba] = useState("feedback");
  const abasRef = useRef(null);

  const ficha = useRecurso(`/api/avaliacoes/${encodeURIComponent(codigo)}`);
  const extras = useRecurso(`/api/feedbacks/${encodeURIComponent(codigo)}`);

  // A rota devolve `{ avaliacao }`, não a ficha na raiz.
  const dados = ficha.dados?.avaliacao ?? null;
  const statusChave = dados?.statusFeedbackChave ?? "pendente";
  const status = STATUS_FEEDBACK[statusChave] ?? STATUS_FEEDBACK.pendente;
  const criticas = useMemo(() => contarCriticas(dados), [dados]);
  const faixa = dados?.scoreNumero == null ? null : faixaDaNota(dados.scoreNumero);

  /* Navegação por setas entre as abas (padrão de tabs do WAI-ARIA). Sem isso o
     teclado precisa de um Tab por aba para chegar no painel. */
  function navegarAbas(evento) {
    const teclas = { ArrowRight: 1, ArrowLeft: -1, Home: 0, End: 0 };
    if (!(evento.key in teclas)) return;
    evento.preventDefault();

    const atual = ABAS.findIndex((item) => item.chave === aba);
    const proximo =
      evento.key === "Home"
        ? 0
        : evento.key === "End"
          ? ABAS.length - 1
          : (atual + teclas[evento.key] + ABAS.length) % ABAS.length;

    setAba(ABAS[proximo].chave);
    abasRef.current?.querySelectorAll("[role='tab']")[proximo]?.focus();
  }

  return (
    <AppShell active="Feedback" breadcrumb="Qualidade > Feedback > Ficha">
      {ficha.erro ? (
        <div className="empty-state">
          <span className="icon-badge danger">
            <Icon name="error" size={22} />
          </span>
          <h3>Não foi possível abrir a ficha</h3>
          <p>{ficha.erro}</p>
          <div className="btn-row">
            <button className="btn primary" type="button" onClick={ficha.recarregar}>
              <Icon name="refresh" size={16} />
              Tentar novamente
            </button>
            <Link className="btn" href="/feedback">
              <Icon name="chevronLeft" size={16} />
              Voltar para a lista
            </Link>
          </div>
        </div>
      ) : !dados ? (
        <div className={styles.esqueleto} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : (
        <div className={styles.quadro}>
          {/* --- identificação ------------------------------------------- */}
          <header className={`card ${styles.cabecalho}`}>
            <div className={styles.identidade}>
              <span className="icon-tile" data-tom="accent">
                <Icon name="checklist" size={20} />
              </span>
              <div className={styles.identidadeTexto}>
                <p className={styles.olho}>Ficha de monitoria</p>
                <h1>{ou(dados.campanha)}</h1>
                <p className={styles.linhaId}>
                  <span className="cell-id">
                    {dados.id}
                    <BotaoCopiar valor={dados.id} />
                  </span>
                  <span aria-hidden="true">·</span>
                  {ou(dados.cliente)}
                  <span aria-hidden="true">·</span>
                  Cód. {ou(dados.codGravacao)}
                </p>
              </div>
            </div>

            <div className={styles.cabecalhoAcoes}>
              <span className={`chip ${status.tom}`}>
                <Icon name={status.icone} size={13} />
                {status.rotulo}
              </span>
              {/* A tela é resumida de propósito; o caminho para a ficha inteira
                  fica sempre visível para quem precisa do detalhe critério por
                  critério. */}
              <Link
                className="btn"
                href={`/avaliacoes/${encodeURIComponent(dados.id)}?voltar=feedback`}
              >
                <Icon name="review" size={15} />
                Ver avaliação inteira
              </Link>
              <Link className="btn" href={`/contestacoes/${encodeURIComponent(dados.id)}`}>
                <Icon name="alert" size={15} />
                Contestar
              </Link>
            </div>
          </header>

          {/* --- números da monitoria ------------------------------------ */}
          <dl className={styles.resumo}>
            <div className={styles.resumoItem}>
              <dt>Nota</dt>
              <dd data-tom={faixa?.tom ?? ""}>
                {dados.score}
                {faixa ? <span className={styles.resumoNota}>{faixa.rotulo}</span> : null}
              </dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Conformes</dt>
              <dd>
                {dados.resumo.conformes}
                <span className={styles.resumoNota}>de {dados.resumo.total}</span>
              </dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Não conformes</dt>
              <dd data-tom={dados.resumo.naoConformes > 0 ? "danger" : ""}>
                {dados.resumo.naoConformes}
              </dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Críticas</dt>
              <dd data-tom={criticas > 0 ? "danger" : ""}>{criticas}</dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Duração</dt>
              <dd>{ou(dados.duracao)}</dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Avaliado</dt>
              <dd className={styles.resumoTexto}>{ou(dados.avaliado?.nome)}</dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Monitor</dt>
              <dd className={styles.resumoTexto}>{ou(dados.avaliador?.nome)}</dd>
            </div>
            <div className={styles.resumoItem}>
              <dt>Prazo do feedback</dt>
              <dd className={styles.resumoTexto}>{ou(dados.prazoFeedback)}</dd>
            </div>
          </dl>

          {/* --- gravação ------------------------------------------------ */}
          <AudioPlayer
            className={styles.player}
            src={dados.audioUrl}
            titulo="Gravação avaliada"
            descricao={`${ou(dados.cliente)} · ${ou(dados.campanha)}`}
            duracaoLabel={dados.duracao}
          />

          {/* --- abas ---------------------------------------------------- */}
          <section className={`card ${styles.painel}`} aria-label="Ações sobre a monitoria">
            <div className={styles.abas} role="tablist" ref={abasRef} onKeyDown={navegarAbas}>
              {ABAS.map((item) => {
                const ativo = aba === item.chave;
                return (
                  <button
                    key={item.chave}
                    className={styles.aba}
                    type="button"
                    role="tab"
                    id={`aba-${item.chave}`}
                    aria-selected={ativo}
                    aria-controls={`painel-${item.chave}`}
                    tabIndex={ativo ? 0 : -1}
                    data-ativo={ativo ? "true" : "false"}
                    onClick={() => setAba(item.chave)}
                  >
                    <Icon name={item.icone} size={15} />
                    {item.rotulo}
                    {item.chave === "edicoes" && extras.dados?.edicoes?.length ? (
                      <span className="count-badge">{extras.dados.edicoes.length}</span>
                    ) : null}
                    {item.chave === "historico" && extras.dados?.comentarios?.itens?.length ? (
                      <span className="count-badge">{extras.dados.comentarios.itens.length}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              className={styles.corpo}
              role="tabpanel"
              id="painel-feedback"
              aria-labelledby="aba-feedback"
              hidden={aba !== "feedback"}
            >
              <AbaFeedback
                ficha={dados}
                onAtualizar={(nova) => ficha.definir({ avaliacao: nova })}
              />
            </div>

            <div
              className={styles.corpo}
              role="tabpanel"
              id="painel-edicoes"
              aria-labelledby="aba-edicoes"
              hidden={aba !== "edicoes"}
            >
              <AbaEdicoes carregando={extras.carregando} edicoes={extras.dados?.edicoes ?? []} />
            </div>

            <div
              className={styles.corpo}
              role="tabpanel"
              id="painel-historico"
              aria-labelledby="aba-historico"
              hidden={aba !== "historico"}
            >
              <AbaHistorico
                carregando={extras.carregando}
                codigo={dados.id}
                comentarios={extras.dados?.comentarios ?? { suportado: true, itens: [] }}
                feedbacks={dados.feedbacks ?? []}
                onAtualizar={(comentarios) =>
                  extras.definir({ ...(extras.dados ?? {}), comentarios })
                }
              />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

/* ==========================================================================
   Aba "Feedback": o formulário do print
   ========================================================================== */

function AbaFeedback({ ficha, onAtualizar }) {
  const [tipo, setTipo] = useState("orientacao");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState("");
  const [erro, setErro] = useState("");

  const registrado = ficha.feedbacks?.[0] ?? null;
  const curta = mensagem.trim().length < MINIMO_MENSAGEM;

  async function enviar(acao) {
    setErro("");
    setEnviando(acao);

    try {
      const resposta = await enviarApi(
        `/api/avaliacoes/${encodeURIComponent(ficha.id)}/feedback`,
        { tipo, acao, mensagem: mensagem.trim() },
      );
      // A rota devolve a ficha recarregada: a tela troca o estado sem um GET
      // extra, e o feedback recém-gravado já aparece no bloco de cima.
      onAtualizar(resposta.avaliacao);
      setMensagem("");
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando("");
    }
  }

  return (
    <div className={styles.conteudo}>
      {registrado ? (
        <article className={styles.registrado}>
          <header>
            <span className="chip success">
              <Icon name="checkCircle" size={13} />
              {registrado.status === "justificada" ? "Justificado" : "Registrado"}
            </span>
            <span>
              {registrado.autor} · {registrado.aplicadoEm || registrado.criadoEm}
            </span>
          </header>
          <p>{registrado.mensagem}</p>
          <p className={styles.registradoNota}>
            Enviar de novo substitui este texto — o feedback é um por monitoria.
          </p>
        </article>
      ) : null}

      <form
        className={styles.formulario}
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!curta) enviar("aplicar");
        }}
      >
        <div className={styles.formLinha}>
          <div className="field">
            <label htmlFor="feedback-tipo">Tipo de feedback</label>
            <select
              className="select"
              id="feedback-tipo"
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value)}
            >
              {TIPOS_FEEDBACK.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="feedback-mensagem">
            Comentários detalhados <span aria-hidden="true">*</span>
          </label>
          <textarea
            className={`input ${styles.area}`}
            id="feedback-mensagem"
            rows={5}
            placeholder="Descreva seu feedback sobre a avaliação como um todo..."
            value={mensagem}
            onChange={(evento) => setMensagem(evento.target.value)}
            aria-describedby="feedback-contador"
          />
          <span className="field-hint" id="feedback-contador">
            {mensagem.trim().length} / {MINIMO_MENSAGEM} caracteres mínimos
          </span>
        </div>

        {erro ? (
          <p className="alert danger">
            <Icon name="alert" size={16} />
            <span className="alert-body">
              <strong>Não foi possível registrar o feedback</strong>
              <span>{erro}</span>
            </span>
          </p>
        ) : null}

        <div className="btn-row">
          <button
            className="btn primary"
            type="submit"
            disabled={curta || Boolean(enviando)}
            aria-describedby={curta ? "feedback-contador" : undefined}
          >
            <Icon name={enviando === "aplicar" ? "spinner" : "send"} size={16} />
            {enviando === "aplicar" ? "Aplicando..." : "Aplicar feedback"}
          </button>
          {/* Justificar também exige texto: "não se aplica" sem motivo escrito é
              exatamente o registro que ninguém consegue auditar depois. */}
          <button
            className="btn"
            type="button"
            disabled={curta || Boolean(enviando)}
            onClick={() => enviar("justificar")}
          >
            <Icon name={enviando === "justificar" ? "spinner" : "info"} size={16} />
            {enviando === "justificar" ? "Justificando..." : "Justificar não aplicar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==========================================================================
   Aba "Edições"
   ========================================================================== */

function AbaEdicoes({ carregando, edicoes }) {
  if (carregando && edicoes.length === 0) {
    return (
      <div className={styles.conteudo} aria-hidden="true">
        <span className={`skeleton ${styles.linhaEsqueleto}`} />
        <span className={`skeleton ${styles.linhaEsqueleto}`} />
      </div>
    );
  }

  if (edicoes.length === 0) {
    return (
      <div className={`empty-state ${styles.vazio}`}>
        <span className="icon-badge">
          <Icon name="edit" size={22} />
        </span>
        <h3>Nenhuma edição registrada</h3>
        <p>Esta monitoria não foi alterada depois de lançada.</p>
      </div>
    );
  }

  return (
    <ol className={`${styles.conteudo} ${styles.linhaDoTempo}`}>
      {edicoes.map((edicao, indice) => (
        <li key={`${edicao.campo}-${edicao.editadoEm}-${indice}`}>
          <div className={styles.eventoTopo}>
            <strong>{edicao.campo}</strong>
            <span>
              {edicao.editadoPor} · {edicao.editadoEm}
            </span>
          </div>
          <p className={styles.mudanca}>
            <span className={styles.valorAntes}>{edicao.valorAnterior ?? SEM_VALOR}</span>
            <Icon name="chevronRight" size={14} />
            <span className={styles.valorDepois}>{edicao.valorNovo ?? SEM_VALOR}</span>
          </p>
          {edicao.motivo ? <p className={styles.motivo}>{edicao.motivo}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/* ==========================================================================
   Aba "Histórico": comentários do supervisor
   ========================================================================== */

function AbaHistorico({ carregando, codigo, comentarios, feedbacks, onAtualizar }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const itens = comentarios.itens ?? [];
  const curto = texto.trim().length < MINIMO_COMENTARIO;

  async function comentar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      const resposta = await enviarApi(
        `/api/feedbacks/${encodeURIComponent(codigo)}/comentarios`,
        { comentario: texto.trim() },
      );
      onAtualizar(resposta.comentarios);
      setTexto("");
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.conteudo}>
      {comentarios.suportado === false ? (
        <p className="alert warning">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Histórico de comentários indisponível neste banco</strong>
            <span>
              Rode a migration <code>006_feedback_comentarios_e_motivo_contestacao.sql</code> para
              habilitar os comentários do supervisor. O restante da ficha funciona normalmente.
            </span>
          </span>
        </p>
      ) : (
        <form className={styles.comentar} onSubmit={comentar}>
          <div className="field">
            <label htmlFor="historico-comentario">Novo comentário</label>
            <textarea
              className={`input ${styles.areaCurta}`}
              id="historico-comentario"
              rows={2}
              placeholder="Registre o que foi tratado com o operador..."
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>
          <button className="btn primary" type="submit" disabled={curto || enviando}>
            <Icon name={enviando ? "spinner" : "send"} size={16} />
            {enviando ? "Enviando..." : "Comentar"}
          </button>
        </form>
      )}

      {erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível comentar</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {carregando && itens.length === 0 ? (
        <span className={`skeleton ${styles.linhaEsqueleto}`} aria-hidden="true" />
      ) : itens.length === 0 && feedbacks.length === 0 ? (
        <div className={`empty-state ${styles.vazio}`}>
          <span className="icon-badge">
            <Icon name="history" size={22} />
          </span>
          <h3>Sem histórico ainda</h3>
          <p>O primeiro comentário sobre esta monitoria aparece aqui.</p>
        </div>
      ) : (
        <ol className={styles.linhaDoTempo}>
          {itens.map((item, indice) => (
            <li key={`${item.criadoEm}-${indice}`}>
              <div className={styles.eventoTopo}>
                <strong>{item.autor}</strong>
                <span>{item.criadoEm}</span>
              </div>
              <p>{item.comentario}</p>
            </li>
          ))}

          {/* O feedback formal fecha o histórico: é o registro mais antigo e mais
              importante da conversa, e deixá-lo fora daria a impressão de que
              ninguém falou com o operador. */}
          {feedbacks.map((item, indice) => (
            <li key={`feedback-${indice}`} data-tipo="feedback">
              <div className={styles.eventoTopo}>
                <strong>
                  <Icon name="feedback" size={13} />
                  Feedback {item.status === "justificada" ? "justificado" : "aplicado"}
                </strong>
                <span>
                  {item.autor} · {item.aplicadoEm || item.criadoEm}
                </span>
              </div>
              <p>{item.mensagem}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
