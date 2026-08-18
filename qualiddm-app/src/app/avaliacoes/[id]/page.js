"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import ChatIa from "@/components/ChatIa";
import CriterioCard, { normalizarCriterio, percentual } from "@/components/CriterioCard";
import ResumoConformidade from "@/components/ResumoConformidade";
import TranscricaoFalantes from "@/components/TranscricaoFalantes";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { normalizar } from "@/lib/formato";
import styles from "./page.module.css";

const MINIMO_MENSAGEM = 20;

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

/** Aceita a chave nova do contrato ou o rótulo antigo em texto livre. */
function chaveStatusFeedback(ficha) {
  const bruto = normalizar(ficha?.statusFeedbackChave ?? ficha?.statusFeedback);
  const chave = Object.keys(STATUS_FEEDBACK).find((item) => bruto.includes(item));
  return chave || "pendente";
}

function tomDoScore(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  if (numero >= 90) return "success";
  if (numero >= 80) return "warning";
  return "danger";
}

/** Campo ausente vira "N/A" — é o que o QualiTalk mostra e o que o monitor espera. */
function ou(valor) {
  if (valor === null || valor === undefined) return "N/A";
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : "N/A";
}

/**
 * Para onde o rodapé volta, conforme `?voltar=` na URL.
 *
 * Lista fechada de propósito: o destino vira um `href`, e aceitar valor livre
 * da query string transformaria o botão em redirecionador aberto.
 */
const RETORNOS = {
  feedback: { href: "/feedback", rotulo: "Voltar para Feedbacks" },
};

const RETORNO_PADRAO = { href: "/avaliacoes", rotulo: "Voltar para Avaliações" };

export default function FichaAvaliacaoPage({ params }) {
  const { id } = use(params);

  // `useSearchParams` (lido no rodapé, para saber de onde o usuário veio) exige
  // um limite de Suspense sob renderização estática. O esqueleto é esse limite.
  return (
    <Suspense
      fallback={
        <AppShell active="Avaliações" breadcrumb={`Avaliações > ${id}`}>
          <EsqueletoFicha />
        </AppShell>
      }
    >
      <FichaConteudo id={id} />
    </Suspense>
  );
}

