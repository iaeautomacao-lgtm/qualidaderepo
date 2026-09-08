"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { cabeNaAnaliseIa, formatarMegabytes, MAX_BYTES_ANALISE_IA } from "@/lib/limites-arquivo";
import styles from "./page.module.css";

// `video/mpeg` e `video/mp4` entram na lista porque e o rotulo que o Windows da
// para `.mpeg` e `.mp4` de audio -- sem eles o seletor de arquivos do sistema
// esconde gravacao de ligacao legitima.
const ACCEPT = ".mp3,.mpeg,.mpg,.mpga,.wav,.m4a,.mp4,.aac,.ogg,.opus,.webm,.flac,.pdf,.txt,.csv,.xls,.xlsx,audio/*,video/mpeg,video/mp4,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ARQUIVOS_POR_LOTE = 20;

async function readApiResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message || `Requisição falhou (HTTP ${response.status})`);
  }
  return payload?.data ?? payload;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * O que a pessoa está enviando.
 *
 * Substitui a pergunta que a tela fazia antes ("qual ficha?"), que só tinha
 * resposta útil quando havia formulário cadastrado para a carteira. Esta tem
 * resposta sempre, e é a informação que faltava: o canal era DEDUZIDO do tipo do
 * arquivo, e um PDF com transcrição de ligação entrava como chat sem ninguém
 * perceber.
 */
const CANAIS = [
  {
    id: "telefone",
    rotulo: "Ligação",
    descricao: "Atendimento por telefone — áudio ou transcrição da chamada.",
    icone: "mic",
  },
  {
    id: "chat",
    rotulo: "Chat",
    descricao: "Atendimento escrito — chat, WhatsApp ou rede social.",
    icone: "feedback",
  },
];

/**
 * Para onde o botão de resultado leva depois de um envio SEM formulário.
 *
 * A análise da IA vive na gravação, e a tela dela é `/avaliacoes/ia/[id]`.
 * `/transcricoes/[id]` mostra só o texto do atendimento — mandar o upload para
 * lá fazia o fluxo terminar num beco, porque aquela tela não leva à avaliação.
 *
 * Três casos, nesta ordem:
 *   1. análise falhou -> a transcrição, que é onde fica o botão de reprocessar;
 *   2. um arquivo -> a avaliação completa dele;
 *   3. vários arquivos -> a fila, porque "a" avaliação seria escolha arbitrária
 *      entre várias. A fila tem coluna de acesso ao resultado.
 */
function destinoDoResultado(gravacoes, busca) {
  const comId = (gravacoes ?? []).filter((gravacao) => gravacao?.id);
  if (comId.length === 0) return null;

  if (comId.length > 1) {
    return {
      href: `/transcricoes${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`,
      rotulo: "Abrir a fila",
    };
  }

  const principal = comId[0];
  if (principal.status === "erro") {
    return { href: `/transcricoes/${principal.id}`, rotulo: "Abrir a transcrição" };
  }

  return { href: `/avaliacoes/ia/${principal.id}`, rotulo: "Abrir a avaliação" };
}

