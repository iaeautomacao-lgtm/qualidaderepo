"use client";

import { useState } from "react";
import Link from "next/link";
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

/**
 * Os três cards da faixa superior.
 *
 * `contador` é o nome do campo na resposta e `status` o valor que vai em
 * `?status=`. Os dois diferem porque o card "Todas" não filtra nada, e porque o
 * backend conta em plural (`julgadas`) mas filtra no singular (`julgada`), que é
 * o valor gravado na coluna.
 */
const SITUACOES = [
  { chave: "todas", contador: "todas", status: "todos", rotulo: "Todas", icone: "alert", tom: "accent" },
  {
    chave: "pendentes",
    contador: "pendentes",
    status: "pendente",
    rotulo: "Pendentes",
    icone: "clock",
    tom: "yellow",
  },
  {
    chave: "julgadas",
    contador: "julgadas",
    status: "julgada",
    rotulo: "Julgadas",
    icone: "checkCircle",
    tom: "green",
  },
];

/* Status da avaliação na listagem. O rótulo vem do backend (`statusLabel`); aqui
   ficam só ícone e tom, porque cor sozinha não informa (WCAG 1.4.1). */
const APARENCIA_STATUS = {
  pendente: { tom: "warning", icone: "clock" },
  em_analise: { tom: "info", icone: "search" },
  julgada: { tom: "success", icone: "checkCircle" },
  cancelada: { tom: "", icone: "close" },
};

const OPCOES_STATUS = [
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "em_analise", rotulo: "Em análise" },
  { valor: "julgada", rotulo: "Julgada" },
  { valor: "cancelada", rotulo: "Cancelada" },
];