function FichaConteudo({ id }) {
  const parametrosUrl = useSearchParams();
  const retorno = RETORNOS[parametrosUrl?.get("voltar")] ?? RETORNO_PADRAO;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/avaliacoes/${encodeURIComponent(id)}` : null,
  );

  // A resposta do POST de feedback já devolve a ficha recarregada (seção 7 do
  // contrato), então ela substitui o que veio do GET sem um segundo request.
  const [fichaSalva, setFichaSalva] = useState(null);
  const [recolhido, setRecolhido] = useState(false);
  const [soNaoConformes, setSoNaoConformes] = useState(false);
  const [painel, setPainel] = useState(null);
  const gatilhoRef = useRef(null);

  // Trocar de avaliação sem sair da rota reaproveita este componente: sem zerar
  // aqui, a ficha recarregada pelo feedback anterior continuaria na tela.
  const [idAnterior, setIdAnterior] = useState(id);
  if (id !== idAnterior) {
    setIdAnterior(id);
    setFichaSalva(null);
    setPainel(null);
    setSoNaoConformes(false);
  }

  const ficha = fichaSalva ?? dados?.avaliacao ?? null;

  const secoes = useMemo(() => {
    const lista = Array.isArray(ficha?.secoes) ? ficha.secoes : [];
    return lista.map((secao, indice) => {
      const criterios = (Array.isArray(secao?.criterios) ? secao.criterios : []).map(
        (criterio, posicao) => normalizarCriterio(criterio, `${indice}-${posicao}`),
      );
      return {
        ancora: `secao-${secao?.id ?? indice}`,
        nome: secao?.nome || `Seção ${indice + 1}`,
        descricao: secao?.descricao || null,
        criterios,
        naoConformes: criterios.filter((item) => item.statusChave === "nao_conforme").length,
      };
    });
  }, [ficha]);

  const fecharPainel = useCallback(() => {
    setPainel(null);
    // Devolve o foco ao botão que abriu o painel (WCAG 2.4.3).
    gatilhoRef.current?.focus();
  }, []);

  function abrirPainel(tipo, evento) {
    gatilhoRef.current = evento.currentTarget;
    setPainel(tipo);
  }

  if (carregando && !ficha) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > ${id}`}>
        <EsqueletoFicha />
      </AppShell>
    );
  }

  if (erro || !ficha) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > ${id}`}>
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h1>Não foi possível abrir a ficha</h1>
            <p>{erro || "A avaliação não foi encontrada no banco."}</p>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar de novo
              </button>
              <Link className="btn" href={retorno.href}>
                <Icon name="chevronLeft" size={16} />
                {retorno.rotulo}
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const status = STATUS_FEEDBACK[chaveStatusFeedback(ficha)];
  const origemIa = normalizar(ficha.origem) === "ia";
  const ia = ficha.ia && typeof ficha.ia === "object" ? ficha.ia : null;
  const scoreNumero = Number.isFinite(Number(ficha.scoreNumero))
    ? Number(ficha.scoreNumero)
    : Number.parseFloat(ficha.score);
  const totalNaoConformes = secoes.reduce((soma, secao) => soma + secao.naoConformes, 0);

  // `audioUrl` já vem `null` quando o arquivo não está no armazenamento, então
  // a tela nunca monta a rota por conta própria: player quebrado é pior que
  // player ausente. `audioPath` só serve para explicar o motivo da ausência.
  const audioUrl = ficha.audioUrl || null;

  const metricasPrincipais = [
    { rotulo: "Cliente", valor: ficha.cliente },
    { rotulo: "Campanha", valor: ficha.campanha },
    { rotulo: "Cód. Gravação", valor: ficha.codGravacao },
    { rotulo: "Score", valor: ficha.score, score: true },
    { rotulo: "Duração", valor: ficha.duracao },
  ];

  const metricasIdentificacao = [
    { rotulo: "Usuário Avaliado", valor: ficha.avaliado?.nome },
    { rotulo: "Monitor", valor: ficha.avaliador?.nome },
    { rotulo: "Formulário", valor: ficha.formulario },
    { rotulo: "Categoria", valor: ficha.categoria },
    { rotulo: "Data da Avaliação", valor: ficha.dataAvaliacao },
    { rotulo: "Data do Contato", valor: ficha.dataContato },
    { rotulo: "Prazo Feedback", valor: ficha.prazoFeedback },
    { rotulo: "Prazo Contestação", valor: ficha.prazoContestacao },
  ];

  const pessoas = [
    { titulo: "Avaliado", papel: "Nome", pessoa: ficha.avaliado },
    { titulo: "Avaliador", papel: "Monitor", pessoa: ficha.avaliador },
    { titulo: "Supervisor", papel: "Supervisor", pessoa: ficha.supervisor },
  ];

  const criteriosVisiveis = soNaoConformes
    ? secoes
        .map((secao) => ({
          ...secao,
          criterios: secao.criterios.filter((item) => item.statusChave === "nao_conforme"),
        }))
        .filter((secao) => secao.criterios.length > 0)
    : secoes;

  return (
    <AppShell active="Avaliações" breadcrumb={`Avaliações > ${ficha.id}`}>
      <div className={styles.ficha}>
        <header className={styles.hero}>
          <div className={styles.heroTopo}>
            <span className={styles.heroIcone} aria-hidden="true">
              <Icon name="review" size={22} />
            </span>

            <div className={styles.heroIdent}>
              {/* Título como no QualiTalk: "FICHA DE MONITORIA – {campanha}". O
                  nome do formulário sobe para a linha de contexto porque é o que
                  identifica QUAL ficha foi aplicada — e ele repete na faixa 2. */}
              <p className={styles.heroSobre}>{ou(ficha.formulario)}</p>
              <h1 className={styles.heroTitulo}>
                Ficha de Monitoria
                {ficha.campanha ? ` – ${ficha.campanha}` : ""}
              </h1>
              <div className={styles.heroSelos}>
                <span className={`chip ${status.tom}`}>
                  <Icon name={status.icone} size={13} />
                  {ficha.statusFeedback || status.rotulo}
                </span>
                {origemIa ? (
                  <span className="chip info">
                    <Icon name="robot" size={13} />
                    Gerada por IA
                  </span>
                ) : null}
                {ficha.quadrante ? <span className="chip">Quadrante {ficha.quadrante}</span> : null}
                {ficha.zerada ? (
                  <span className="chip danger">
                    <Icon name="alert" size={13} />
                    Ficha zerada
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.heroAcoes}>
              <button className="btn" type="button" onClick={(evento) => abrirPainel("historico", evento)}>
                <Icon name="history" size={16} />
                Histórico
              </button>
              <button className="btn" type="button" onClick={(evento) => abrirPainel("edicoes", evento)}>
                <Icon name="edit" size={16} />
                Edições
              </button>
              <button className="btn" type="button" onClick={(evento) => abrirPainel("feedback", evento)}>
                <Icon name="feedback" size={16} />
                Feedback
              </button>
              <button className="btn" type="button" onClick={() => window.print()}>
                <Icon name="printer" size={16} />
                Exportar PDF
              </button>
              <button
                className="btn"
                type="button"
                aria-expanded={!recolhido}
                aria-controls="ficha-metadados"
                onClick={() => setRecolhido((atual) => !atual)}
              >
                <Icon name={recolhido ? "chevronDown" : "chevronUp"} size={16} />
                {recolhido ? "Mostrar dados" : "Recolher dados"}
              </button>
            </div>
          </div>

          <p className={styles.heroLinha}>
            Avaliação - Visualizar e Dar Feedback <span aria-hidden="true">•</span>{" "}
            <span className={styles.heroId}>
              ID: <strong>{ficha.id}</strong>
              <BotaoCopiar valor={String(ficha.id)} rotulo="ID da avaliação" />
            </span>
          </p>

          <div className={styles.heroDados} id="ficha-metadados" hidden={recolhido}>
            <dl className={styles.faixaPrincipal}>
              {metricasPrincipais.map((metrica) => (
                <div key={metrica.rotulo}>
                  <dt>{metrica.rotulo}</dt>
                  <dd>
                    {metrica.score ? (
                      <span className={styles.heroScore} data-tom={tomDoScore(scoreNumero)}>
                        {ou(metrica.valor)}
                      </span>
                    ) : (
                      ou(metrica.valor)
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <dl className={styles.faixaIdentificacao}>
              {metricasIdentificacao.map((metrica) => (
                <div key={metrica.rotulo}>
                  <dt>{metrica.rotulo}</dt>
                  <dd title={metrica.valor ? String(metrica.valor) : undefined}>{ou(metrica.valor)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {ficha.zerada ? (
          <p className="alert danger">
            <Icon name="alert" size={18} />
            <span className="alert-body">
              <strong>Avaliação zerada</strong>
              <span>
                Uma não conformidade grave zerou a nota desta monitoria. O feedback é obrigatório
                antes do prazo.
              </span>
            </span>
          </p>
        ) : null}

        <div className={styles.corpo}>
          <div className={styles.principal}>
            <section className="card pad">
              <AudioPlayer
                src={audioUrl}
                titulo="Gravação avaliada"
                descricao={`Cód. ${ou(ficha.codGravacao)} · ${ou(ficha.duracao)}`}
                duracaoLabel={ficha.duracaoAudio || ficha.duracao}
                emptyTitle="Áudio não disponível"
                emptyHint={
                  ficha.audioPath
                    ? "A avaliação aponta para um arquivo que não está mais no armazenamento."
                    : "Esta avaliação não tem gravação vinculada."
                }
              />
            </section>

            <section className={`card pad ${styles.pessoasCartao}`}>
              <h2 className={styles.tituloSecao}>Pessoas e cabeçalho</h2>
              <div className={styles.pessoas}>
                {pessoas.map((bloco) => (
                  <div className={styles.pessoa} key={bloco.titulo}>
                    <h3>{bloco.titulo}</h3>
                    <p>
                      <span className={styles.rotuloInline}>{bloco.papel}:</span>{" "}
                      {ou(bloco.pessoa?.nome)}
                    </p>
                    <p>
                      <span className={styles.rotuloInline}>E-mail:</span>{" "}
                      {bloco.pessoa?.email ? (
                        <a className={styles.email} href={`mailto:${bloco.pessoa.email}`}>
                          {bloco.pessoa.email}
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </p>
                  </div>
                ))}

                <div className={styles.pessoa}>
                  <h3>Cabeçalho da Ficha</h3>
                  <p>
                    <span className={styles.rotuloInline}>CPF:</span> {ou(ficha.cpfCliente)}
                  </p>
                  <p>
                    <span className={styles.rotuloInline}>Cliente:</span> {ou(ficha.cliente)}
                  </p>
                </div>
              </div>
            </section>

            <ResumoConformidade resumo={ficha.resumo} pesos={ficha.pesos} />

            {ia?.observacoes || ia?.resumo ? (
              <section className="card pad">
                <div className="section-head">
                  <div>
                    <h2>Observações da IA</h2>
                    <p>
                      {ou(ia.persona)}
                      {ia.modelo ? ` · ${ia.modelo}` : ""}
                      {percentual(ia.confianca) ? ` · confiança ${percentual(ia.confianca)}` : ""}
                    </p>
                  </div>
                  <span className="icon-badge" aria-hidden="true">
                    <Icon name="robot" size={18} />
                  </span>
                </div>
                {ia.resumo ? <p className={styles.textoCorrido}>{ia.resumo}</p> : null}
                {ia.observacoes ? <p className={styles.textoCorrido}>{ia.observacoes}</p> : null}
              </section>
            ) : null}

            {ia?.transcricao ? <TranscricaoFalantes texto={ia.transcricao} /> : null}

            <section className="card pad" id="respostas-e-avaliacoes">
              <div className="section-head">
                <div>
                  <h2>Respostas e Avaliações</h2>
                  <p>
                    {ou(ficha.resumo?.total)} critérios em {secoes.length}{" "}
                    {secoes.length === 1 ? "seção" : "seções"}
                    {totalNaoConformes > 0 ? ` · ${totalNaoConformes} não conformes` : ""}
                  </p>
                </div>
                {secoes.length > 0 ? (
                  <button
                    className="btn"
                    type="button"
                    aria-pressed={soNaoConformes}
                    onClick={() => setSoNaoConformes((atual) => !atual)}
                  >
                    <Icon name="filter" size={16} />
                    {soNaoConformes ? "Mostrar todos" : "Só não conformes"}
                  </button>
                ) : null}
              </div>

              {secoes.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge">
                    <Icon name="checklist" size={20} />
                  </span>
                  <h3>Nenhuma resposta registrada</h3>
                  <p>A avaliação existe, mas ainda não tem critérios respondidos vinculados.</p>
                </div>
              ) : criteriosVisiveis.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge success">
                    <Icon name="checkCircle" size={20} />
                  </span>
                  <h3>Nenhum critério não conforme</h3>
                  <p>Todos os critérios avaliados estão conformes ou não aplicáveis.</p>
                  <div className="btn-row">
                    <button className="btn" type="button" onClick={() => setSoNaoConformes(false)}>
                      Mostrar todos os critérios
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secoes}>
                  {criteriosVisiveis.map((secao) => (
                    <section className={styles.secao} id={secao.ancora} key={secao.ancora}>
                      <div className={styles.secaoCabecalho}>
                        <h3>{secao.nome}</h3>
                        {secao.descricao ? <p>{secao.descricao}</p> : null}
                      </div>
                      <div className={styles.criterios}>
                        {secao.criterios.map((criterio) => (
                          <CriterioCard criterio={criterio} key={criterio.id} nivelTitulo={4} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <FeedbackGlobal codigo={ficha.id} onAtualizada={setFichaSalva} />
          </div>

          <aside className={styles.trilha}>
            {/* A navegação lista as mesmas seções que estão renderizadas: com o
                filtro ligado, âncora para seção oculta não levaria a lugar algum. */}
            {criteriosVisiveis.length > 0 ? (
              <nav className={`card pad ${styles.navSecoes}`} aria-label="Seções da ficha">
                <h2 className={styles.tituloSecao}>Seções</h2>
                <ul>
                  {criteriosVisiveis.map((secao) => (
                    <li key={`nav-${secao.ancora}`}>
                      <a href={`#${secao.ancora}`}>
                        <span>{secao.nome}</span>
                        {secao.naoConformes > 0 ? (
                          <span className="count-badge danger">
                            {secao.naoConformes}
                            <span className="sr-only"> não conformes</span>
                          </span>
                        ) : (
                          <span className="count-badge">
                            {secao.criterios.length}
                            <span className="sr-only"> critérios, todos conformes</span>
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            {ia && (ia.insights?.length || ia.riscos?.length || ia.proximosPassos?.length) ? (
              <ListasIa ia={ia} />
            ) : null}

            <ChatIa escopo="avaliacao" referencia={String(ficha.id)} />
          </aside>
        </div>

        <footer className={styles.rodape}>
          <Link className="btn" href={retorno.href}>
            <Icon name="chevronLeft" size={16} />
            {retorno.rotulo}
          </Link>
        </footer>
      </div>

      {painel ? (
        <ModalPainel
          titulo={painel === "historico" ? "Histórico" : painel === "edicoes" ? "Edições" : "Feedbacks"}
          onFechar={fecharPainel}
        >
          <ConteudoPainel ficha={ficha} tipo={painel} />
        </ModalPainel>
      ) : null}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function ListasIa({ ia }) {
  const grupos = [
    { titulo: "Insights", itens: ia.insights, icone: "sparkles" },
    { titulo: "Riscos", itens: ia.riscos, icone: "alert" },
    { titulo: "Próximos passos", itens: ia.proximosPassos, icone: "workflow" },
  ].filter((grupo) => Array.isArray(grupo.itens) && grupo.itens.length > 0);

  if (grupos.length === 0) return null;

  return (
    <section className={`card pad ${styles.listasIa}`}>
      <h2 className={styles.tituloSecao}>Leitura da IA</h2>
      {grupos.map((grupo) => (
        <div key={grupo.titulo}>
          <h3>
            <Icon name={grupo.icone} size={15} />
            {grupo.titulo}
          </h3>
          <ul>
            {grupo.itens.map((item, indice) => (
              <li key={`${grupo.titulo}-${indice}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function FeedbackGlobal({ codigo, onAtualizada }) {
  const [tipo, setTipo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [tocado, setTocado] = useState(false);

  const curta = mensagem.trim().length < MINIMO_MENSAGEM;
  const semTipo = tipo === "";
  const bloqueado = curta || semTipo || enviando !== null;

  async function enviar(acao) {
    setTocado(true);
    if (curta || semTipo) return;

    setEnviando(acao);
    setErro("");
    setSucesso("");

    try {
      const data = await enviarApi(`/api/avaliacoes/${encodeURIComponent(codigo)}/feedback`, {
        tipo,
        mensagem: mensagem.trim(),
        acao,
      });
      if (data?.avaliacao) onAtualizada(data.avaliacao);
      setMensagem("");
      setTipo("");
      setTocado(false);
      setSucesso(
        acao === "aplicar"
          ? "Feedback aplicado. A avaliação foi marcada como concluída."
          : "Justificativa registrada. A avaliação foi marcada como justificada.",
      );
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível registrar o feedback.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <section className={`card pad ${styles.feedback}`} id="feedback-global">
      <div className="section-head">
        <div>
          <h2>Feedback Global sobre a Avaliação</h2>
          <p>O texto fica no histórico da monitoria e é o que o operador vai ler.</p>
        </div>
        <span className="icon-badge" aria-hidden="true">
          <Icon name="feedback" size={18} />
        </span>
      </div>

      <div className={styles.feedbackCampos}>
        <div className="field">
          <label htmlFor="feedback-tipo">Tipo de Feedback *</label>
          <select
            className="select"
            id="feedback-tipo"
            value={tipo}
            aria-invalid={tocado && semTipo ? "true" : undefined}
            aria-describedby={tocado && semTipo ? "feedback-tipo-erro" : undefined}
            onChange={(evento) => setTipo(evento.target.value)}
          >
            <option value="">Selecione o tipo</option>
            {TIPOS_FEEDBACK.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
          {tocado && semTipo ? (
            <p className="field-error" id="feedback-tipo-erro">
              <Icon name="alert" size={15} />
              Escolha se o feedback é elogio, orientação ou alerta.
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="feedback-mensagem">
            Comentários Detalhados * (mín. {MINIMO_MENSAGEM} caracteres)
          </label>
          <textarea
            className="textarea"
            id="feedback-mensagem"
            rows={5}
            value={mensagem}
            placeholder="Descreva seu feedback sobre a avaliação como um todo…"
            aria-invalid={tocado && curta ? "true" : undefined}
            aria-describedby="feedback-contador"
            onChange={(evento) => setMensagem(evento.target.value)}
          />
          <p className="field-hint" id="feedback-contador">
            {mensagem.trim().length} / {MINIMO_MENSAGEM} caracteres
            {curta ? " — ainda faltam caracteres para liberar o envio." : " — pronto para enviar."}
          </p>
        </div>
      </div>

      {erro ? (
        <p className="alert danger" role="alert">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>O feedback não foi registrado</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {sucesso ? (
        <p className="alert success" role="status">
          <Icon name="checkCircle" size={18} />
          <span className="alert-body">
            <strong>Feedback registrado</strong>
            <span>{sucesso}</span>
          </span>
        </p>
      ) : null}

      <div className="btn-row">
        <button className="btn" type="button" disabled={bloqueado} onClick={() => enviar("justificar")}>
          <Icon name={enviando === "justificar" ? "spinner" : "undo"} size={16} className={enviando === "justificar" ? "spinning" : undefined} />
          Justificar Não Aplicar
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={bloqueado}
          onClick={() => enviar("aplicar")}
        >
          <Icon name={enviando === "aplicar" ? "spinner" : "check"} size={16} className={enviando === "aplicar" ? "spinning" : undefined} />
          Aplicar Feedback
        </button>
      </div>
    </section>
  );
}

function ConteudoPainel({ ficha, tipo }) {
  if (tipo === "feedback") {
    const feedbacks = Array.isArray(ficha.feedbacks) ? ficha.feedbacks : [];
    if (feedbacks.length === 0) {
      return <p className={styles.painelVazio}>Nenhum feedback registrado para esta avaliação.</p>;
    }
    return (
      <ul className={styles.painelLista}>
        {feedbacks.map((feedback, indice) => (
          <li key={`feedback-${indice}`}>
            <strong>{ou(feedback.status)}</strong>
            <p>{feedback.mensagem || "Sem mensagem registrada."}</p>
            <span>
              {ou(feedback.autor)} · {ou(feedback.criadoEm)}
              {feedback.aplicadoEm ? ` · aplicado em ${feedback.aplicadoEm}` : ""}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const historico = (Array.isArray(ficha.historico) ? ficha.historico : []).filter((item) =>
    tipo === "edicoes" ? /edi/.test(normalizar(item.acao)) : true,
  );

  if (historico.length === 0) {
    return (
      <p className={styles.painelVazio}>
        {tipo === "edicoes"
          ? "Nenhuma edição registrada depois da submissão desta monitoria."
          : "Nenhum registro no histórico desta avaliação."}
      </p>
    );
  }

  return (
    <ul className={styles.painelLista}>
      {historico.map((item, indice) => (
        <li key={`hist-${indice}`}>
          <strong>{ou(item.acao)}</strong>
          <p>{item.detalhe || "Sem detalhe registrado."}</p>
          <span>
            {ou(item.usuario)} · {ou(item.criadoEm)}
            {item.ip ? ` · ${item.ip}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ModalPainel({ titulo, onFechar, children }) {
  const dialogoRef = useRef(null);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    dialogo?.focus();

    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        onFechar();
        return;
      }

      // Tab preso no diálogo: sem isso o foco escapa para a página atrás, que
      // continua no DOM e é inalcançável visualmente.
      if (evento.key !== "Tab" || !dialogo) return;
      const focaveis = dialogo.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [onFechar]);

  return (
    <div
      className={styles.modalFundo}
      role="presentation"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <section
        className={`card ${styles.modal}`}
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
      >
        <header className={styles.modalCabecalho}>
          <h2 id="modal-titulo">{titulo}</h2>
          <button className="btn ghost icon-only" type="button" onClick={onFechar}>
            <Icon name="close" size={18} label={`Fechar ${titulo}`} />
          </button>
        </header>
        <div className={styles.modalCorpo}>{children}</div>
      </section>
    </div>
  );
}

function EsqueletoFicha() {
  return (
    <div className={styles.esqueleto} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando a ficha de monitoria.</span>
      <div className={`skeleton ${styles.esqueletoHero}`} />
      <div className={styles.esqueletoCorpo}>
        <div className={styles.esqueletoColuna}>
          <div className={`skeleton ${styles.esqueletoBloco}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
        </div>
        <div className={styles.esqueletoColuna}>
          <div className={`skeleton ${styles.esqueletoBloco}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
        </div>
      </div>
    </div>
  );
}
