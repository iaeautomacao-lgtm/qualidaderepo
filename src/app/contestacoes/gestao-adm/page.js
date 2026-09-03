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

const INDICADORES = [
  { chave: "total", rotulo: "Total de Contestações", icone: "alert", tom: "blue" },
  { chave: "aguardando", rotulo: "Aguardando Revisão", icone: "clock", tom: "yellow" },
  { chave: "procedentes", rotulo: "Procedentes", icone: "checkCircle", tom: "green" },
  { chave: "improcedentes", rotulo: "Improcedentes", icone: "error", tom: "red" },
  { chave: "deliberadas", rotulo: "Deliberadas", icone: "review", tom: "purple" },
];

const STATUS = [
  { valor: "todos", rotulo: "Todos os status" },
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "em_analise", rotulo: "Em análise" },
  { valor: "julgada", rotulo: "Julgada" },
  { valor: "cancelada", rotulo: "Cancelada" },
];

const APARENCIA_STATUS = {
  pendente: { tom: "warning", icone: "clock" },
  em_analise: { tom: "info", icone: "review" },
  julgada: { tom: "success", icone: "checkCircle" },
  cancelada: { tom: "", icone: "close" },
};

export default function GestaoAdmPage() {
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pagina, setPagina] = useState(0);

  const buscaAtrasada = useDebounce(busca);
  const codigoAtrasado = useDebounce(codigo);

  const url = comFiltros("/api/contestacoes", {
    status,
    busca: buscaAtrasada,
    codigo: codigoAtrasado,
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
  });

  const { dados, carregando, erro, recarregar } = useRecurso(url);

  const itens = dados?.itens ?? [];
  const indicadores = dados?.indicadores ?? null;
  const total = dados?.paginacao?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const primeiraCarga = carregando && !dados;

  return (
    <AppShell active="Contestações" breadcrumb="Qualidade > Contestações > Gestão ADM">
      <section className="page-header">
        <div>
          <h1>Gestão ADM</h1>
          <p>Contestações abertas pela supervisão, para julgamento item por item</p>
        </div>

        <div className="actions">
          <Link className="btn" href="/contestacoes/avaliacoes-candidatas">
            <Icon name="alert" size={16} />
            Avaliações candidatas
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

      <section aria-labelledby="indicadores-adm">
        <h2 className="sr-only" id="indicadores-adm">
          Situação das contestações
        </h2>

        <ul className={styles.situacoes}>
          {INDICADORES.map((item) => (
            <li key={item.chave}>
              {/* Cartões de leitura, não filtro: "Procedentes" e "Improcedentes"
                  são RESULTADO de julgamento, e a tabela filtra por STATUS. Um
                  card clicável aqui prometeria um recorte que o filtro não faz. */}
              <div className={`card ${styles.situacao}`}>
                <span className={styles.situacaoTopo}>
                  <span className={styles.situacaoRotulo}>
                    <span className="icon-tile sm" data-tom={item.tom}>
                      <Icon name={item.icone} size={15} />
                    </span>
                    {item.rotulo}
                  </span>
                </span>
                {primeiraCarga ? (
                  <span className={`skeleton ${styles.situacaoEsqueleto}`} aria-hidden="true" />
                ) : (
                  <strong className={styles.situacaoValor}>
                    {indicadores == null ? SEM_VALOR : formatarNumero(indicadores[item.chave])}
                  </strong>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card pad" aria-labelledby="lista-contestacoes">
        <div className={`section-head ${styles.blocoHead}`}>
          <div>
            <h2 id="lista-contestacoes">Avaliações com contestação</h2>
            <p>
              {primeiraCarga
                ? "Carregando contestações..."
                : `${formatarNumero(total)} ${total === 1 ? "avaliação" : "avaliações"} no recorte`}
            </p>
          </div>
        </div>

        <div className={styles.buscas}>
          <div className="field">
            <label htmlFor="adm-busca">Buscar</label>
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                className="input"
                id="adm-busca"
                type="search"
                placeholder="Formulário, avaliado ou monitor"
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.target.value);
                  setPagina(0);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="adm-codigo">ID da monitoria</label>
            <input
              className="input"
              id="adm-codigo"
              type="search"
              placeholder="Ex: QA-26-000123 ou 000123"
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value);
                setPagina(0);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="adm-status">Status</label>
            <select
              className="select"
              id="adm-status"
              value={status}
              onChange={(evento) => {
                setStatus(evento.target.value);
                setPagina(0);
              }}
            >
              {STATUS.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar as contestações</h3>
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
              Carregando contestações.
            </p>
          </>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge success">
              <Icon name="checkCircle" size={22} />
            </span>
            <h3>Nenhuma contestação no recorte</h3>
            <p>
              {status === "todos"
                ? "Nenhuma monitoria foi contestada até agora. Os pedidos abertos pela supervisão aparecem aqui."
                : "Nenhum pedido nesse status. Troque o filtro para ver os demais."}
            </p>
          </div>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.tabela}`}>
                <caption className="sr-only">
                  Avaliações com contestação. Exibindo {formatarNumero(itens.length)} de{" "}
                  {formatarNumero(total)} registros, página {paginaAtual + 1} de {paginas}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    {/* Campanha e monitor entram como sub-linha de formulário e
                        avaliado: em colunas próprias a tabela passa de 1400px e o
                        botão de julgar cai atrás da barra de rolagem. */}
                    <th scope="col">Formulário e campanha</th>
                    <th scope="col">Avaliado e monitor</th>
                    <th scope="col">Itens contestados</th>
                    <th scope="col">Prazo</th>
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
                            {item.id}
                            <BotaoCopiar valor={item.id} />
                          </span>
                        </th>
                        <td>
                          <span className={styles.celulaEmpilhada}>
                            <span className={styles.celulaFormulario}>
                              <span className={styles.formularioNome}>{item.formulario}</span>
                              <span className={`chip ${aparencia.tom} ${styles.statusInline}`}>
                                <Icon name={aparencia.icone} size={12} />
                                {item.statusLabel}
                              </span>
                            </span>
                            <span className={styles.celulaSecundaria}>{item.campanha}</span>
                          </span>
                        </td>
                        <td>
                          <span className={styles.celulaEmpilhada}>
                            {item.avaliado}
                            <span className={styles.celulaSecundaria}>{item.avaliador}</span>
                          </span>
                        </td>
                        <td>
                          <span className="count-badge">{item.itensContestados}</span>
                          {item.contestacoes > 1 ? (
                            <span className="metric-note"> em {item.contestacoes} pedidos</span>
                          ) : null}
                        </td>
                        <td>
                          <span className={styles.celulaPrazo}>
                            {item.prazo ?? SEM_VALOR}
                            <span>aberta {item.ultimaAbertura ?? SEM_VALOR}</span>
                          </span>
                        </td>
                        <td>
                          <Link
                            className="btn ghost"
                            href={`/contestacoes/gestao-adm/${encodeURIComponent(item.id)}`}
                          >
                            <Icon name="shield" size={15} />
                            {item.status === "julgada" ? "Ver parecer" : "Julgar"}
                            <span className="sr-only"> a contestação da monitoria {item.id}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paginas > 1 ? (
              <nav className="pagination" aria-label="Paginação das contestações">
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
