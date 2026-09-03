"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { buscarApi, enviarApi } from "@/lib/api";
import { Icon } from "./icons";
import styles from "./ChatIa.module.css";

/**
 * Chat de IA sobre a monitoria (seção 5 do contrato).
 *
 * O front manda só `pergunta` + `historico`: ficha, critérios e transcrição são
 * montados no servidor. Isso evita mandar a ficha inteira pelo navegador e
 * garante que o contexto seja o dado real, não o que a tela por acaso carregou.
 *
 * Duas regras de honestidade que valem mais que a estética aqui:
 * - resposta sem `evidencias` recebe um aviso de que a IA não citou trecho da
 *   transcrição, para ninguém tratar palpite como prova em feedback;
 * - falha de rede não apaga a pergunta: ela fica na tela com botão de repetir.
 */

const SUGESTOES_PADRAO = [
  "O que devo falar no feedback deste operador?",
  "Quais foram os pontos fortes do atendimento?",
  "Por que os critérios não conformes foram reprovados?",
  "Qual o risco de contestação desta ficha?",
];

const ABERTURA = {
  autor: "ia",
  local: true,
  texto:
    "Respondo apenas com base nesta ficha e na transcrição desta gravação. Se não houver base, eu digo que não sei.",
};

let sequencia = 0;
function proximoId() {
  sequencia += 1;
  return `msg-${sequencia}`;
}

