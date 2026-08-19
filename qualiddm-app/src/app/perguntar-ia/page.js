"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import GraficoLinha from "@/components/GraficoLinha";
import { Icon } from "@/components/icons";
import { enviarApi } from "@/lib/api";
import styles from "./page.module.css";

/**
 * Copiloto da qualidade — conversa sobre a OPERAÇÃO, não sobre uma ficha.
 *
 * Diferença em relação ao chat que existe dentro de cada avaliação: ali o
 * contexto é um atendimento; aqui é o período inteiro. A resposta não é só
 * texto: vem com métricas do período, as avaliações que a sustentam e os
 * próximos passos. Texto sozinho obriga o gestor a sair da tela para conferir o
 * número e para achar a monitoria citada.
 *
 * De onde vem cada parte: o texto é do modelo; NÚMERO E LINK SÃO DO SERVIDOR.
 * O modelo escolhe qual métrica destacar por chave e quais códigos citar, e
 * `services/copiloto-ia.js` resolve valor e href a partir do mesmo agregado que
 * alimenta o dashboard. Chave ou código que não existe é descartado — nunca
 * chega à tela como número inventado.
 */

const PERIODOS = [
  { value: "monthly", label: "Últimos 31 dias" },
  { value: "weekly", label: "Últimos 7 dias" },
];

const SUGESTOES = [
  "Por que a nota caiu?",
  "Principais ofensores",
  "Qual carteira precisa de atenção?",
  "O que devo priorizar hoje?",
];

const CHAVE_HISTORICO = "qualiddm:copiloto:conversas";
const MAX_CONVERSAS = 12;

const ABERTURA = {
  autor: "ia",
  abertura: true,
  resposta:
    "Eu leio as monitorias do período selecionado — nota, tendência, critérios ofensores, carteiras e a fila de prioridades. Se os dados não sustentarem a resposta, eu digo o que falta.",
};

let sequencia = 0;
function proximoId() {
  sequencia += 1;
  return `msg-${sequencia}`;
}

