"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import BotaoCopiar from "@/components/BotaoCopiar";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros } from "@/lib/api";
import { formatarNumero, SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const POR_PAGINA = 50;

const FILTROS_VAZIOS = {
  busca: "",
  clienteId: "",
  campanhaId: "",
  avaliadorId: "",
  supervisorId: "",
  dataInicio: "",
  dataFim: "",
};

/**
 * Os cinco cards da faixa superior.
 *
 * `chave` é o valor que vai em `?status=` e também o nome do contador na
 * resposta — os dois lados usam o mesmo vocabulário do repositório
 * (`FILTRO_STATUS`). "finalizadas" é um agrupamento no backend: soma concluídas
 * com justificadas, e é por isso que só esse card tem sub-linha.
 */
const SITUACOES = [
  { chave: "pendente", rotulo: "Pendente", icone: "clock", tom: "info" },
  { chave: "assinatura", rotulo: "Assinatura", icone: "edit", tom: "warning" },
  { chave: "finalizadas", rotulo: "Finalizadas", icone: "checkCircle", tom: "green" },
  { chave: "revisao", rotulo: "Revisão", icone: "review", tom: "red" },
  { chave: "todos", rotulo: "Todos", icone: "trendUp", tom: "accent" },
];

/* Ícone e tom por status. O rótulo vem do backend (`statusLabel`), que o lê da
   tabela de configurações — a tela "Configurações de Feedbacks" edita isso em
   produção, então fixar o texto aqui criaria divergência. Ícone + texto + cor
   sempre juntos: cor sozinha não informa (WCAG 1.4.1). */
const APARENCIA_STATUS = {
  pendente: { tom: "info", icone: "clock" },
  assinatura: { tom: "warning", icone: "edit" },
  concluida: { tom: "success", icone: "checkCircle" },
  justificada: { tom: "accent", icone: "review" },
  revisao: { tom: "danger", icone: "alert" },
  dispensado: { tom: "", icone: "info" },
};

function contarFiltros(filtros) {
  const simples = ["busca", "clienteId", "campanhaId", "avaliadorId", "supervisorId"];
  const total = simples.filter((chave) => filtros[chave].trim() !== "").length;
  // Período conta como UM filtro: para quem usa a tela é um campo só, e contar 2
  // com as duas datas preenchidas faria o rótulo mentir.
  return filtros.dataInicio || filtros.dataFim ? total + 1 : total;
}

export default function FeedbackPage() {
  const [situacao, setSituacao] = useState("todos");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [pagina, setPagina] = useState(0);

  // A busca vai ao banco (`?busca=`), então espera a digitação parar.
  const buscaAtrasada = useDebounce(filtros.busca);

  const url = comFiltros("/api/feedbacks", {
    status: situacao,
    clienteId: filtros.clienteId,
    campanhaId: filtros.campanhaId,
    avaliadorId: filtros.avaliadorId,
    supervisorId: filtros.supervisorId,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    busca: buscaAtrasada,
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
  });

  const { dados, carregando, erro, recarregar } = useRecurso(url);

  /* As opções dos selects vêm do catálogo do banco, e não das linhas
     carregadas: a tabela é paginada, e derivar as opções da página atual
     esconderia clientes que só aparecem na página seguinte. */
  const { dados: opcoesApi, erro: erroOpcoes } = useRecurso("/api/relatorios/opcoes");

  const contadores = dados?.contadores ?? null;
  const itens = dados?.itens ?? [];
  const totalDoRecorte = dados?.paginacao?.total ?? 0;
  const opcoes = {
    clientes: opcoesApi?.clientes ?? [],
    campanhas: opcoesApi?.campanhas ?? [],
    avaliadores: opcoesApi?.avaliadores ?? [],
  };

  const paginas = Math.max(1, Math.ceil(totalDoRecorte / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const filtrosAtivos = contarFiltros(filtros);
  const primeiraCarga = carregando && !dados;
  const inicioDaFaixa = totalDoRecorte === 0 ? 0 : paginaAtual * POR_PAGINA + 1;
  const fimDaFaixa = paginaAtual * POR_PAGINA + itens.length;

  function alterar(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
    // Trocar o recorte reinicia a paginação: a página 4 do filtro anterior
    // provavelmente não existe no filtro novo, e a tabela viria vazia.
    setPagina(0);
  }

  function limpar() {
    setFiltros(FILTROS_VAZIOS);
    setPagina(0);
  }

  function escolherSituacao(chave) {
    setSituacao(chave);
    setPagina(0);
  }

  return (
    <AppShell active="Feedback" breadcrumb="Qualidade > Feedback">
      <section className="page-header">
        <div>
          <h1>Lista de Feedbacks</h1>
          <p>Gerencie e filtre os feedbacks do sistema</p>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon
              className={carregando ? "spinning" : undefined}
              name={carregando ? "spinner" : "refresh"}
              size={16}
            />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className={`card ${styles.filtros}`} aria-labelledby="titulo-filtros">
        <div className={styles.filtrosTopo}>
          {/* Botão dentro do heading, e não heading dentro do botão: é o padrão
              de acordeão do WAI-ARIA e o único que mantém HTML válido. */}
          <h2 id="titulo-filtros">
            <button
              className={styles.filtrosToggle}
              type="button"
              aria-expanded={filtrosAbertos}
              aria-controls="painel-filtros"
              onClick={() => setFiltrosAbertos((aberto) => !aberto)}
            >
              <Icon name="filter" size={16} />
              Filtros de Busca
              {filtrosAtivos > 0 ? <span className="count-badge">{filtrosAtivos}</span> : null}
              <Icon name={filtrosAbertos ? "chevronUp" : "chevronDown"} size={15} />
            </button>
          </h2>

          <button
            className="btn ghost"
            type="button"
            aria-disabled={filtrosAtivos === 0}
            onClick={filtrosAtivos > 0 ? limpar : undefined}
          >
            <Icon name="undo" size={15} />
            Limpar
          </button>
        </div>

        <div className={styles.filtrosCorpo} id="painel-filtros" hidden={!filtrosAbertos}>
          {erroOpcoes ? (
            <p className="alert warning">
              <Icon name="alert" size={16} />
              <span className="alert-body">
                <strong>Não foi possível carregar as opções de filtro</strong>
                <span>{erroOpcoes} Você ainda pode buscar por texto e por período.</span>
              </span>
            </p>
          ) : null}

          <div className={styles.grade}>
            <div className={`field ${styles.campoLargo}`}>
              <label htmlFor="feedback-busca">Busca livre</label>
              <div className="search-field">
                <Icon name="search" size={18} />
                <input
                  className="input"
                  id="feedback-busca"
                  type="search"
                  placeholder="ID, avaliado, avaliador, cliente ou cód. gravação"
                  value={filtros.busca}
                  onChange={(evento) => alterar("busca", evento.target.value)}
                />
              </div>
              <span className="field-hint">
                A busca roda no banco e cobre todas as páginas do recorte.
              </span>
            </div>

            <div className="field">
              <label htmlFor="feedback-cliente">Cliente</label>
              <select
                className="select"
                id="feedback-cliente"
                value={filtros.clienteId}
                onChange={(evento) => alterar("clienteId", evento.target.value)}
              >
                <option value="">Todos os clientes</option>
                {opcoes.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-campanha">Campanha</label>
              <select
                className="select"
                id="feedback-campanha"
                value={filtros.campanhaId}
                onChange={(evento) => alterar("campanhaId", evento.target.value)}
              >
                <option value="">Todas as campanhas</option>
                {/* Quando há cliente escolhido, só as campanhas dele: a lista
                    inteira tem dezenas de nomes de outros clientes. */}
                {opcoes.campanhas
                  .filter(
                    (campanha) =>
                      !filtros.clienteId || campanha.clienteId === filtros.clienteId,
                  )
                  .map((campanha) => (
                    <option key={campanha.id} value={campanha.id}>
                      {campanha.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-avaliador">Avaliador</label>
              <select
                className="select"
                id="feedback-avaliador"
                value={filtros.avaliadorId}
                onChange={(evento) => alterar("avaliadorId", evento.target.value)}
              >
                <option value="">Todos os avaliadores</option>
                {opcoes.avaliadores.map((avaliador) => (
                  <option key={avaliador.id} value={avaliador.id}>
                    {avaliador.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-superior">Superior</label>
              <select
                className="select"
                id="feedback-superior"
                value={filtros.supervisorId}
                onChange={(evento) => alterar("supervisorId", evento.target.value)}
              >
                <option value="">Todos os superiores</option>
                {/* Reaproveita a lista de avaliadores, que já traz os papéis de
                    monitor, supervisor e administrador. Uma lista só de
                    supervisores exigiria um endpoint próprio — anotado como
                    pendência na spec. */}
                {opcoes.avaliadores.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className={`field ${styles.periodo}`}>
              <legend>Período de avaliação</legend>
              <div className={styles.periodoCampos}>
                <span className="field">
                  <label className="sr-only" htmlFor="feedback-de">
                    Data inicial do período
                  </label>
                  <input
                    className="input"
                    id="feedback-de"
                    type="date"
                    max={filtros.dataFim || undefined}
                    value={filtros.dataInicio}
                    onChange={(evento) => alterar("dataInicio", evento.target.value)}
                  />
                </span>
                <span className="field">
                  <label className="sr-only" htmlFor="feedback-ate">
                    Data final do período
                  </label>
                  <input
                    className="input"
                    id="feedback-ate"
                    type="date"
                    min={filtros.dataInicio || undefined}
                    value={filtros.dataFim}
                    onChange={(evento) => alterar("dataFim", evento.target.value)}
                  />
                </span>
              </div>
            </fieldset>
          </div>
        </div>
      </section>

      <section aria-labelledby="situacoes-feedback">
        <h2 className="sr-only" id="situacoes-feedback">
          Filtrar por situação do feedback
        </h2>

        <ul className={styles.situacoes}>
          {SITUACOES.map((item) => {
            const ativo = situacao === item.chave;
            const valor = contadores?.[item.chave];

            return (
              <li key={item.chave}>
                <button
                  className={`card ${styles.situacao}`}
                  type="button"
                  data-ativo={ativo ? "true" : "false"}
                  aria-pressed={ativo}
                  onClick={() => escolherSituacao(item.chave)}
                >
                  <span className={styles.situacaoTopo}>
                    <span className={styles.situacaoRotulo}>
                      <span className={`icon-tile sm ${styles.situacaoIcone}`} data-tom={item.tom}>
                        <Icon name={item.icone} size={15} />
                      </span>
                      {item.rotulo}
                    </span>
                    {ativo ? <span className="chip accent">Ativo</span> : null}
                  </span>

                  {primeiraCarga ? (
                    <span className={`skeleton ${styles.situacaoEsqueleto}`} aria-hidden="true" />
                  ) : (
                    <strong className={styles.situacaoValor}>
                      {valor == null ? SEM_VALOR : formatarNumero(valor)}
                    </strong>
                  )}

                  {/* Sub-contagem só das Finalizadas: as duas maneiras de fechar
                      um feedback (aplicado ao operador ou justificado) somam no
                      mesmo card, e sem a linha o total não se explica. */}
                  {item.chave === "finalizadas" && contadores ? (
                    <span className="metric-note">
                      Concluídas: {formatarNumero(contadores.concluidas)} · Justificadas:{" "}
                      {formatarNumero(contadores.justificadas)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {totalDoRecorte > POR_PAGINA ? (
        <p className={styles.nota}>
          <Icon name="info" size={15} />
          <span>
            A tabela exibe {formatarNumero(inicioDaFaixa)}–{formatarNumero(fimDaFaixa)} de{" "}
            {formatarNumero(totalDoRecorte)} monitorias do filtro atual — os cards refletem o
            total. Use a paginação ou refine os filtros (período, cliente, avaliador) para
            alcançar as demais.
          </span>
        </p>
      ) : null}

      <section className="card pad" aria-labelledby="tabela-feedbacks">
        <div className={`section-head ${styles.tabelaHead}`}>
          <div>
            <h2 id="tabela-feedbacks">Monitorias</h2>
            <p>
              {primeiraCarga
                ? "Carregando monitorias..."
                : `${formatarNumero(totalDoRecorte)} ${totalDoRecorte === 1 ? "monitoria" : "monitorias"} no recorte`}
            </p>
          </div>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar os feedbacks</h3>
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
            <EsqueletoTabela colunas={6} linhas={8} />
            <p className="sr-only" role="status">
              Carregando monitorias.
            </p>
          </>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="filter" size={22} />
            </span>
            <h3>Nenhum feedback encontrado</h3>
            <p>
              {filtrosAtivos > 0 || situacao !== "todos"
                ? "Nenhuma monitoria atende ao recorte atual. Ajuste os filtros ou volte para a situação “Todos”."
                : "Ainda não há monitorias com feedback registrado."}
            </p>
            {filtrosAtivos > 0 ? (
              <div className="btn-row">
                <button className="btn" type="button" onClick={limpar}>
                  <Icon name="undo" size={16} />
                  Limpar filtros
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.tabela}`}>
                <caption className="sr-only">
                  Monitorias com feedback. Exibindo {formatarNumero(itens.length)} de{" "}
                  {formatarNumero(totalDoRecorte)} registros, página {paginaAtual + 1} de {paginas}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Data avaliação</th>
                    <th scope="col">Status feedback</th>
                    <th scope="col">Superior</th>
                    <th scope="col">Avaliador</th>
                    <th scope="col">Data contato</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Campanha</th>
                    <th scope="col">Cód. gravação</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const aparencia = APARENCIA_STATUS[item.status] ?? { tom: "", icone: "info" };

                    return (
                      <tr key={item.id}>
                        <th scope="row">
                          <span className="cell-id">
                            {/* O ID abre a ficha COMPACTA de feedback. No QualiTalk
                                a ficha é um modal sobre esta lista; aqui é a
                                página /feedback/[id], que cabe na tela, mantém
                                deep-link e leva à avaliação inteira num clique. */}
                            <Link
                              className="table-link"
                              href={`/feedback/${encodeURIComponent(item.id)}`}
                            >
                              {item.id}
                            </Link>
                            <BotaoCopiar valor={item.id} />
                          </span>
                        </th>
                        <td>{item.dataAvaliacaoFormatada}</td>
                        <td>
                          <span className={`chip ${aparencia.tom}`}>
                            <Icon name={aparencia.icone} size={13} />
                            {item.statusLabel}
                          </span>
                        </td>
                        <td>{item.superior}</td>
                        <td>{item.avaliador}</td>
                        <td>{item.dataContatoFormatada}</td>
                        <td>{item.cliente}</td>
                        <td>{item.campanha}</td>
                        <td>{item.codGravacao}</td>
                        <td>
                          {/* Rótulo com o ID: numa tabela de 50 linhas, 50 links
                              chamados "Dar feedback" não dizem nada em leitor de tela. */}
                          <Link
                            className={`btn ghost ${styles.acaoLinha}`}
                            href={`/feedback/${encodeURIComponent(item.id)}`}
                          >
                            <Icon name="feedback" size={15} />
                            Dar feedback
                            <span className="sr-only"> da monitoria {item.id}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paginas > 1 ? (
              <nav className="pagination" aria-label="Paginação dos feedbacks">
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