export default function UploadPage() {
  const inputRef = useRef(null);
  const inputId = useId();
  const envioAutomaticoRef = useRef("");
  const [files, setFiles] = useState([]);
  const [opcoes, setOpcoes] = useState({ clientes: [], campanhas: [] });
  const [clienteId, setClienteId] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [canal, setCanal] = useState("");
  const [dragging, setDragging] = useState(false);
  // idle | sending | done | error
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      try {
        const respostaOpcoes = await fetch("/api/relatorios/opcoes", { cache: "no-store" });
        const payloadOpcoes = await respostaOpcoes.json().catch(() => null);

        if (!ativo) return;

        if (respostaOpcoes.ok && payloadOpcoes?.ok) {
          const opcoesApi = {
            clientes: payloadOpcoes.data?.clientes || [],
            campanhas: payloadOpcoes.data?.campanhas || [],
          };
          setOpcoes(opcoesApi);

          const parametros = new URLSearchParams(window.location.search);
          const clientePreSelecionado = parametros.get("clienteId");
          const campanhaPreSelecionada = parametros.get("campanhaId");
          const clienteNome = parametros.get("cliente");
          const campanhaNome = parametros.get("campanha");

          const clienteEncontrado =
            opcoesApi.clientes.find((cliente) => cliente.id === clientePreSelecionado) ||
            opcoesApi.clientes.find((cliente) => cliente.nome === clienteNome);
          const campanhaEncontrada =
            opcoesApi.campanhas.find((campanha) => campanha.id === campanhaPreSelecionada) ||
            opcoesApi.campanhas.find((campanha) => campanha.nome === campanhaNome);

          if (clienteEncontrado) setClienteId(clienteEncontrado.id);
          if (campanhaEncontrada) setCampanhaId(campanhaEncontrada.id);
        } else {
          throw new Error(payloadOpcoes?.error?.message || "Nao foi possivel carregar as opcoes de upload.");
        }
      } catch (cause) {
        if (ativo) {
          setFormError(cause instanceof Error ? cause.message : "Nao foi possivel carregar as opcoes de upload.");
        }
      }
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "sending") return undefined;

    const timer = setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const step = current < 55 ? 7 : current < 80 ? 4 : 2;
        return Math.min(92, current + step);
      });
    }, 700);

    return () => clearInterval(timer);
  }, [status]);

  function addFiles(fileList) {
    const chosen = Array.from(fileList ?? []);
    if (chosen.length === 0) return;

    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}-${f.size}`));
      return [...current, ...chosen.filter((f) => !seen.has(`${f.name}-${f.size}`))];
    });
    setStatus("idle");
    setProgress(0);
    setError("");
    setResult(null);
  }

  function removeFile(target) {
    setFiles((current) => current.filter((f) => f !== target));
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer?.files);
  }

  const campanhasDisponiveis = useMemo(
    () =>
      opcoes.campanhas.filter(
        (campanha) => !clienteId || campanha.clienteId === clienteId,
      ),
    [clienteId, opcoes.campanhas],
  );

  const clienteSelecionado = useMemo(
    () => opcoes.clientes.find((cliente) => cliente.id === clienteId) || null,
    [clienteId, opcoes.clientes],
  );

  const campanhaSelecionada = useMemo(
    () => opcoes.campanhas.find((campanha) => campanha.id === campanhaId) || null,
    [campanhaId, opcoes.campanhas],
  );

  async function enviarArquivos() {
    if (files.length === 0) {
      setError("Selecione ao menos um arquivo antes de enviar.");
      setProgress(0);
      setStatus("error");
      return;
    }

    if (!clienteId) {
      setError("Selecione a carteira/cliente antes de enviar.");
      setProgress(0);
      setStatus("error");
      return;
    }

    setStatus("sending");
    setProgress(8);
    setError("");

    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("clienteId", clienteId);
      if (clienteSelecionado?.nome) body.append("clienteNome", clienteSelecionado.nome);
      if (campanhaId) body.append("campanhaId", campanhaId);
      if (campanhaSelecionada?.nome) body.append("campanhaNome", campanhaSelecionada.nome);
      body.append("transcrever", "true");
      if (canal) body.append("canal", canal);

      const resposta = await fetch("/api/transcricoes", { method: "POST", body });
      const gravacoes = await readApiResponse(resposta);
      const primeiraComErro = gravacoes?.gravacoes?.find((gravacao) => gravacao.status === "erro");
      setResult({
        tipo: "gravacoes",
        busca: files[0]?.name || "",
        destino: destinoDoResultado(gravacoes?.gravacoes, files[0]?.name),
        erroAnalise: primeiraComErro?.erro || null,
        ...gravacoes,
      });
      setProgress(100);
      setStatus("done");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir o envio. Tente novamente."
      );
      setProgress(0);
      setStatus("error");
    }
  }

  const sending = status === "sending";

  /* Arquivos que passam do teto da análise. O upload aceita até 50 MB
     (UPLOAD_MAX_FILE_BYTES), mas a IA recebe o conteúdo embutido na requisição e
     recusa acima de 15 MB. Sem este aviso o arquivo era aceito, guardado, e a
     análise falhava depois — e `.mpeg` chega nesse tamanho com facilidade, porque
     é bem mais pesado que MP3 no mesmo tempo de áudio. */
  const grandesDemais = files.filter((file) => !cabeNaAnaliseIa(file.size));

  /* O upload agora dispara a analise livre do Acordito automaticamente quando
     existe carteira selecionada e arquivo valido. */
  const autoKey =
    status === "idle" && files.length > 0 && clienteId && grandesDemais.length === 0
      ? [
          clienteId,
          campanhaId || "todas",
          canal || "auto",
          ...files.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
        ].join("|")
      : "";

  useEffect(() => {
    if (!autoKey || envioAutomaticoRef.current === autoKey) return undefined;
    envioAutomaticoRef.current = autoKey;
    const timer = setTimeout(() => {
      enviarArquivos();
    }, 250);
    return () => clearTimeout(timer);
    // autoKey concentra os campos que disparam novo envio automatico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  /* O destino termina na avaliacao IA quando a analise conclui; em caso de erro,
     a transcricao continua sendo o lugar para revisar e reprocessar. */
  const destino =
    result?.tipo === "avaliacao"
      ? result.avaliacao?.href
        ? { href: result.avaliacao.href, rotulo: "Abrir a avaliação" }
        : null
      : (result?.destino ?? null);

  const resultadoHref = destino?.href ?? "#";
  const resultadoDisponivel = Boolean(destino);

  return (
    <AppShell active="Upload" breadcrumb="Overview > Upload">
      <section className="page-header">
        <div>
          <p className="eyebrow">Entrada de arquivos</p>
          <h1>Central de upload</h1>
          <p>
            Envie áudios e documentos, acompanhe a fila e abra a avaliação assim que o Acordito
            concluir.
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href="/">
            <Icon name="chevronLeft" size={17} />
            Voltar
          </Link>
          <Link
            className="btn primary"
            href={resultadoHref}
            aria-disabled={sending || !resultadoDisponivel}
          >
            <Icon name="review" size={17} />
            {destino?.rotulo ?? "Abrir a avaliacao"}
          </Link>
        </div>
      </section>

      <section className="upload-board">
        <section className="card pad upload-primary" aria-labelledby="upload-form-title">
          <div style={{ display: "grid", gap: "var(--sp-4)" }}>
            <h2 className={styles.tituloBloco} id="upload-form-title">Enviar para o Acordito</h2>
            <div className="field">
              <label htmlFor="cliente-upload">Carteira / Acordito</label>
              <select
                className="select"
                id="cliente-upload"
                value={clienteId}
                onChange={(evento) => {
                  setClienteId(evento.target.value);
                  setCampanhaId("");
                  setStatus("idle");
                  setError("");
                  setResult(null);
                }}
              >
                <option value="">Selecione a carteira</option>
                {opcoes.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="campanha-upload">Campanha / operação</label>
              <select
                className="select"
                id="campanha-upload"
                value={campanhaId}
                onChange={(evento) => {
                  setCampanhaId(evento.target.value);
                  setStatus("idle");
                  setError("");
                  setResult(null);
                }}
              >
                <option value="">Todas as campanhas da carteira</option>
                {campanhasDisponiveis.map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>
                    {campanha.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* A pergunta que a tela faz agora é "o que é este arquivo?".
                O canal era deduzido do tipo do arquivo — áudio virava ligação,
                o resto virava chat — e o palpite errava calado em PDF de
                transcrição de ligação. Quem envia sabe; a tela pergunta. */}
            <fieldset className="field">
              <legend>Tipo de atendimento</legend>
              <div className={styles.canais}>
                {CANAIS.map((item) => (
                  <label className={styles.canal} key={item.id} data-escolhido={canal === item.id}>
                    <input
                      type="radio"
                      name="canal-upload"
                      value={item.id}
                      checked={canal === item.id}
                      onChange={() => {
                        setCanal(item.id);
                        setStatus("idle");
                        setError("");
                        setResult(null);
                      }}
                    />
                    <span className={styles.canalTexto}>
                      <span className={styles.canalRotulo}>
                        <Icon name={item.icone} size={16} />
                        {item.rotulo}
                      </span>
                      <span className={styles.canalDescricao}>{item.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
              <span className="field-hint">
                Separa o desempenho de chat e ligação em Operações, Campanhas e Avaliados. Sem
                escolher, o canal é deduzido do tipo do arquivo — e a dedução erra em transcrição de
                ligação em PDF.
              </span>
            </fieldset>

          </div>

          {formError ? (
            <p className="alert danger">
              <Icon name="error" size={18} />
              <span>{formError}</span>
            </p>
          ) : null}
          {/* A zona de arraste envolve um input real: quem usa teclado chega
              pelo label, quem usa mouse pode arrastar. Antes não havia input. */}
          <div
            className="upload-zone"
            data-dragging={dragging ? "true" : "false"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div>
              <span className="upload-mark">
                <Icon name={dragging ? "fileAudio" : "upload"} size={26} />
              </span>

              <h2>{dragging ? "Solte para adicionar" : "Arraste arquivos aqui"}</h2>
              <p>
                Áudios MP3, MPEG, WAV, M4A, OGG ou FLAC e documentos PDF. Envie para análise e acompanhe o
                processamento nesta fila. A analise com Acordito inicia automaticamente.
              </p>

              <input
                ref={inputRef}
                className="sr-only"
                id={inputId}
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => addFiles(e.target.files)}
              />

              <div className="actions center-actions">
                {/* label estilizado de botão: aciona o input nativo sem
                    duplicar comportamento em JS. */}
                <label className="btn primary" htmlFor={inputId}>
                  <Icon name="plus" size={17} />
                  Selecionar arquivos
                </label>
              </div>
              <p className="subtle-text">
                Limite: ate {MAX_ARQUIVOS_POR_LOTE} arquivos por lote, com ate 50 MB por arquivo.
                Para melhor desempenho no cPanel, recomendamos enviar de 5 a 10 gravacoes por vez.
              </p>
            </div>
          </div>

          {/* Região viva: resultado e erro são anunciados sem mover o foco. */}
          <div aria-live="polite" style={{ display: "grid", gap: "var(--sp-3)" }}>
            {grandesDemais.length > 0 ? (
              <p className="alert warning">
                <Icon name="alert" size={18} />
                <span className="alert-body">
                  <strong>
                    {grandesDemais.length === 1
                      ? "Um arquivo passa do limite da análise"
                      : `${grandesDemais.length} arquivos passam do limite da análise`}
                  </strong>
                  <span>
                    O Acordito recebe o arquivo dentro da própria requisição e recusa acima de{" "}
                    {formatarMegabytes(MAX_BYTES_ANALISE_IA)}. Remova{" "}
                    {grandesDemais.map((file) => file.name).join(", ")} ou envie um recorte menor da
                    gravação — cortar o trecho avaliado costuma resolver, porque a monitoria olha um
                    atendimento, não o turno inteiro.
                  </span>
                </span>
              </p>
            ) : null}

            {status === "error" ? (
              <p className="alert danger">
                <Icon name="error" size={18} />
                <span className="alert-body">
                  <strong>Envio não concluído</strong>
                  <span>{error}</span>
                </span>
              </p>
            ) : null}

            {status === "done" && result?.tipo === "avaliacao" ? (
              <p className={`alert ${result.resumo.zerada ? "danger" : "success"}`}>
                <Icon name={result.resumo.zerada ? "error" : "checkCircle"} size={18} />
                <span className="alert-body">
                  <strong>
                    {result.resumo.zerada
                      ? "Avaliação zerada por critério eliminatório"
                      : "Avaliação concluída"}
                  </strong>
                  <span>
                    {`Nota ${result.resumo.score} — ${result.resumo.conforme} conformes, ${result.resumo.nao_conforme} não conformes, ${result.resumo.nao_aplicavel} não aplicáveis.`}
                    {result.avaliacao?.id ? ` ID ${result.avaliacao.id}.` : ""}
                  </span>
                </span>
              </p>
            ) : null}

            {status === "done" && result?.tipo === "gravacoes" ? (
              <p className={`alert ${result.erros > 0 ? "danger" : "success"}`}>
                <Icon name={result.erros > 0 ? "error" : "checkCircle"} size={18} />
                <span className="alert-body">
                  <strong>
                    {result.erros > 0 ? "Arquivo salvo, mas a analise falhou" : "Analise concluida"}
                  </strong>
                  <span>
                    {`${result.recebidas ?? 0} novo(s) arquivo(s) registrado(s).`}
                    {result.duplicadas ? ` ${result.duplicadas} duplicado(s) já existiam.` : ""}
                    {result.erroAnalise ? ` ${result.erroAnalise}` : ""}
                  </span>
                </span>
              </p>
            ) : null}

            {files.length === 0 ? (
              <p className="subtle-text">Nenhum arquivo selecionado ainda.</p>
            ) : (
              <ul className="list">
                {files.map((file) => (
                  <li className="row" key={`${file.name}-${file.size}`}>
                    <span className="icon-badge sm">
                      <Icon name="fileAudio" size={15} />
                    </span>
                    <span className="row-main" style={{ flex: "1 1 auto" }}>
                      <span className="row-title">{file.name}</span>
                      <span className="row-meta">
                        {formatSize(file.size)}
                        {cabeNaAnaliseIa(file.size) ? null : (
                          <strong className={styles.arquivoGrande}>
                            {" "}
                            · acima de {formatarMegabytes(MAX_BYTES_ANALISE_IA)}, o Acordito não analisa
                          </strong>
                        )}
                      </span>
                    </span>
                    <button
                      className="btn ghost icon-only"
                      type="button"
                      onClick={() => removeFile(file)}
                      disabled={sending}
                    >
                      <Icon name="close" size={17} label={`Remover ${file.name}`} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card pad" aria-labelledby="fila">
          <div className="section-head">
            <h2 id="fila">Fila de processamento</h2>
            <span className="section-meta">análise Acordito</span>
          </div>

          {files.length === 0 && status !== "done" ? (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="waveform" size={20} />
              </span>
              <h3>Fila vazia</h3>
              <p>
                Os arquivos aparecem aqui com o progresso de transcrição e checklist assim
                que você enviar.
              </p>
            </div>
          ) : (
            <div className="progress-list">
              {files.map((file) => {
                const value = status === "done" ? 100 : sending ? progress : 0;

                return (
                  <div className="progress-item" key={`fila-${file.name}-${file.size}`}>
                    <div className="progress-label">
                      <span>{file.name}</span>
                      <span>{`${value}%`}</span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`Processamento de ${file.name}`}
                      aria-valuenow={value}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`progress-bar ${sending ? "active" : ""} ${value === 100 ? "success" : ""}`}
                        style={{ "--w": `${value}%` }}
                      />
                    </div>
                    <span className="subtle-text">
                      {result?.erros > 0
                        ? "Arquivo salvo; analise pendente de correcao"
                        : status === "done"
                          ? "Analise concluida"
                        : sending
                          ? "Enviando ao Acordito"
                          : "Aguardando envio"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {status === "done" && result?.tipo === "avaliacao" ? (
          <section className="card pad" aria-labelledby="ficha-ia">
            <div className="section-head">
              <div>
                <h2 id="ficha-ia">Ficha preenchida pelo Acordito</h2>
                <p>{result.arquivo.nome} · modelo {result.modelo}</p>
              </div>
              <strong className="headline-number">{result.resumo.score}</strong>
            </div>

            <p>{result.resumoAtendimento}</p>

            {/* Critério que o modelo não devolveu não some em silêncio: some
                em silêncio seria contar como conforme e inflar a nota. */}
            {result.criteriosSemAvaliacao.length > 0 ? (
              <p className="alert warning">
                <Icon name="alert" size={18} />
                <span className="alert-body">
                  <strong>{result.criteriosSemAvaliacao.length} critério(s) sem avaliação</strong>
                  <span>{result.criteriosSemAvaliacao.join(", ")}</span>
                </span>
              </p>
            ) : null}

            {result.secoes.map((secao) => (
              <div key={secao.nome}>
                <h3>{secao.nome}</h3>
                <ul className="list">
                  {secao.criterios.map((criterio) => (
                    <li className="row" key={criterio.nome}>
                      <span className="row-main" style={{ flex: "1 1 auto" }}>
                        <span className="row-title">{criterio.nome}</span>
                        <span className="row-meta">
                          {criterio.justificativa ?? "Sem avaliação."}
                          {criterio.trecho ? ` — "${criterio.trecho}"` : ""}
                        </span>
                      </span>

                      {criterio.confiancaBaixa ? (
                        <span className="chip warning">
                          <Icon name="alert" size={13} />
                          Revisar
                        </span>
                      ) : null}

                      <span
                        className={`chip ${
                          criterio.status === "conforme"
                            ? "success"
                            : criterio.status === "nao_conforme"
                              ? "danger"
                              : "neutral"
                        }`}
                      >
                        <Icon
                          name={
                            criterio.status === "conforme"
                              ? "checkCircle"
                              : criterio.status === "nao_conforme"
                                ? "error"
                                : "info"
                          }
                          size={13}
                        />
                        {criterio.status === "conforme"
                          ? "Conforme"
                          : criterio.status === "nao_conforme"
                            ? "Não Conforme"
                            : criterio.status === "nao_aplicavel"
                              ? "Não Aplicável"
                              : "Pendente"}
                      </span>

                      <span className="score">
                        {criterio.eliminatoria ? "NCG" : `${criterio.peso ?? 0} pts`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <h3>Pontos fortes</h3>
            <ul className="list compact-list">
              {result.pontosFortes.map((ponto) => (
                <li className="row" key={ponto}>{ponto}</li>
              ))}
            </ul>

            <h3>Pontos de desenvolvimento</h3>
            <ul className="list compact-list">
              {result.pontosDesenvolvimento.map((ponto) => (
                <li className="row" key={ponto}>{ponto}</li>
              ))}
            </ul>

            <p className="subtle-text">
              Ficha gerada pelo Acordito a partir do arquivo enviado. Revise antes de aplicar o
              feedback.
            </p>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
