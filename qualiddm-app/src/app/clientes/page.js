"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import { clientes, clientesKpis } from "@/data/seed";
import styles from "./page.module.css";

// 12 cartões não cabem em 900px sem rolagem; 6 cabem em duas fileiras de três.
const POR_PAGINA = 6;

/* Busca sem acento e sem caixa: quem digita "anima" precisa achar "Ânima" e
   quem digita "FIRJAN" precisa achar "FIRJAN" tanto quanto "firjan". */
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function plural(quantidade, um, varios) {
  return quantidade === 1 ? um : varios;
}

export default function ClientesPage() {
  const [lista, setLista] = useState(clientes);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [confirmando, setConfirmando] = useState(null);

  const filtrados = useMemo(() => {
    const alvo = normalizar(busca.trim());
    if (!alvo) return lista;
    return lista.filter((cliente) => normalizar(cliente.nome).includes(alvo));
  }, [lista, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  // Clampa em vez de zerar: filtrar na página 2 não pode deixar a tela vazia.
  const atual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(atual * POR_PAGINA, atual * POR_PAGINA + POR_PAGINA);

  /* "Total de Clientes" e "Clientes Ativos" saem do tamanho da lista, não do
     texto fixo do seed: os dois valem 12 na primeira renderização — o mesmo
     número do seed — e continuam corretos depois de uma exclusão. Os outros
     dois indicadores são histórico e não mudam ao remover um cartão. */
  const kpis = clientesKpis.map((kpi) =>
    kpi.id === "total" || kpi.id === "ativos" ? { ...kpi, value: String(lista.length) } : kpi
  );

  function aoBuscar(evento) {
    setBusca(evento.target.value);
    setPagina(0);
    setConfirmando(null);
  }

  function limparBusca() {
    setBusca("");
    setPagina(0);
  }

  function excluir(id) {
    setLista((atualLista) => atualLista.filter((cliente) => cliente.id !== id));
    setConfirmando(null);
  }

  return (
    <AppShell active="Clientes" breadcrumb="Operação > Clientes">
      <section className="page-header">
        <div>
          <h1>Operações</h1>
          <p>Gerencie os clientes e suas operações</p>
        </div>

        <div className="actions">
          <form
            className={`search-field ${styles.busca}`}
            role="search"
            onSubmit={(evento) => evento.preventDefault()}
          >
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="busca-clientes">
              Buscar clientes pelo nome
            </label>
            <input
              className="input"
              id="busca-clientes"
              name="cliente"
              onChange={aoBuscar}
              placeholder="Buscar clientes..."
              type="search"
              value={busca}
            />
          </form>

          <Link className="btn primary" href="/clientes/novo">
            <Icon name="plus" size={16} />
            Novo Cliente
          </Link>
        </div>
      </section>

      <div className={styles.painel}>
        <section className="grid kpi-grid" aria-label="Indicadores da carteira de clientes">
          {kpis.map((kpi) => (
            <KpiCard
              badge={kpi.badge}
              icon={kpi.icon}
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
            />
          ))}
        </section>

        <section aria-labelledby="titulo-selecionar">
          <h2 className={styles.tituloSecao} id="titulo-selecionar">
            Selecionar Cliente
          </h2>

          {visiveis.length === 0 ? (
            <div className="empty-state">
              <span className="icon-badge neutral" aria-hidden="true">
                <Icon name="search" size={20} />
              </span>
              <h3>Nenhum cliente encontrado</h3>
              <p>
                Nenhuma operação corresponde a “{busca.trim()}”. Revise o termo ou limpe a busca
                para ver os {lista.length} clientes.
              </p>
              <div className="btn-row">
                <button className="btn" onClick={limparBusca} type="button">
                  <Icon name="undo" size={16} />
                  Limpar busca
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className={styles.grade}>
                {visiveis.map((cliente) => {
                  const semFormulario = cliente.formularios === 0;

                  return (
                    <li className={`card ${styles.cartao}`} key={cliente.id}>
                      <span className="icon-badge" aria-hidden="true">
                        <Icon name="target" size={18} />
                      </span>

                      <h3 className={styles.nome}>{cliente.nome}</h3>

                      <dl className={styles.meta}>
                        <dt>Status:</dt>
                        <dd>
                          <span className="chip success">
                            <Icon name="checkCircle" size={12} />
                            {cliente.status}
                          </span>
                        </dd>

                        <dt>Formulários:</dt>
                        <dd>
                          {semFormulario ? (
                            /* Aviso compacto em vez de `.alert`: o alerta em
                               bloco tem padding de 16px e estouraria a altura
                               do cartão, que é fixa pela fileira da grade. */
                            <span className={styles.aviso}>
                              <Icon name="alert" size={13} />
                              Crie seu primeiro formulário
                            </span>
                          ) : (
                            <Link
                              className={styles.metaLink}
                              href={`/formularios?cliente=${cliente.id}`}
                            >
                              {cliente.formularios}{" "}
                              {plural(cliente.formularios, "formulário", "formulários")}
                            </Link>
                          )}
                        </dd>

                        <dt>Contrato:</dt>
                        <dd>{cliente.contrato ?? "Não definido"}</dd>
                      </dl>

                      {confirmando === cliente.id ? (
                        <div className={`${styles.acoes} ${styles.acoesConfirma}`}>
                          <span className="sr-only" role="status">
                            Confirme a exclusão do cliente {cliente.nome}.
                          </span>
                          <button
                            className="btn"
                            onClick={() => setConfirmando(null)}
                            type="button"
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => excluir(cliente.id)}
                            type="button"
                          >
                            Excluir {cliente.nome}
                          </button>
                        </div>
                      ) : (
                        <div className={styles.acoes}>
                          {semFormulario ? (
                            <Link
                              className="btn primary"
                              href={`/formularios/novo?cliente=${cliente.id}`}
                            >
                              <Icon name="plus" size={16} />
                              Criar Primeiro Formulário
                            </Link>
                          ) : (
                            <Link className="btn primary" href={`/avaliacoes?cliente=${cliente.id}`}>
                              Acessar {cliente.nome}
                            </Link>
                          )}

                          <Link
                            aria-label={`Editar cliente ${cliente.nome}`}
                            className="btn"
                            href={`/clientes/${cliente.id}/editar`}
                          >
                            <Icon name="edit" size={16} />
                            Editar
                          </Link>

                          <button
                            aria-label={`Excluir cliente ${cliente.nome}`}
                            className="btn danger icon-only"
                            onClick={() => setConfirmando(cliente.id)}
                            type="button"
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* A navegação fica sempre montada, com botões desabilitados
                  quando só há uma página: é ela que anuncia a contagem depois
                  de filtrar ou excluir, e sumir mudaria a altura da tela. */}
              <nav className="pagination" aria-label="Paginação de clientes">
                <button
                  className="btn ghost"
                  disabled={atual === 0}
                  onClick={() => setPagina(atual - 1)}
                  type="button"
                >
                  <Icon name="chevronLeft" size={16} />
                  Anterior
                </button>

                <span aria-live="polite">
                  Página {atual + 1} de {totalPaginas} · {filtrados.length}{" "}
                  {plural(filtrados.length, "cliente", "clientes")}
                </span>

                <button
                  className="btn ghost"
                  disabled={atual >= totalPaginas - 1}
                  onClick={() => setPagina(atual + 1)}
                  type="button"
                >
                  Próxima
                  <Icon name="chevronRight" size={16} />
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