export default function ChatIa({
  escopo,
  referencia,
  titulo = "Perguntar ao Acordito",
  descricao = "Sobre o operador, os critérios e o feedback desta monitoria.",
}) {
  const idBase = useId();
  const logRef = useRef(null);
  const campoRef = useRef(null);
  const pertoDoFimRef = useRef(true);
  const abortRef = useRef(null);

  const [mensagens, setMensagens] = useState([{ ...ABERTURA, id: proximoId() }]);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState("");
  const [sugestoes, setSugestoes] = useState(SUGESTOES_PADRAO);

  // Trocar de monitoria sem desmontar o painel (navegar de uma ficha para outra)
  // não pode arrastar a conversa anterior: o contexto do servidor é outro.
  const [referenciaAnterior, setReferenciaAnterior] = useState(referencia);
  if (referencia !== referenciaAnterior) {
    setReferenciaAnterior(referencia);
    setMensagens([{ ...ABERTURA, id: proximoId() }]);
    setErro("");
    setUltimaPergunta("");
    setSugestoes(SUGESTOES_PADRAO);
  }

  // Rota opcional no contrato: se não existir, a lista fixa continua servindo —
  // por isso a falha é engolida sem alarmar o usuário.
  useEffect(() => {
    if (!referencia) return undefined;
    let ativo = true;

    buscarApi(
      `/api/ia/chat/sugestoes?escopo=${encodeURIComponent(escopo)}&referencia=${encodeURIComponent(referencia)}`,
    )
      .then((data) => {
        const lista = Array.isArray(data?.sugestoes)
          ? data.sugestoes.filter((item) => typeof item === "string" && item.trim())
          : [];
        if (ativo && lista.length > 0) setSugestoes(lista.slice(0, 5));
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [escopo, referencia]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Só cola no rodapé quem já estava lá: se o usuário subiu para reler uma
  // evidência, uma resposta nova não pode arrastar a leitura dele.
  useEffect(() => {
    if (!pertoDoFimRef.current) return;
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [mensagens, enviando]);

  const enviar = useCallback(
    async (texto) => {
      const limpo = String(texto || "").trim();
      if (!limpo || enviando || !referencia) return;

      // O histórico enviado ignora a abertura local e mensagens com falha:
      // elas não fizeram parte da conversa que o modelo viu.
      const historico = mensagens
        .filter((item) => !item.local)
        .slice(-10)
        .map((item) => ({ autor: item.autor, texto: item.texto }));

      pertoDoFimRef.current = true;
      setErro("");
      setUltimaPergunta(limpo);
      setEnviando(true);
      setMensagens((atuais) => [...atuais, { id: proximoId(), autor: "usuario", texto: limpo }]);
      // Limpa o campo só quando o que saiu era o rascunho: clicar numa sugestão
      // não pode apagar a pergunta que o usuário estava escrevendo.
      setPergunta((atual) => (atual.trim() === limpo ? "" : atual));

      abortRef.current?.abort();
      const controlador = new AbortController();
      abortRef.current = controlador;

      try {
        const data = await enviarApi(
          "/api/ia/chat",
          { escopo, referencia, pergunta: limpo, historico },
          { signal: controlador.signal },
        );

        const resposta = String(data?.resposta ?? "").trim();
        const evidencias = Array.isArray(data?.evidencias) ? data.evidencias : [];
        const proximas = Array.isArray(data?.sugestoes)
          ? data.sugestoes.filter((item) => typeof item === "string" && item.trim())
          : [];

        setMensagens((atuais) => [
          ...atuais,
          {
            id: proximoId(),
            autor: "ia",
            texto: resposta,
            vazia: resposta.length === 0,
            evidencias,
            proximas: proximas.slice(0, 4),
          },
        ]);
      } catch (causa) {
        if (causa?.name === "AbortError") return;
        setErro(causa instanceof Error ? causa.message : "Não foi possível falar com a IA.");
      } finally {
        setEnviando(false);
      }
    },
    [enviando, escopo, mensagens, referencia],
  );

  function aoSubmeter(evento) {
    evento.preventDefault();
    enviar(pergunta);
  }

  // Enter envia, Shift+Enter quebra linha — a convenção de qualquer chat.
  function aoTeclar(evento) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviar(pergunta);
    }
  }

  function perguntarSugerida(texto) {
    enviar(texto);
    // O foco volta ao campo: quem clicou numa sugestão costuma querer ajustar
    // a próxima pergunta, e sem isso o foco fica num botão que já saiu da tela.
    campoRef.current?.focus();
  }

  if (!referencia) {
    return (
      <section className={`card pad ${styles.painel}`}>
        <ChatCabecalho titulo={titulo} descricao={descricao} />
        <div className="empty-state">
          <span className="icon-badge">
            <Icon name="robot" size={20} />
          </span>
          <h3>Chat indisponível</h3>
          <p>Sem identificação da monitoria não é possível montar o contexto da IA.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`card pad ${styles.painel}`}>
      <ChatCabecalho titulo={titulo} descricao={descricao} />

      <ol
        className={styles.log}
        ref={logRef}
        aria-live="polite"
        aria-busy={enviando}
        aria-label="Conversa com a IA"
        tabIndex={0}
        onScroll={(evento) => {
          const alvo = evento.currentTarget;
          pertoDoFimRef.current =
            alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 48;
        }}
      >
        {mensagens.map((mensagem) => (
          <li
            className={styles.mensagem}
            data-autor={mensagem.autor}
            data-abertura={mensagem.local ? "true" : undefined}
            key={mensagem.id}
          >
            <span className={styles.autor}>
              <Icon name={mensagem.autor === "usuario" ? "user" : "robot"} size={13} />
              {mensagem.autor === "usuario" ? "Você" : "IA"}
            </span>

            {mensagem.vazia ? (
              <p className={styles.texto}>
                A IA não devolveu texto para esta pergunta. Tente reformulá-la de forma mais
                específica.
              </p>
            ) : (
              <p className={styles.texto}>{mensagem.texto}</p>
            )}

            {mensagem.evidencias?.length > 0 ? (
              <div className={styles.evidencias}>
                <p className={styles.evidenciasTitulo}>
                  <Icon name="quote" size={13} />
                  Trechos citados
                </p>
                {mensagem.evidencias.map((evidencia, indice) => (
                  <blockquote className={styles.evidencia} key={`ev-${mensagem.id}-${indice}`}>
                    {evidencia?.trecho || "Trecho não informado."}
                    {evidencia?.criterio ? <cite>{evidencia.criterio}</cite> : null}
                  </blockquote>
                ))}
              </div>
            ) : null}

            {mensagem.autor === "ia" && !mensagem.local && !mensagem.vazia && !mensagem.evidencias?.length ? (
              <p className={styles.semBase}>
                <Icon name="info" size={13} />
                Sem trecho da transcrição citado — confirme no áudio antes de usar no feedback.
              </p>
            ) : null}

            {mensagem.proximas?.length > 0 ? (
              <ul className={styles.sugestoes}>
                {mensagem.proximas.map((sugestao) => (
                  <li key={`prox-${mensagem.id}-${sugestao}`}>
                    <button
                      className={styles.sugestao}
                      type="button"
                      disabled={enviando}
                      onClick={() => perguntarSugerida(sugestao)}
                    >
                      {sugestao}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}

        {enviando ? (
          <li className={styles.mensagem} data-autor="ia">
            <span className={styles.autor}>
              <Icon name="robot" size={13} />
              IA
            </span>
            <p className={styles.digitando}>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span className="sr-only">A IA está escrevendo a resposta.</span>
            </p>
          </li>
        ) : null}
      </ol>

      {erro ? (
        <p className="alert danger" role="alert">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>A IA não respondeu</strong>
            <span>{erro}</span>
          </span>
          <button
            className="btn"
            type="button"
            onClick={() => enviar(ultimaPergunta)}
            disabled={!ultimaPergunta}
          >
            <Icon name="refresh" size={16} />
            Tentar de novo
          </button>
        </p>
      ) : null}

      {mensagens.length <= 1 && sugestoes.length > 0 ? (
        <div className={styles.sugestoesIniciais}>
          <p className="label-micro">Perguntas sugeridas</p>
          <ul className={styles.sugestoes}>
            {sugestoes.map((sugestao) => (
              <li key={sugestao}>
                <button
                  className={styles.sugestao}
                  type="button"
                  disabled={enviando}
                  onClick={() => perguntarSugerida(sugestao)}
                >
                  {sugestao}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className={styles.formulario} onSubmit={aoSubmeter}>
        <div className="field">
          <label htmlFor={`${idBase}-pergunta`}>Sua pergunta</label>
          <textarea
            className={`textarea ${styles.campo}`}
            id={`${idBase}-pergunta`}
            ref={campoRef}
            rows={2}
            value={pergunta}
            placeholder="Ex.: o que devo reforçar no feedback deste operador?"
            aria-describedby={`${idBase}-dica`}
            onChange={(evento) => setPergunta(evento.target.value)}
            onKeyDown={aoTeclar}
          />
          <p className="field-hint" id={`${idBase}-dica`}>
            Enter envia. Shift + Enter pula linha.
          </p>
        </div>

        <button className="btn primary" type="submit" disabled={enviando || !pergunta.trim()}>
          <Icon name={enviando ? "spinner" : "send"} size={16} className={enviando ? "spinning" : undefined} />
          {enviando ? "Perguntando…" : "Perguntar"}
        </button>
      </form>
    </section>
  );
}

function ChatCabecalho({ titulo, descricao }) {
  return (
    <div className="section-head">
      <div>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>
      <span className="icon-badge" aria-hidden="true">
        <Icon name="sparkles" size={18} />
      </span>
    </div>
  );
}
