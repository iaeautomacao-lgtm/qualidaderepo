"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import SelectBusca from "@/components/SelectBusca";
import { Icon } from "@/components/icons";
import {
  STATUS_PENDENTE,
  avaliacoes,
  tomDoScore,

} from "@/data/avaliacoes";
import { avaliadores, avaliados, campanhas, categorias, clientes } from "@/data/seed";
import styles from "./page.module.css";

const TODAS = "todas";
const POR_PAGINA = 6;

const FILTROS_INICIAIS = {
  operacao: TODAS,
  campanha: TODAS,
  avaliador: TODAS,
  avaliado: TODAS,
  categoria: TODAS,
  de: "",
  ate: "",
};

/** Monta as opções com a entrada "todas/todos" sempre em primeiro lugar. */
function comOpcaoTodas(rotuloTodas, itens) {
  return [
    { value: TODAS, label: rotuloTodas },
    ...itens.map((item) => ({ value: item, label: item })),
  ];
}

const OPCOES = {
  operacao: comOpcaoTodas(
    "Todas as Operações",
    clientes.map((cliente) => cliente.nome),
  ),
  campanha: comOpcaoTodas(
    "Todas as Campanhas",
    campanhas.map((campanha) => campanha.nome),
  ),
  avaliador: comOpcaoTodas("Todos os Avaliadores", avaliadores),
  avaliado: comOpcaoTodas("Todos os Avaliados", avaliados),
  categoria: comOpcaoTodas("Todas as Categorias", categorias),
};

