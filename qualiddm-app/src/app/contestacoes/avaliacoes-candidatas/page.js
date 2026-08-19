"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import { formatarNumero, SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const POR_PAGINA = 50;

const FILTROS_VAZIOS = {
  clienteId: "",
  campanhaId: "",
  avaliadoId: "",
  avaliadorId: "",
  codigo: "",
  dataInicio: "",
  dataFim: "",
};

/**
 * Os cinco cards do print.
 *
 * Eles contam CONTESTAÇÕES e particionam o total — a soma dos quatro últimos é
 * "Total de Contestações". A tabela abaixo é outra coisa: as avaliações que
 * ainda podem ser contestadas. Dois recortes na mesma tela, e por isso cada
 * bloco tem seu próprio título.
 */
const INDICADORES = [
  { chave: "total", rotulo: "Total de Contestações", icone: "alert", tom: "blue" },
  { chave: "aguardando", rotulo: "Aguardando Revisão", icone: "clock", tom: "yellow" },
  { chave: "procedentes", rotulo: "Procedentes", icone: "checkCircle", tom: "green" },
  { chave: "improcedentes", rotulo: "Improcedentes", icone: "error", tom: "red" },
  { chave: "deliberadas", rotulo: "Deliberadas", icone: "review", tom: "purple" },
];

function contarFiltros(filtros) {
  const simples = ["clienteId", "campanhaId", "avaliadoId", "avaliadorId", "codigo"];
  const total = simples.filter((chave) => filtros[chave].trim() !== "").length;
  // Período conta como UM: para quem usa a tela é um campo só.
  return filtros.dataInicio || filtros.dataFim ? total + 1 : total;
}