function lerConversas() {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_HISTORICO);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export default function PerguntarIaPage() {
  const [mensagens, setMensagens] = useState([{ ...ABERTURA, id: proximoId() }]);
  const [pergunta, setPergunta] = useState("");
  const [periodo, setPeriodo] = useState("monthly");
  const [clienteId, setClienteId] = useState("todos");
  const [clientes, setClientes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState("");
  const [conversas, setConversas] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [graficoAberto, setGraficoAberto] = useState({});

  const campoRef = useRef(null);
  const fimRef = useRef(null);
  const conversaAtualRef = useRef(null);

  const conversando = mensagens.length > 1;

  // Histórico só existe no navegador: ler no primeiro efeito, e não no estado
  // inicial, evita o servidor renderizar uma lista que o cliente não tem (e o
  // contrário). `queueMicrotask` é a mesma saída usada em `useRecurso` para não
  // chamar setState no corpo do efeito.
  useEffect(() => {
    queueMicrotask(() => setConversas(lerConversas()));
  }, []);

  // Opções de carteira: mesma rota que o dashboard usa. Falha silenciosa —
  // sem a lista o copiloto continua respondendo sobre todas as carteiras.
  useEffect(() => {
    let ativo = true;
    fetch("/api/relatorios/opcoes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (payload?.ok && ativo) setClientes(payload.data?.clientes ?? []);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  /**
   * Guarda a conversa no navegador.
   *
   * localStorage e não banco: é histórico de consulta de UMA pessoa, não
   * registro de monitoria. Fica explícito na tela que é local — quem trocar de
   * máquina não encontra a conversa lá.
   */
  const guardar = useCallback((lista) => {
    if (typeof window === "undefined") return;
    const primeira = lista.find((mensagem) => mensagem.autor === "usuario");
    if (!primeira) return;

    const registro = {
      id: conversaAtualRef.current ?? `conversa-${new Date().toISOString()}`,
      titulo: primeira.texto.slice(0, 90),
      criadoEm: new Date().toISOString(),
      periodo,
      mensagens: lista,
    };
    conversaAtualRef.current = registro.id;

    const atualizadas = [registro, ...lerConversas().filter((item) => item.id !== registro.id)].slice(
      0,
      MAX_CONVERSAS,
    );
    try {
      window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(atualizadas));
      setConversas(atualizadas);
    } catch {
      // Cota cheia ou modo privado: perder o histórico local não pode derrubar
      // a conversa em andamento.
    }
  }, [periodo]);

  async function perguntar(texto) {
    const limpa = String(texto || "").trim();
    if (!limpa || enviando) return;

    const daPessoa = { id: proximoId(), autor: "usuario", texto: limpa };
    const comPergunta = [...mensagens, daPessoa];
    setMensagens(comPergunta);
    setPergunta("");
    setUltimaPergunta(limpa);
    setEnviando(true);
    setErro("");

    try {
      const resposta = await enviarApi("/api/ia/copiloto", {
        pergunta: limpa,
        periodo,
        clienteId: clienteId === "todos" ? null : clienteId,
        // Só o histórico de texto vai: contexto quem monta é o servidor.
        historico: comPergunta
          .filter((mensagem) => !mensagem.abertura)
          .map((mensagem) => ({
            autor: mensagem.autor,
            texto: mensagem.autor === "usuario" ? mensagem.texto : mensagem.resposta,
          })),
      });

      const daIa = { id: proximoId(), autor: "ia", ...resposta };
      const completa = [...comPergunta, daIa];
      setMensagens(completa);
      guardar(completa);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível responder agora.");
    } finally {
      setEnviando(false);
      // Devolve o foco ao campo: quem está investigando faz várias perguntas
      // seguidas.
      campoRef.current?.focus();
    }
  }

  useEffect(() => {
    if (conversando) fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens, conversando]);

  function abrirConversa(conversa) {
    conversaAtualRef.current = conversa.id;
    setMensagens([{ ...ABERTURA, id: proximoId() }, ...(conversa.mensagens || [])]);
    setHistoricoAberto(false);
    setErro("");
  }

  function novaConversa() {
    conversaAtualRef.current = null;
    setMensagens([{ ...ABERTURA, id: proximoId() }]);
    setPergunta("");
    setErro("");
    setHistoricoAberto(false);
    campoRef.current?.focus();
  }

  const formulario = (
    <form
      className={styles.campo}
      onSubmit={(evento) => {
        evento.preventDefault();
        perguntar(pergunta);
      }}
    >
      <label className="sr-only" htmlFor="pergunta-copiloto">
        Pergunte algo sobre suas avaliações
      </label>
      <input
        className="input"
        id="pergunta-copiloto"
        ref={campoRef}
        type="text"
        autoComplete="off"
        maxLength={600}
        placeholder="Pergunte algo sobre suas avaliações..."
        value={pergunta}
        onChange={(evento) => setPergunta(evento.target.value)}
        disabled={enviando}
      />
      <button className="btn primary icon-only" type="submit" disabled={enviando || !pergunta.trim()}>
        <Icon className={enviando ? "spinning" : undefined} name={enviando ? "spinner" : "send"} size={18} />
        <span className="sr-only">{enviando ? "Enviando pergunta" : "Enviar pergunta"}</span>
      </button>
    </form>
  );

  const contexto = (
    <div className={styles.contexto}>
      <span className="label-micro">Contexto</span>
      <div className={styles.contextoCampos}>
        <div className="field">
          <label className="sr-only" htmlFor="copiloto-periodo">
            Período
          </label>
          <select
            className="select"
            id="copiloto-periodo"
            value={periodo}
            onChange={(evento) => setPeriodo(evento.target.value)}
          >
            {PERIODOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="sr-only" htmlFor="copiloto-carteira">
            Carteira
          </label>
          <select
            className="select"
            id="copiloto-carteira"
            value={clienteId}
            onChange={(evento) => setClienteId(evento.target.value)}
          >
            <option value="todos">Todas as carteiras</option>
            {clientes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell active="Perguntar à IA" breadcrumb="IA > Perguntar à IA">
      <div className={styles.pagina} data-conversando={conversando ? "true" : undefined}>
        <section className={styles.cabecalho}>
          <div>
            <h1>Perguntar à IA</h1>
            <p>Analise avaliações, encontre padrões e investigue problemas.</p>
          </div>

          <div className={styles.cabecalhoAcoes}>
            {conversando ? (
              <button className="btn" type="button" onClick={novaConversa}>
                <Icon name="plus" size={16} />
                Nova conversa
              </button>
            ) : null}
            <button
              className="btn"
              type="button"
              aria-expanded={historicoAberto}
              aria-controls="historico-copiloto"
              onClick={() => setHistoricoAberto((aberto) => !aberto)}
            >
              <Icon name="history" size={16} />
              Histórico
              {conversas.length > 0 ? <span className="count-badge">{conversas.length}</span> : null}
            </button>
          </div>
        </section>

        {historicoAberto ? (
          <section className={`card pad ${styles.historico}`} id="historico-copiloto">
            <div className="section-head">
              <div>
                <h2>Conversas recentes</h2>
                <p>Guardadas neste navegador — não sincronizam entre máquinas.</p>
              </div>
            </div>

            {conversas.length === 0 ? (
              <p className="subtle-text">Nenhuma conversa guardada ainda.</p>
            ) : (
              <ul className="list">
                {conversas.map((conversa) => (
                  <li className={`row ${styles.linhaHistorico}`} key={conversa.id}>
                    <button type="button" onClick={() => abrirConversa(conversa)}>
                      <span className="row-title">{conversa.titulo}</span>
                      <span className="row-meta">
                        {new Date(conversa.criadoEm).toLocaleString("pt-BR")} ·{" "}
                        {conversa.periodo === "weekly" ? "7 dias" : "31 dias"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* Antes da primeira pergunta, campo e sugestões ficam no alto: a tela
            abre pronta para uso, sem espaço morto. */}
        {!conversando ? (
          <section className={`card pad ${styles.entrada}`}>
            {formulario}
            {contexto}

            <div className={styles.sugestoes}>
              <span className="label-micro">Sugestões</span>
              <div className="jump-chips">
                {SUGESTOES.map((sugestao) => (
                  <button
                    className="jump-chip"
                    key={sugestao}
                    type="button"
                    disabled={enviando}
                    onClick={() => perguntar(sugestao)}
                  >
                    <span>{sugestao}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <ol className={styles.conversa}>
          {mensagens.map((mensagem) =>
            mensagem.autor === "usuario" ? (
              <li className={styles.mensagem} data-autor="usuario" key={mensagem.id}>
                <span className={styles.autor}>
                  <Icon name="user" size={14} />
                  Você
                </span>
                <p className={styles.textoMensagem}>{mensagem.texto}</p>
              </li>
            ) : (
              <li className={styles.mensagem} data-autor="ia" key={mensagem.id}>
                <span className={styles.autor}>
                  <Icon name="sparkles" size={14} />
                  IA
                  {mensagem.recorte ? <span className={styles.recorte}>{mensagem.recorte}</span> : null}
                </span>

                <p className={styles.textoMensagem}>{mensagem.resposta}</p>

                {mensagem.metricas?.length > 0 ? (
                  <ul className={styles.metricas}>
                    {mensagem.metricas.map((metrica) => (
                      <li key={`${mensagem.id}-${metrica.chave}`} data-direcao={metrica.direcao || undefined}>
                        <span className={styles.metricaValor}>
                          {metrica.direcao ? (
                            <Icon name={metrica.delta > 0 ? "trendUp" : "trendDown"} size={13} />
                          ) : null}
                          {metrica.valor}
                        </span>
                        <span className={styles.metricaRotulo}>{metrica.rotulo}</span>
                        {metrica.detalhe ? (
                          <span className={styles.metricaDetalhe}>{metrica.detalhe}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {mensagem.avaliacoes?.length > 0 ? (
                  <div className={styles.relacionadas}>
                    <span className="label-micro">Principais avaliações relacionadas</span>
                    <ul>
                      {mensagem.avaliacoes.map((avaliacao) => (
                        <li key={`${mensagem.id}-${avaliacao.codigo}`}>
                          <span className={styles.relacionadaId}>
                            {avaliacao.critica ? (
                              <Icon name="alert" size={13} />
                            ) : null}
                            {avaliacao.codigo}
                          </span>
                          <span className={styles.relacionadaMeta}>
                            nota {Number(avaliacao.score ?? 0).toFixed(1).replace(".", ",")} ·{" "}
                            {avaliacao.naoConformes} falha(s)
                          </span>
                          <Link className="btn" href={avaliacao.href}>
                            Abrir
                            <Icon name="chevronRight" size={14} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {graficoAberto[mensagem.id] && mensagem.serie?.length > 0 ? (
                  <div className={styles.grafico}>
                    <GraficoLinha
                      pontos={mensagem.serie.map((ponto) => ({
                        rotulo: String(ponto.day).slice(8, 10) + "/" + String(ponto.day).slice(5, 7),
                        valor: ponto.score,
                        volume: ponto.reviews,
                      }))}
                      titulo="Nota média por dia no recorte"
                    />
                  </div>
                ) : null}

                {mensagem.acoes?.length > 0 ? (
                  <div className={styles.acoes}>
                    {mensagem.acoes.map((acao) => {
                      if (acao.tipo === "link") {
                        return (
                          <Link className="btn" href={acao.href} key={`${mensagem.id}-${acao.chave}`}>
                            {acao.rotulo}
                            <Icon name="chevronRight" size={14} />
                          </Link>
                        );
                      }

                      if (acao.tipo === "grafico") {
                        const aberto = Boolean(graficoAberto[mensagem.id]);
                        return (
                          <button
                            className="btn"
                            key={`${mensagem.id}-${acao.chave}`}
                            type="button"
                            aria-pressed={aberto}
                            disabled={!mensagem.serie?.length}
                            onClick={() =>
                              setGraficoAberto((atual) => ({ ...atual, [mensagem.id]: !atual[mensagem.id] }))
                            }
                          >
                            <Icon name="metrics" size={16} />
                            {aberto ? "Ocultar gráfico" : acao.rotulo}
                          </button>
                        );
                      }

                      return (
                        <button
                          className="btn"
                          key={`${mensagem.id}-${acao.chave}`}
                          type="button"
                          disabled={enviando}
                          onClick={() => perguntar(acao.pergunta)}
                        >
                          <Icon name="sparkles" size={16} />
                          {acao.rotulo}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {mensagem.sugestoes?.length > 0 ? (
                  <div className="jump-chips">
                    {mensagem.sugestoes.map((sugestao) => (
                      <button
                        className="jump-chip"
                        key={`${mensagem.id}-${sugestao}`}
                        type="button"
                        disabled={enviando}
                        onClick={() => perguntar(sugestao)}
                      >
                        <span>{sugestao}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ),
          )}

          {enviando ? (
            <li className={styles.mensagem} data-autor="ia">
              <span className={styles.autor}>
                <Icon name="sparkles" size={14} />
                IA
              </span>
              <p className={styles.digitando} aria-live="polite">
                Lendo as monitorias do período...
                <span className="sr-only">A IA está preparando a resposta.</span>
              </p>
            </li>
          ) : null}
        </ol>

        {erro ? (
          <p className="alert danger" role="alert">
            <Icon name="error" size={18} />
            <span className="alert-body">
              <strong>A pergunta não foi respondida</strong>
              <span>{erro}</span>
            </span>
            {/* A pergunta não é apagada: repetir não obriga a digitar de novo. */}
            <button className="btn" type="button" onClick={() => perguntar(ultimaPergunta)}>
              <Icon name="refresh" size={16} />
              Tentar de novo
            </button>
          </p>
        ) : null}

        <div ref={fimRef} />

        {/* Depois da primeira pergunta o campo desce e gruda no rodapé: é onde a
            mão fica numa conversa. */}
        {conversando ? (
          <section className={styles.rodapeEntrada}>
            {formulario}
            {contexto}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
