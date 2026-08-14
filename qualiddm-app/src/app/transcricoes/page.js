"use client";

import { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { buscarApi, comFiltros, enviarArquivos } from "@/lib/api";
import { baixarArquivo, formatarNumero, SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const ACEITA = ".mp3,.wav,.m4a,.mp4,.ogg,audio/*";
const POR_PAGINA = 50;

/* Ícone e tom por status; o rótulo vem do backend (`statusLabel`). Cor sozinha
   não informa (WCAG 1.4.1), e aqui a diferença entre "processando" e "erro"
   muda o que o usuário deve fazer. */
const APARENCIA_STATUS = {
  nao_solicitada: { tom: "", icone: "info" },
  pendente: { tom: "warning", icone: "clock" },
  processando: { tom: "info", icone: "spinner" },
  concluida: { tom: "success", icone: "checkCircle" },
  erro: { tom: "danger", icone: "error" },
};

const OPCOES_STATUS = [
  { valor: "nao_solicitada", rotulo: "Não solicitada" },
  { valor: "pendente", rotulo: "Na fila" },
  { valor: "processando", rotulo: "Processando" },
  { valor: "concluida", rotulo: "Concluída" },
  { valor: "erro", rotulo: "Erro" },
];

export default function TranscricoesPage() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(0);

  const [arquivos, setArquivos] = useState([]);
  const [transcrever, setTranscrever] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const inputRef = useRef(null);

  // Texto completo por gravação, buscado sob demanda e guardado para não repetir
  // a requisição a cada abrir/fechar da mesma linha.
  const [expandida, setExpandida] = useState(null);
  const [textos, setTextos] = useState({});

  // A busca filtra no banco (`?busca=`), então espera a digitação parar.
  const buscaAtrasada = useDebounce(busca);

  const url = comFiltros("/api/transcricoes", {
    status,
    busca: buscaAtrasada,
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
  });

  const { dados, carregando, erro, recarregar } = useRecurso(url);

  const contadores = dados?.contadores ?? null;
  const gravacoes = dados?.itens ?? [];
  const total = dados?.paginacao?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const primeiraCarga = carregando && !dados;
  const temRecorte = busca.trim() !== "" || status !== "";

  async function enviar(evento) {
    evento.preventDefault();

    if (arquivos.length === 0) {
      setAviso({ tom: "warning", texto: "Escolha ao menos um arquivo de áudio antes de enviar." });
      return;
    }

    setEnviando(true);
    setAviso(null);

    try {
      const corpo = new FormData();
      // O campo se chama `files` — é o nome que a rota lê em `formData.getAll`.
      for (const arquivo of arquivos) corpo.append("files", arquivo);
      corpo.append("transcrever", transcrever ? "1" : "0");

      const resultado = await enviarArquivos("/api/transcricoes", corpo);
      const recebidas = resultado?.recebidas ?? 0;
      const duplicadas = resultado?.duplicadas ?? 0;

      // Duplicada não é erro nem sucesso silencioso: o arquivo já existia, e
      // quem enviou precisa saber que não entrou uma segunda cópia.
      const partes = [];
      if (recebidas > 0) {
        partes.push(
          `${recebidas} ${recebidas === 1 ? "gravação enviada" : "gravações enviadas"}${
            transcrever
              ? ". A transcrição começa automaticamente e o status aparece na tabela abaixo."
              : ". Ficam na fila até você pedir a transcrição."
          }`,
        );
      }
      if (duplicadas > 0) {
        partes.push(
          `${duplicadas} ${duplicadas === 1 ? "arquivo já existia" : "arquivos já existiam"} e não ${duplicadas === 1 ? "foi" : "foram"} duplicado${duplicadas === 1 ? "" : "s"}.`,
        );
      }

      setAviso({
        tom: recebidas > 0 ? "success" : "warning",
        texto: partes.join(" ") || "Nenhum arquivo novo foi registrado.",
      });

      // Limpa a seleção e o input nativo, senão o mesmo arquivo seria reenviado
      // ao clicar em Enviar de novo.
      setArquivos([]);
      if (inputRef.current) inputRef.current.value = "";
      recarregar();
    } catch (causa) {
      setAviso({ tom: "danger", texto: causa.message });
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Abre (ou fecha) o texto de uma gravação.
   *
   * A listagem só traz uma prévia — o texto integral de 200 linhas inflaria o
   * payload. O texto completo vem de `/api/transcricoes/{id}` na primeira vez que
   * a linha é aberta e fica em cache no estado.
   */
  async function alternarTexto(item) {
    if (expandida === item.id) {
      setExpandida(null);
      return;
    }

    setExpandida(item.id);
    if (textos[item.id]) return;

    setTextos((atual) => ({ ...atual, [item.id]: { carregando: true } }));

    try {
      const dadosGravacao = await buscarApi(`/api/transcricoes/${encodeURIComponent(item.id)}`);
      const gravacao = dadosGravacao?.gravacao ?? null;

      setTextos((atual) => ({
        ...atual,
        [item.id]: {
          carregando: false,
          // O nome do campo de texto varia com o que o repositório monta; a
          // prévia da listagem é o último recurso, e é melhor que "vazio".
          texto:
            gravacao?.transcricao?.texto ??
            gravacao?.texto ??
            item.transcricao?.previa ??
            "",
        },
      }));
    } catch (causa) {
      setTextos((atual) => ({
        ...atual,
        [item.id]: { carregando: false, erro: causa.message },
      }));
    }
  }

  /* Exporta o recorte que está na tela, não a base inteira: é o que o rótulo do
     botão promete, e os dados já estão no cliente. */
  function exportarJson() {
    const conteudo = JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        filtros: { busca: buscaAtrasada || null, status: status || null },
        pagina: paginaAtual + 1,
        totalNoRecorte: total,
        gravacoes,
      },
      null,
      2,
    );

    baixarArquivo("transcricoes.json", conteudo, "application/json;charset=utf-8");
  }

  return (
    <AppShell active="Transcrições" breadcrumb="Qualidade > Transcrições">
      <section className="page-header">
        <div>
          <h1>Transcrições</h1>
          <p>Suba gravações de áudio, acompanhe a transcrição e exporte o resultado em JSON.</p>
        </div>
      </section>

      <section className="card pad" aria-labelledby="enviar-gravacoes">
        <div className="section-head">
          <div>
            <h2 id="enviar-gravacoes">
              <span className="icon-badge sm" aria-hidden="true">
                <Icon name="upload" size={14} />
              </span>
              Enviar gravações
            </h2>
            <p>MP3, WAV, M4A ou OGG. Vários arquivos de uma vez.</p>
          </div>
        </div>

        <form className={styles.formEnvio} onSubmit={enviar}>
          <div className="field">
            <label htmlFor="arquivos-audio">Arquivos de áudio</label>
            <input
              className={styles.inputArquivo}
              id="arquivos-audio"
              ref={inputRef}
              type="file"
              multiple
              accept={ACEITA}
              disabled={enviando}
              onChange={(evento) => {
                setArquivos(Array.from(evento.target.files ?? []));
                setAviso(null);
              }}
            />
            <span className="field-hint">
              {arquivos.length === 0
                ? "Nenhum arquivo escolhido."
                : `${arquivos.length} ${arquivos.length === 1 ? "arquivo" : "arquivos"} escolhido${arquivos.length === 1 ? "" : "s"}.`}
            </span>
          </div>

          <div className={styles.checkboxCampo}>
            <input
              id="transcrever-auto"
              type="checkbox"
              checked={transcrever}
              disabled={enviando}
              onChange={(evento) => setTranscrever(evento.target.checked)}
            />
            <label htmlFor="transcrever-auto">
              Transcrever automaticamente
              <span className="field-hint">
                Desmarque para só armazenar o áudio e transcrever depois.
              </span>
            </label>
          </div>

          <button
            className="btn primary"
            type="submit"
            disabled={enviando || arquivos.length === 0}
          >
            <Icon
              className={enviando ? "spinning" : undefined}
              name={enviando ? "spinner" : "upload"}
              size={16}
            />
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </form>

        {/* Região viva nasce no DOM desde o primeiro render: só assim o leitor de
            tela anuncia o retorno do envio sem roubar o foco do formulário. */}
        <div aria-live="polite" className={styles.avisoArea}>
          {aviso ? (
            <p className={`alert ${aviso.tom}`}>
              <Icon
                name={
                  aviso.tom === "success"
                    ? "checkCircle"
                    : aviso.tom === "danger"
                      ? "error"
                      : "alert"
                }
                size={18}
              />
              <span className="alert-body">{aviso.texto}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section className="card pad" aria-labelledby="lista-gravacoes">
        <div className={`section-head ${styles.listaHead}`}>
          <div>
            <h2 id="lista-gravacoes">
              <span className="icon-badge sm" aria-hidden="true">
                <Icon name="waveform" size={14} />
              </span>
              Gravações ({primeiraCarga ? "…" : formatarNumero(total)})
            </h2>
            <p>
              {contadores
                ? `${formatarNumero(contadores.concluidas)} concluídas · ${formatarNumero(contadores.processando)} processando · ${formatarNumero(contadores.pendentes)} na fila · ${formatarNumero(contadores.erros)} com erro`
                : "Acompanhe o status de cada transcrição"}
            </p>
          </div>

          <button
            className="btn"
            type="button"
            disabled={gravacoes.length === 0}
            onClick={exportarJson}
          >
            <Icon name="download" size={16} />
            Exportar JSON (recorte atual)
          </button>
        </div>

        <div className={styles.barraFiltros}>
          <div className="field">
            <label htmlFor="busca-gravacoes">Buscar por nome do arquivo</label>
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                className="input"
                id="busca-gravacoes"
                type="search"
                placeholder="Buscar por nome do arquivo..."
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.target.value);
                  setPagina(0);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="status-gravacoes">Status</label>
            <select
              className="select"
              id="status-gravacoes"
              value={status}
              onChange={(evento) => {
                setStatus(evento.target.value);
                setPagina(0);
              }}
            >
              <option value="">Todos os status</option>
              {OPCOES_STATUS.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`btn ${styles.botaoAtualizar}`}
            type="button"
            onClick={recarregar}
            disabled={carregando}
          >
            <Icon
              className={carregando ? "spinning" : undefined}
              name={carregando ? "spinner" : "refresh"}
              size={16}
            />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar as gravações</h3>
            <p>{erro}</p>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar novamente
              </button>
            </div>
          </div>
        ) : primeiraCarga ? (
          <>
            <EsqueletoTabela colunas={5} linhas={5} />
            <p className="sr-only" role="status">
              Carregando gravações.
            </p>
          </>
        ) : gravacoes.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name={temRecorte ? "search" : "waveform"} size={22} />
            </span>
            <h3>Nenhuma gravação encontrada</h3>
            <p>
              {temRecorte
                ? "Nenhuma gravação atende ao recorte atual. Ajuste a busca ou o status."
                : "Nenhuma gravação encontrada. Envie áudios acima para começar."}
            </p>
            {temRecorte ? (
              <div className="btn-row">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setStatus("");
                    setPagina(0);
                  }}
                >
                  <Icon name="undo" size={16} />
                  Limpar filtros
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table ${styles.tabela}`}>
                <caption className="sr-only">
                  Gravações enviadas. Exibindo {formatarNumero(gravacoes.length)} de{" "}
                  {formatarNumero(total)} registros.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Arquivo</th>
                    <th scope="col">Enviada em</th>
                    <th className="num" scope="col">
                      Duração
                    </th>
                    <th scope="col">Origem</th>
                    <th scope="col">Transcrição</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {gravacoes.map((item) => {
                    const aparencia =
                      APARENCIA_STATUS[item.status] ?? APARENCIA_STATUS.nao_solicitada;
                    const aberta = expandida === item.id;
                    const temTexto = Boolean(item.transcricao?.previa);
                    const carregado = textos[item.id];

                    return [
                      <tr key={item.id}>
                        <th className={styles.celulaArquivo} scope="row">
                          {item.arquivo || SEM_VALOR}
                        </th>
                        <td>{item.enviadaEm}</td>
                        <td className="num">{item.duracao || SEM_VALOR}</td>
                        <td>{item.origemLabel}</td>
                        <td>
                          <span className={`chip ${aparencia.tom}`}>
                            <Icon
                              className={item.status === "processando" ? "spinning" : undefined}
                              name={aparencia.icone}
                              size={13}
                            />
                            {item.statusLabel}
                          </span>
                        </td>
                        <td>
                          <div className={styles.acoes}>
                            {/* Sem texto não há o que expandir. Botão que abre uma
                                gaveta vazia é pior do que botão ausente. */}
                            {temTexto ? (
                              <button
                                className="btn ghost"
                                type="button"
                                aria-expanded={aberta}
                                aria-controls={`transcricao-${item.id}`}
                                onClick={() => alternarTexto(item)}
                              >
                                <Icon name={aberta ? "chevronUp" : "chevronDown"} size={15} />
                                {aberta ? "Ocultar" : "Ver texto"}
                              </button>
                            ) : null}

                            <button
                              className="btn ghost"
                              type="button"
                              aria-label={`Baixar dados de ${item.arquivo} em JSON`}
                              onClick={() =>
                                baixarArquivo(
                                  `${item.arquivo || item.id}.json`,
                                  JSON.stringify(
                                    { ...item, textoCompleto: carregado?.texto ?? null },
                                    null,
                                    2,
                                  ),
                                  "application/json;charset=utf-8",
                                )
                              }
                            >
                              <Icon name="download" size={15} />
                              JSON
                            </button>
                          </div>
                        </td>
                      </tr>,

                      /* O texto abre numa linha própria de largura total, e não
                         num modal: é longo e o usuário costuma compará-lo com as
                         outras linhas da tabela. */
                      aberta ? (
                        <tr key={`${item.id}-texto`}>
                          <td colSpan={6} id={`transcricao-${item.id}`}>
                            <div className={styles.transcricao}>
                              <p className="label-micro">Transcrição de {item.arquivo}</p>

                              {carregado?.carregando ? (
                                <p className={styles.transcricaoAviso} role="status">
                                  <Icon className="spinning" name="spinner" size={15} />
                                  Carregando o texto completo...
                                </p>
                              ) : carregado?.erro ? (
                                <p className="alert danger">
                                  <Icon name="error" size={16} />
                                  <span className="alert-body">{carregado.erro}</span>
                                </p>
                              ) : (
                                <p className={styles.transcricaoTexto}>
                                  {carregado?.texto || item.transcricao?.previa}
                                </p>
                              )}

                              {item.transcricao?.confianca != null ? (
                                <p className="subtle-text">
                                  Confiança da transcrição:{" "}
                                  {Math.round(item.transcricao.confianca * 100)}%
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>

            {paginas > 1 ? (
              <nav className="pagination" aria-label="Paginação das gravações">
                <button
                  className="btn ghost"
                  type="button"
                  disabled={paginaAtual === 0 || carregando}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  <Icon name="chevronLeft" size={15} />
                  Anterior
                </button>
                <span aria-live="polite">
                  Página {paginaAtual + 1} de {paginas}
                </span>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={paginaAtual >= paginas - 1 || carregando}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                  <Icon name="chevronRight" size={15} />
                </button>
              </nav>
            ) : null}
          </div>
        )}
      </section>
    </AppShell>
  );
}
