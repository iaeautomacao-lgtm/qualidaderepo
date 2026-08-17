"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";

const ACCEPT = ".mp3,.mpeg,.wav,.m4a,.mp4,.pdf,.txt,.csv,.xls,.xlsx,audio/*,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

export default function UploadPage() {
  const inputRef = useRef(null);
  const inputId = useId();
  const [files, setFiles] = useState([]);
  const [opcoes, setOpcoes] = useState({ clientes: [], campanhas: [] });
  const [clienteId, setClienteId] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [formularios, setFormularios] = useState([]);
  const [formularioId, setFormularioId] = useState("");
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
        const [respostaFormularios, respostaOpcoes] = await Promise.all([
          fetch("/api/formularios", { cache: "no-store" }),
          fetch("/api/relatorios/opcoes", { cache: "no-store" }),
        ]);

        const payloadFormularios = await respostaFormularios.json().catch(() => null);
        const payloadOpcoes = await respostaOpcoes.json().catch(() => null);

        if (!respostaFormularios.ok || !payloadFormularios?.ok) {
          throw new Error(payloadFormularios?.error?.message || "Nao foi possivel carregar formularios.");
        }

        if (!ativo) return;
        const lista = (payloadFormularios.data?.recentes || []).filter(
          (formulario) =>
            ["ativo", "desenvolvimento"].includes(formulario.status) &&
            Number(formulario.questoes ?? 0) > 0,
        );
        setFormularios(lista);

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
        }

        const preSelecionado = new URLSearchParams(window.location.search).get("formularioId");
        if (preSelecionado && lista.some((formulario) => formulario.id === preSelecionado)) {
          setFormularioId(preSelecionado);
        }
      } catch (cause) {
        if (ativo) {
          setFormError(cause instanceof Error ? cause.message : "Nao foi possivel carregar formularios.");
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
        (campanha) => !clienteId || !campanha.clienteId || campanha.clienteId === clienteId,
      ),
    [clienteId, opcoes.campanhas],
  );

  const formulariosDisponiveis = useMemo(() => {
    const clienteSelecionado = opcoes.clientes.find((cliente) => cliente.id === clienteId);
    const campanhaSelecionada = opcoes.campanhas.find((campanha) => campanha.id === campanhaId);
    return formularios.filter((formulario) => {
      if (clienteSelecionado && formulario.cliente && formulario.cliente !== clienteSelecionado.nome) return false;
      if (campanhaSelecionada && formulario.campanha && !formulario.campanha.includes(campanhaSelecionada.nome)) return false;
      return true;
    });
  }, [campanhaId, clienteId, formularios, opcoes.campanhas, opcoes.clientes]);

  async function onSubmit(event) {
    event.preventDefault();
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
      // Um arquivo por vez: a avaliação é de UM atendimento contra a ficha.
      // Mandar vários de uma vez misturaria chamadas diferentes numa nota só.
      const body = new FormData();
      if (formularioId) {
        body.append("arquivo", files[0]);
        body.append("formularioId", formularioId);
        body.append("clienteId", clienteId);
        if (campanhaId) body.append("campanhaId", campanhaId);

        const resposta = await fetch("/api/avaliar", { method: "POST", body });
        const avaliado = await readApiResponse(resposta);
        setResult({ tipo: "avaliacao", ...avaliado });
      } else {
        files.forEach((file) => body.append("files", file));
        body.append("clienteId", clienteId);
        if (campanhaId) body.append("campanhaId", campanhaId);
        body.append("transcrever", "true");

        const resposta = await fetch("/api/transcricoes", { method: "POST", body });
        const gravacoes = await readApiResponse(resposta);
        setResult({ tipo: "gravacoes", ...gravacoes });
      }
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
  const resultadoHref = result?.avaliacao?.href || "#";

  return (
    <AppShell active="Upload" breadcrumb="Overview > Upload">
      <section className="page-header">
        <div>
          <p className="eyebrow">Entrada de arquivos</p>
          <h1>Central de upload</h1>
          <p>
            Envie áudios e documentos, acompanhe a fila e abra a avaliação assim que a IA
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
            aria-disabled={sending || !result?.avaliacao?.href}
          >
            <Icon name="review" size={17} />
            Abrir resultado
          </Link>
        </div>
      </section>

      <section className="upload-board">
        <form className="card pad upload-primary" onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: "var(--sp-4)" }}>
            <div className="field">
              <label htmlFor="cliente-upload">Carteira / Monitor IA</label>
              <select
                className="select"
                id="cliente-upload"
                value={clienteId}
                onChange={(evento) => {
                  setClienteId(evento.target.value);
                  setCampanhaId("");
                  setFormularioId("");
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
                  setFormularioId("");
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

            <div className="field">
              <label htmlFor="formulario-upload">Ficha de avaliacao opcional</label>
              <select
                className="select"
                id="formulario-upload"
                value={formularioId}
                onChange={(evento) => {
                  setFormularioId(evento.target.value);
                  setStatus("idle");
                  setError("");
                  setResult(null);
                }}
              >
                <option value="">Sem ficha - apenas subir para fila</option>
                {formulariosDisponiveis.map((formulario) => (
                  <option key={formulario.id} value={formulario.id}>
                    {[formulario.nome, formulario.cliente, formulario.campanha].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                Com ficha, a IA gera avaliacao. Sem ficha, o arquivo fica salvo na fila da carteira.
              </span>
            </div>
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
                Áudios MP3, WAV ou M4A e documentos PDF. Envie para análise e acompanhe o
                processamento nesta fila.
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
                <button
                  className="btn"
                  type="submit"
                  disabled={sending || files.length === 0 || !clienteId}
                >
                  <Icon name={sending ? "spinner" : "sparkles"} size={17} className={sending ? "spinning" : undefined} />
                  {sending ? "Enviando..." : formularioId ? "Enviar para a IA" : "Subir para a fila"}
                </button>
              </div>
            </div>
          </div>

          {/* Região viva: resultado e erro são anunciados sem mover o foco. */}
          <div aria-live="polite" style={{ display: "grid", gap: "var(--sp-3)" }}>
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
              <p className="alert success">
                <Icon name="checkCircle" size={18} />
                <span className="alert-body">
                  <strong>Arquivo salvo na fila</strong>
                  <span>
                    {`${result.recebidas ?? 0} novo(s) arquivo(s) registrado(s).`}
                    {result.duplicadas ? ` ${result.duplicadas} duplicado(s) já existiam.` : ""}
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
                      <span className="row-meta">{formatSize(file.size)}</span>
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
        </form>

        <section className="card pad" aria-labelledby="fila">
          <div className="section-head">
            <h2 id="fila">Fila de processamento</h2>
            <span className="section-meta">análise IA</span>
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
                      {status === "done"
                        ? "Transcrição concluída"
                        : sending
                          ? "Enviando para a IA"
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
                <h2 id="ficha-ia">Ficha preenchida pela IA</h2>
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
              Ficha gerada por IA a partir do arquivo enviado. Revise antes de aplicar o
              feedback.
            </p>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