export default function ContestacoesPage() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [somenteNaoConformes, setSomenteNaoConformes] = useState(true);
  const [pagina, setPagina] = useState(0);

  const codigoAtrasado = useDebounce(filtros.codigo);

  const url = comFiltros("/api/contestacoes/candidatas", {
    clienteId: filtros.clienteId,
    campanhaId: filtros.campanhaId,
    avaliadoId: filtros.avaliadoId,
    avaliadorId: filtros.avaliadorId,
    codigo: codigoAtrasado,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    // `false` precisa ir na URL: o backend só considera o filtro desligado
    // quando o parâmetro chega explícito.
    somenteNaoConformes: somenteNaoConformes ? "" : "false",
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
  });

  const { dados, carregando, erro, recarregar } = useRecurso(url);
  const { dados: opcoesApi, erro: erroOpcoes } = useRecurso("/api/relatorios/opcoes");

  const itens = dados?.itens ?? [];
  const indicadores = dados?.indicadores ?? null;
  const total = dados?.paginacao?.total ?? 0;
  const opcoes = {
    clientes: opcoesApi?.clientes ?? [],
    campanhas: opcoesApi?.campanhas ?? [],
    avaliados: opcoesApi?.avaliados ?? [],
    avaliadores: opcoesApi?.avaliadores ?? [],
  };

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const filtrosAtivos = contarFiltros(filtros);
  const primeiraCarga = carregando && !dados;

  function alterar(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
    setPagina(0);
  }

  function limparTodos() {
    setFiltros(FILTROS_VAZIOS);
    setPagina(0);
  }

  function limparDatas() {
    setFiltros((atual) => ({ ...atual, dataInicio: "", dataFim: "" }));
    setPagina(0);
  }

  return (
    <AppShell active="Contestações" breadcrumb="Qualidade > Contestações > Avaliações candidatas">
      <section className="page-header">
        <div>
          <h1>Avaliações Candidatas</h1>
          <p>Monitorias com não conformidade que ainda aceitam contestação</p>
        </div>

        <div className="actions">
          <Link className="btn" href="/contestacoes/gestao-adm">
            <Icon name="shield" size={16} />
            Gestão ADM
          </Link>
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

      <section aria-labelledby="indicadores-contestacoes">
        <h2 className="sr-only" id="indicadores-contestacoes">
          Situação das contestações no recorte
        </h2>

        <ul className={styles.indicadores}>
          {INDICADORES.map((item) => (
            <li key={item.chave} className={`card ${styles.indicador}`} data-tom={item.tom}>
              <span className={styles.indicadorTopo}>
                <span className={`icon-tile sm`} data-tom={item.tom}>
                  <Icon name={item.icone} size={15} />
                </span>
                {item.rotulo}
              </span>
              {primeiraCarga ? (
                <span className={`skeleton ${styles.indicadorEsqueleto}`} aria-hidden="true" />
              ) : (
                <strong>
                  {indicadores == null ? SEM_VALOR : formatarNumero(indicadores[item.chave])}
                </strong>
              )}
            </li>
          ))}
        </ul>
        {/* A soma dos quatro cards seguintes é o total: dizer isso evita a
            leitura de que "Deliberadas" seria um subconjunto de "Procedentes". */}
        <p className={styles.notaCards}>
          <Icon name="info" size={14} />
          <span>
            Aguardando Revisão + Procedentes + Improcedentes + Deliberadas = Total. “Deliberadas”
            reúne o que já foi decidido sem ser um sim nem um não: parcialmente deferidas e
            canceladas.
          </span>
        </p>
      </section>

      <section className={`card pad ${styles.filtros}`} aria-labelledby="titulo-filtros">
        <div className={styles.filtrosTopo}>
          <h2 id="titulo-filtros">
            <Icon name="filter" size={16} />
            Filtros avançados
            {filtrosAtivos > 0 ? <span className="count-badge">{filtrosAtivos}</span> : null}
          </h2>
          <button
            className="btn ghost"
            type="button"
            aria-disabled={filtrosAtivos === 0}
            onClick={filtrosAtivos > 0 ? limparTodos : undefined}
          >
            <Icon name="undo" size={15} />
            Limpar todos
          </button>
        </div>

        {erroOpcoes ? (
          <p className="alert warning">
            <Icon name="alert" size={16} />
            <span className="alert-body">
              <strong>Não foi possível carregar as opções de filtro</strong>
              <span>{erroOpcoes} Você ainda pode filtrar por ID e por período.</span>
            </span>
          </p>
        ) : null}

        <div className={styles.grade}>
          <div className="field">
            <label htmlFor="ct-cliente">Cliente / Operação</label>
            <select
              className="select"
              id="ct-cliente"
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
            <label htmlFor="ct-campanha">Campanha</label>
            <select
              className="select"
              id="ct-campanha"
              value={filtros.campanhaId}
              onChange={(evento) => alterar("campanhaId", evento.target.value)}
            >
              <option value="">Todas as campanhas</option>
              {opcoes.campanhas
                .filter((campanha) => !filtros.clienteId || campanha.clienteId === filtros.clienteId)
                .map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>
                    {campanha.nome}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ct-avaliado">Avaliado</label>
            <select
              className="select"
              id="ct-avaliado"
              value={filtros.avaliadoId}
              onChange={(evento) => alterar("avaliadoId", evento.target.value)}
            >
              <option value="">Todos os avaliados</option>
              {opcoes.avaliados.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ct-avaliador">Avaliador / Monitor</label>
            <select
              className="select"
              id="ct-avaliador"
              value={filtros.avaliadorId}
              onChange={(evento) => alterar("avaliadorId", evento.target.value)}
            >
              <option value="">Todos os avaliadores</option>
              {opcoes.avaliadores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ct-codigo">ID da monitoria</label>
            <input
              className="input"
              id="ct-codigo"
              type="search"
              placeholder="Ex: QA-26-000123 ou 000123"
              value={filtros.codigo}
              onChange={(evento) => alterar("codigo", evento.target.value)}
            />
          </div>

          <fieldset className={`field ${styles.periodo}`}>
            <legend>Período de avaliação</legend>
            <div className={styles.periodoCampos}>
              <span className="field">
                <label className="sr-only" htmlFor="ct-de">
                  Data inicial
                </label>
                <input
                  className="input"
                  id="ct-de"
                  type="date"
                  max={filtros.dataFim || undefined}
                  value={filtros.dataInicio}
                  onChange={(evento) => alterar("dataInicio", evento.target.value)}
                />
              </span>
              <span className="field">
                <label className="sr-only" htmlFor="ct-ate">
                  Data final
                </label>
                <input
                  className="input"
                  id="ct-ate"
                  type="date"
                  min={filtros.dataInicio || undefined}
                  value={filtros.dataFim}
                  onChange={(evento) => alterar("dataFim", evento.target.value)}
                />
              </span>
            </div>
          </fieldset>
        </div>

        <div className={styles.filtrosRodape}>
          <p className={styles.dica}>
            <Icon name="info" size={14} />
            <span>Combine filtros para chegar mais rápido à monitoria certa.</span>
          </p>
          <button
            className="btn ghost"
            type="button"
            aria-disabled={!filtros.dataInicio && !filtros.dataFim}
            onClick={filtros.dataInicio || filtros.dataFim ? limparDatas : undefined}
          >
            <Icon name="calendar" size={15} />
            Limpar datas
          </button>
        </div>
      </section>

      <section className="card pad" aria-labelledby="tabela-candidatas">
        <div className="section-head">
          <div>
            <h2 id="tabela-candidatas">Monitorias contestáveis</h2>
            <p>
              {primeiraCarga
                ? "Carregando monitorias..."
                : `${formatarNumero(total)} ${total === 1 ? "monitoria" : "monitorias"} no recorte`}
            </p>
          </div>

          {/* O recorte anunciado pelo título é "com não conformidade". O botão
              existe porque num banco onde os contadores não foram preenchidos
              esse filtro esconde tudo — e tela vazia parece defeito. */}
          <button
            className="btn"
            type="button"
            aria-pressed={somenteNaoConformes}
            onClick={() => {
              setSomenteNaoConformes((atual) => !atual);
              setPagina(0);
            }}
          >
            <Icon name={somenteNaoConformes ? "check" : "filter"} size={15} />
            Só com não conformidade
          </button>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar as candidatas</h3>
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
            <EsqueletoTabela colunas={7} linhas={8} />
            <p className="sr-only" role="status">
              Carregando monitorias.
            </p>
          </>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="filter" size={22} />
            </span>
            <h3>Nenhuma monitoria contestável no recorte</h3>
            <p>
              {somenteNaoConformes
                ? "Só aparecem aqui monitorias com feedback em aberto e alguma não conformidade."
                : "Nenhuma monitoria com feedback em aberto atende aos filtros atuais."}
            </p>
            <div className="btn-row">
              {somenteNaoConformes ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSomenteNaoConformes(false);
                    setPagina(0);
                  }}
                >
                  <Icon name="filter" size={16} />
                  Mostrar todas as pendentes
                </button>
              ) : null}
              {filtrosAtivos > 0 ? (
                <button className="btn" type="button" onClick={limparTodos}>
                  <Icon name="undo" size={16} />
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.tabela}`}>
                <caption className="sr-only">
                  Monitorias que aceitam contestação. Exibindo {formatarNumero(itens.length)} de{" "}
                  {formatarNumero(total)} registros, página {paginaAtual + 1} de {paginas}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Formulário</th>
                    <th scope="col">Campanha</th>
                    <th scope="col">Avaliado</th>
                    <th scope="col">Monitor</th>
                    <th scope="col">Score</th>
                    <th scope="col">Não conformes</th>
                    <th scope="col">Data</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const faixa = item.score == null ? null : faixaDaNota(item.score);

                    return (
                      <tr key={item.id}>
                        <th scope="row">
                          <span className={styles.celulaFormulario}>
                            {item.formulario}
                            <span>{item.id}</span>
                          </span>
                        </th>
                        <td>{item.campanha}</td>
                        <td>{item.avaliado}</td>
                        <td className={styles.celulaSuave}>{item.avaliador}</td>
                        <td>
                          <span className={styles.score} data-tom={faixa?.tom ?? ""}>
                            {item.score == null ? SEM_VALOR : item.score.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          {/* Zerada não é o mesmo que "muitas falhas": um
                              eliminatório sozinho já derruba a monitoria, e a
                              contagem de não conformes pode ser baixa. */}
                          <span
                            className={`count-badge ${item.naoConformes > 0 ? "danger" : ""}`}
                          >
                            {item.naoConformes}
                          </span>
                          {item.zerada ? <span className="chip danger">Zerada</span> : null}
                        </td>
                        <td className={styles.celulaSuave}>{item.data}</td>
                        <td>
                          <Link
                            className="btn ghost"
                            href={`/contestacoes/${encodeURIComponent(item.id)}`}
                          >
                            <Icon name={item.contestacoes > 0 ? "review" : "alert"} size={15} />
                            {item.contestacoes > 0 ? "Ver contestação" : "Contestar"}
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
              <nav className="pagination" aria-label="Paginação das candidatas">
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