export default function GestaoAdmPage() {
  const [situacao, setSituacao] = useState("todas");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pagina, setPagina] = useState(0);

  // As duas caixas filtram no banco, então esperam a digitação parar.
  const buscaAtrasada = useDebounce(busca);
  const codigoAtrasado = useDebounce(codigo);

  /* O select de status é mais específico que os cards, então tem precedência:
     escolher "Em análise" com o card "Todas" ativo tem de filtrar por em_analise.
     Os cards continuam mostrando os contadores do recorte inteiro. */
  const situacaoAtual = SITUACOES.find((item) => item.chave === situacao) ?? SITUACOES[0];
  const statusEfetivo = status || situacaoAtual.status;

  const url = comFiltros("/api/contestacoes", {
    status: statusEfetivo,
    busca: buscaAtrasada,
    codigo: codigoAtrasado,
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
  });

  const { dados, carregando, erro, recarregar } = useRecurso(url);

  const contadores = dados?.contadores ?? null;
  const itens = dados?.itens ?? [];
  const total = dados?.paginacao?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const primeiraCarga = carregando && !dados;
  const temBusca = busca.trim() !== "" || codigo.trim() !== "";
  const temRecorte = temBusca || status !== "" || situacao !== "todas";

  function limparTudo() {
    setBusca("");
    setCodigo("");
    setStatus("");
    setSituacao("todas");
    setPagina(0);
  }

  return (
    <AppShell active="Contestações" breadcrumb="Contestações > Gestão ADM">
      <section className="page-header">
        <div>
          <h1>Gestão ADM</h1>
          <p>Analise e julgue as contestações abertas sobre os critérios avaliados</p>
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

      <section aria-labelledby="situacoes-contestacoes">
        <h2 className="sr-only" id="situacoes-contestacoes">
          Filtrar por situação da contestação
        </h2>

        <ul className={styles.situacoes}>
          {SITUACOES.map((item) => {
            const ativo = situacao === item.chave;
            const valor = contadores?.[item.contador];

            return (
              <li key={item.chave}>
                <button
                  className={`card ${styles.situacao}`}
                  type="button"
                  data-ativo={ativo ? "true" : "false"}
                  aria-pressed={ativo}
                  onClick={() => {
                    setSituacao(item.chave);
                    // O select de status venceria o card recém-clicado; limpá-lo
                    // faz o card significar o que promete.
                    setStatus("");
                    setPagina(0);
                  }}
                >
                  <span className={styles.situacaoTopo}>
                    <span className={styles.situacaoRotulo}>
                      <span className="icon-tile sm" data-tom={item.tom}>
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
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card pad" aria-labelledby="avaliacoes-contestadas">
        <div className={`section-head ${styles.blocoHead}`}>
          <div>
            <h2 id="avaliacoes-contestadas">Avaliações com Contestações</h2>
            <p>Cada linha é uma avaliação com um ou mais critérios questionados</p>
          </div>

          {primeiraCarga ? null : (
            <span
              className="count-badge"
              aria-label={`${total} ${total === 1 ? "avaliação" : "avaliações"} no recorte`}
            >
              {formatarNumero(total)}
            </span>
          )}
        </div>

        <div className={styles.buscas}>
          <div className="field">
            <label htmlFor="contestacoes-busca">Buscar por formulário, avaliado ou monitor</label>
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                className="input"
                id="contestacoes-busca"
                type="search"
                placeholder="Buscar por formulário, avaliado ou monitor..."
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.target.value);
                  setPagina(0);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="contestacoes-id">Buscar por ID</label>
            <input
              className="input"
              id="contestacoes-id"
              type="text"
              placeholder="Ex: QA-26-000123 ou 000123"
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value);
                setPagina(0);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="contestacoes-status">Status</label>
            <select
              className="select"
              id="contestacoes-status"
              value={status}
              onChange={(evento) => {
                setStatus(evento.target.value);
                setPagina(0);
              }}
            >
              <option value="">Todos os Status</option>
              {OPCOES_STATUS.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
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
            <EsqueletoTabela colunas={6} linhas={6} />
            <p className="sr-only" role="status">
              Carregando contestações.
            </p>
          </>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="alert" size={22} />
            </span>
            <h3>Nenhuma contestação encontrada</h3>
            <p>
              {temRecorte
                ? "Nenhuma avaliação atende ao recorte atual. Ajuste a busca, o status ou volte para “Todas”."
                : "Não há contestações abertas no momento. Elas aparecem aqui quando um operador questiona um critério avaliado."}
            </p>
            {temRecorte ? (
              <div className="btn-row">
                <button className="btn" type="button" onClick={limparTudo}>
                  <Icon name="undo" size={16} />
                  Limpar recorte
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.tabela}`}>
                <caption className="sr-only">
                  Avaliações com contestações. Exibindo {formatarNumero(itens.length)} de{" "}
                  {formatarNumero(total)} registros.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID Monitoria</th>
                    <th scope="col">Formulário</th>
                    <th scope="col">Campanha</th>
                    <th scope="col">Avaliado</th>
                    <th scope="col">Monitor</th>
                    <th className="num" scope="col">
                      Itens Contestados
                    </th>
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
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
                            <BotaoCopiar valor={item.id} rotulo="ID da monitoria" />
                          </span>
                        </th>
                        <td className={styles.celulaFormulario}>
                          <span className={styles.formularioNome}>{item.formulario}</span>
                          {/* O status da avaliação acompanha o formulário em vez
                              de virar uma oitava coluna: é qualificador, não
                              eixo de leitura. */}
                          <span className={`chip ${aparencia.tom} ${styles.statusInline}`}>
                            <Icon name={aparencia.icone} size={12} />
                            {item.statusLabel}
                          </span>
                        </td>
                        <td>{item.campanha}</td>
                        <td>{item.avaliado}</td>
                        <td>{item.avaliador}</td>
                        <td className="num">
                          <span
                            className="count-badge danger"
                            aria-label={`${item.itensContestados} ${
                              item.itensContestados === 1
                                ? "item contestado"
                                : "itens contestados"
                            }`}
                          >
                            {item.itensContestados}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="btn ghost"
                            href={`/avaliacoes/${encodeURIComponent(item.id)}`}
                            aria-label={`Analisar contestações da monitoria ${item.id}`}
                          >
                            <Icon name="search" size={15} />
                            Analisar
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