export default function AvaliacoesPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(
    () =>
      avaliacoes.filter((item) => {
        if (filtros.operacao !== TODAS && item.cliente !== filtros.operacao) return false;
        if (filtros.campanha !== TODAS && item.campanha !== filtros.campanha) return false;
        if (filtros.avaliador !== TODAS && item.avaliador !== filtros.avaliador) return false;
        if (filtros.avaliado !== TODAS && item.avaliado !== filtros.avaliado) return false;
        if (filtros.categoria !== TODAS && item.categoria !== filtros.categoria) return false;
        // Datas em ISO comparam como texto, sem converter nada a cada tecla.
        if (filtros.de && item.data < filtros.de) return false;
        if (filtros.ate && item.data > filtros.ate) return false;
        return true;
      }),
    [filtros],
  );

  const temFiltro = useMemo(
    () => Object.keys(FILTROS_INICIAIS).some((chave) => filtros[chave] !== FILTROS_INICIAIS[chave]),
    [filtros],
  );

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);

  // Trocar filtro sempre volta para a primeira página: manter a página 2 depois
  // de reduzir o resultado deixaria a tela vazia sem motivo aparente.
  function alterarFiltro(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
    setPagina(0);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setPagina(0);
  }

  return (
    <AppShell active="Dashboard" breadcrumb="Avaliações">
      <div className={styles.tela}>
        <header className="page-header">
          <div>
            <h1>Avaliações</h1>
            <p>Refine os resultados conforme necessário</p>
          </div>

          {/* O contador é o retorno imediato do filtro: muda a cada seleção e é
              anunciado por aria-live para quem não vê a lista mudar. */}
          <p className={styles.contador} aria-live="polite">
            <strong className={styles.contadorValor}>{filtradas.length}</strong>
            <span className={styles.contadorRotulo}>Total de Avaliações</span>
            <span className={styles.contadorNota}>
              {temFiltro
                ? `Filtrado de ${avaliacoes.length} avaliação(ões) cadastrada(s)`
                : "Somente avaliações reais cadastradas"}
            </span>
          </p>
        </header>

        <section className={`card ${styles.painel}`} aria-labelledby="filtros-titulo">
          <div className={styles.painelHead}>
            <span className="icon-badge sm" aria-hidden="true">
              <Icon name="filter" size={16} />
            </span>
            <h2 id="filtros-titulo">Filtros de Avaliação</h2>
            {temFiltro ? (
              <button className={`btn ghost ${styles.limpar}`} type="button" onClick={limparFiltros}>
                <Icon name="undo" size={16} />
                Limpar filtros
              </button>
            ) : null}
          </div>

          <div className={styles.grade}>
            <div className="field">
              <label htmlFor="filtro-operacao">Operação</label>
              <select
                className="select"
                id="filtro-operacao"
                value={filtros.operacao}
                onChange={(evento) => alterarFiltro("operacao", evento.target.value)}
              >
                {OPCOES.operacao.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 26 campanhas e 104 avaliados: lista longa demais para um select
                nativo, então estes dois filtram enquanto o usuário digita. */}
            <SelectBusca
              id="filtro-campanha"
              label="Campanha"
              options={OPCOES.campanha}
              value={filtros.campanha}
              onChange={(valor) => alterarFiltro("campanha", valor)}
            />

            <div className="field">
              <label htmlFor="filtro-avaliador">Avaliador</label>
              <select
                className="select"
                id="filtro-avaliador"
                value={filtros.avaliador}
                onChange={(evento) => alterarFiltro("avaliador", evento.target.value)}
              >
                {OPCOES.avaliador.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>

            <SelectBusca
              id="filtro-avaliado"
              label="Avaliado"
              options={OPCOES.avaliado}
              value={filtros.avaliado}
              onChange={(valor) => alterarFiltro("avaliado", valor)}
            />

            <div className="field">
              <label htmlFor="filtro-categoria">Categoria</label>
              <select
                className="select"
                id="filtro-categoria"
                value={filtros.categoria}
                onChange={(evento) => alterarFiltro("categoria", evento.target.value)}
              >
                {OPCOES.categoria.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Os dois campos de data só fazem sentido juntos: o fieldset dá o
                agrupamento também para o leitor de tela, e os rótulos de cada
                campo ficam em sr-only porque a ordem visual (início, fim) e o
                formato dd/mm/aaaa do campo nativo já dizem o que é cada um —
                repeti-los na tela custaria uma linha inteira de altura. */}
            <fieldset className={styles.periodo}>
              <legend>Período</legend>
              <label className="sr-only" htmlFor="filtro-de">
                Data inicial do período
              </label>
              <input
                className="input"
                id="filtro-de"
                max={filtros.ate || undefined}
                onChange={(evento) => alterarFiltro("de", evento.target.value)}
                type="date"
                value={filtros.de}
              />
              <label className="sr-only" htmlFor="filtro-ate">
                Data final do período
              </label>
              <input
                className="input"
                id="filtro-ate"
                min={filtros.de || undefined}
                onChange={(evento) => alterarFiltro("ate", evento.target.value)}
                type="date"
                value={filtros.ate}
              />
            </fieldset>
          </div>
        </section>

        <section className={styles.resultado} aria-labelledby="resultado-titulo">
          <h2 className="sr-only" id="resultado-titulo">
            Resultado da busca
          </h2>

          {visiveis.length === 0 ? (
            <div className="empty-state">
              <span className="icon-badge neutral" aria-hidden="true">
                <Icon name="filter" size={18} />
              </span>
              <h3>Nenhuma avaliação encontrada</h3>
              <p>
                Nenhuma avaliação da amostra atende à combinação de filtros selecionada. Ajuste os
                filtros ou limpe a seleção para ver a lista completa.
              </p>
              <div className="btn-row">
                <button className="btn primary" type="button" onClick={limparFiltros}>
                  <Icon name="undo" size={16} />
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : (
            <ul className={styles.cards}>
              {visiveis.map((item) => {
                const pendente = item.statusFeedback === STATUS_PENDENTE;

                return (
                  <li className={`card ${styles.item}`} key={item.id}>
                    <div className={styles.itemTopo}>
                      <span className="icon-badge sm" aria-hidden="true">
                        <Icon name="review" size={16} />
                      </span>

                      <div className={styles.itemIdent}>
                        <h3 className={styles.itemTitulo}>
                          {/* Link "esticado" pelo ::after: o cartão inteiro é
                              clicável, mas o nome acessível do link continua
                              curto e único (formulário + ID). */}
                          <Link className={styles.itemLink} href={`/avaliacoes/${item.id}`}>
                            {item.formulario}
                            <span className="sr-only"> — avaliação {item.id}</span>
                          </Link>
                        </h3>
                        <p className={styles.itemId}>{item.id}</p>
                      </div>

                      <span className={styles.itemScore}>
                        <span className="label-micro">Score</span>
                        <span className={`score ${tomDoScore(item.score)}`}>{item.score}</span>
                      </span>
                    </div>

                    <dl className={styles.itemDados}>
                      <div>
                        <dt>Avaliado</dt>
                        <dd>{item.avaliado}</dd>
                      </div>
                      <div>
                        <dt>Monitor</dt>
                        <dd>{item.avaliador}</dd>
                      </div>
                      <div>
                        <dt>Campanha</dt>
                        <dd>{item.campanha}</dd>
                      </div>
                    </dl>

                    <div className={styles.itemRodape}>
                      <span className={`chip ${pendente ? "warning" : "success"}`}>
                        <Icon name={pendente ? "clock" : "checkCircle"} size={13} />
                        {item.statusFeedback}
                      </span>
                      <span className={styles.itemData}>
                        <Icon name="calendar" size={13} />
                        {item.dataFormatada}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {paginas > 1 ? (
          <nav className="pagination" aria-label="Paginação das avaliações">
            <button
              className="btn ghost"
              disabled={paginaAtual === 0}
              onClick={() => setPagina(paginaAtual - 1)}
              type="button"
            >
              <Icon name="chevronLeft" size={16} />
              Anterior
            </button>

            <span aria-live="polite">
              Página {paginaAtual + 1} de {paginas}
              <span className="sr-only"> — {filtradas.length} avaliações no total</span>
            </span>

            <button
              className="btn ghost"
              disabled={paginaAtual >= paginas - 1}
              onClick={() => setPagina(paginaAtual + 1)}
              type="button"
            >
              Próxima
              <Icon name="chevronRight" size={16} />
            </button>
          </nav>
        ) : null}
      </div>
    </AppShell>
  );
}
