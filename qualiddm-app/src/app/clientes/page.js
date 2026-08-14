"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

const POR_PAGINA = 6;

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function plural(quantidade, um, varios) {
  return quantidade === 1 ? um : varios;
}

async function lerRespostaApi(resposta) {
  const payload = await resposta.json().catch(() => null);
  if (!resposta.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.");
  }
  return payload.data;
}

export default function ClientesPage() {
  const [lista, setLista] = useState([]);
  const [kpisBanco, setKpisBanco] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState("claro");
  const [menuTemaAberto, setMenuTemaAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [novoCliente, setNovoCliente] = useState({ nome: "", status: "Ativo", contrato: "" });
  const [pagina, setPagina] = useState(0);
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarClientes() {
      try {
        const resposta = await fetch("/api/clientes", { cache: "no-store" });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar clientes do banco.");
        }
        if (ativo) {
          setLista(payload.data.clientes);
          setKpisBanco(payload.data.kpis);
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setLista([]);
          setKpisBanco(null);
          setErro(error.message);
        }
      }
    }

    carregarClientes();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  const filtrados = useMemo(() => {
    const alvo = normalizar(busca.trim());
    if (!alvo) return lista;
    return lista.filter((cliente) => normalizar(cliente.nome).includes(alvo));
  }, [lista, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(atual * POR_PAGINA, atual * POR_PAGINA + POR_PAGINA);

  const kpis = [
    {
      id: "total",
      badge: "Total",
      value: String(kpisBanco?.total ?? lista.length),
      label: "Total de Clientes",
      icon: "wallet",
    },
    {
      id: "ativos",
      badge: "Ativos",
      value: String(kpisBanco?.ativos ?? lista.filter((cliente) => cliente.status === "Ativa").length),
      label: "Clientes Ativos",
      icon: "checkCircle",
    },
    {
      id: "monitorias",
      badge: "Monitorias",
      value: String(kpisBanco?.monitorias ?? lista.reduce((total, cliente) => total + Number(cliente.monitorias ?? 0), 0)),
      label: "Monitorias Realizadas (Total)",
      icon: "checklist",
    },
    {
      id: "score",
      badge: "Score",
      value: Number(kpisBanco?.scoreMedio ?? 0).toFixed(1),
      label: "Nota de Qualidade (Score)",
      icon: "gauge",
    },
  ];

  function aoBuscar(evento) {
    setBusca(evento.target.value);
    setPagina(0);
    setConfirmando(null);
  }

  function limparBusca() {
    setBusca("");
    setPagina(0);
  }

  function aplicarResumoClientes(data) {
    setLista(data.clientes);
    setKpisBanco(data.kpis);
    setErro("");
  }

  async function excluir(id) {
    try {
      const data = await lerRespostaApi(
        await fetch(`/api/clientes/${encodeURIComponent(id)}`, { method: "DELETE" }),
      );
      aplicarResumoClientes(data);
    } catch (error) {
      setErro(error.message);
    }
    setConfirmando(null);
  }

  function formatarContrato(data) {
    if (!data) return null;
    const [ano, mes, dia] = data.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  }

  function dataParaInput(data) {
    if (!data || data === "Não definido") return "";
    const partes = String(data).split("/");
    if (partes.length !== 3) return "";
    const [dia, mes, ano] = partes;
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  async function adicionarCliente(evento) {
    evento.preventDefault();
    const nome = novoCliente.nome.trim();
    if (!nome) return;

    try {
      const data = await lerRespostaApi(
        await fetch("/api/clientes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome,
            status: novoCliente.status,
            contrato: formatarContrato(novoCliente.contrato),
          }),
        }),
      );
      aplicarResumoClientes(data);
      setNovoCliente({ nome: "", status: "Ativo", contrato: "" });
      setModalAberto(false);
      setPagina(0);
    } catch (error) {
      setErro(error.message);
    }
  }

  function abrirEdicao(cliente) {
    setClienteEditando({
      id: cliente.id,
      nome: cliente.nome,
      status: cliente.status === "Ativa" ? "Ativo" : "Inativo",
      contrato: dataParaInput(cliente.contrato),
    });
    setConfirmando(null);
  }

  async function salvarEdicao(evento) {
    evento.preventDefault();
    const nome = clienteEditando?.nome?.trim();
    if (!clienteEditando || !nome) return;

    try {
      const data = await lerRespostaApi(
        await fetch(`/api/clientes/${encodeURIComponent(clienteEditando.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome,
            status: clienteEditando.status,
            contrato: formatarContrato(clienteEditando.contrato),
          }),
        }),
      );
      aplicarResumoClientes(data);
      setClienteEditando(null);
    } catch (error) {
      setErro(error.message);
    }
  }

  function selecionarTema(proximoTema) {
    setTema(proximoTema);
    setMenuTemaAberto(false);
  }

  const acoesTopo = (
    <>
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

      <div className={styles.tema}>
        <button
          className="btn icon-only"
          type="button"
          aria-expanded={menuTemaAberto}
          aria-haspopup="menu"
          onClick={() => setMenuTemaAberto((aberto) => !aberto)}
        >
          <Icon name={tema === "claro" ? "sun" : "moon"} size={16} />
          <span className="sr-only">Selecionar tema</span>
        </button>

        {menuTemaAberto ? (
          <div className={styles.menuTema} role="menu">
            <button className={styles.temaItem} type="button" role="menuitem" onClick={() => selecionarTema("claro")}>
              <Icon name="sun" size={18} />
              <span>
                <strong>Modo Claro</strong>
                <small>Interface clara e limpa</small>
              </span>
              {tema === "claro" ? <span className={styles.ponto} aria-hidden="true" /> : null}
            </button>
            <button className={styles.temaItem} type="button" role="menuitem" onClick={() => selecionarTema("escuro")}>
              <Icon name="moon" size={18} />
              <span>
                <strong>Modo Escuro</strong>
                <small>Interface escura para os olhos</small>
              </span>
              {tema === "escuro" ? <span className={styles.ponto} aria-hidden="true" /> : null}
            </button>
          </div>
        ) : null}
      </div>

      <button className="btn primary" type="button" onClick={() => setModalAberto(true)}>
        <Icon name="plus" size={16} />
        Novo Cliente
      </button>
    </>
  );

  return (
    <AppShell active="Clientes" breadcrumb="Operação > Clientes" topbarActions={acoesTopo}>
      <section className="page-header">
        <div>
          <h1>Operações</h1>
          <p>Gerencie os clientes e suas operações</p>
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

          {erro ? (
            <div className="empty-state">
              <span className="icon-badge neutral" aria-hidden="true">
                <Icon name="error" size={20} />
              </span>
              <h3>Não foi possível carregar clientes</h3>
              <p>{erro}</p>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="empty-state">
              <span className="icon-badge neutral" aria-hidden="true">
                <Icon name="search" size={20} />
              </span>
              <h3>Nenhum cliente encontrado</h3>
              <p>
                Nenhuma operação corresponde a “{busca.trim()}”. Revise o termo ou limpe a busca para ver os{" "}
                {lista.length} clientes.
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
                          <span className={cliente.status === "Ativa" ? "chip success" : "chip neutral"}>
                            <Icon name={cliente.status === "Ativa" ? "checkCircle" : "info"} size={12} />
                            {cliente.status}
                          </span>
                        </dd>

                        <dt>Formulários:</dt>
                        <dd>
                          {semFormulario ? (
                            <span className={styles.aviso}>
                              <Icon name="alert" size={13} />
                              Crie seu primeiro formulário
                            </span>
                          ) : (
                            <Link className={styles.metaLink} href={`/formularios?cliente=${cliente.id}`}>
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
                          <button className="btn" onClick={() => setConfirmando(null)} type="button">
                            Cancelar
                          </button>
                          <button className="btn danger" onClick={() => excluir(cliente.id)} type="button">
                            Excluir {cliente.nome}
                          </button>
                        </div>
                      ) : (
                        <div className={styles.acoes}>
                          {semFormulario ? (
                            <Link className="btn primary" href={`/formularios/novo?cliente=${cliente.id}`}>
                              <Icon name="plus" size={16} />
                              Criar Primeiro Formulário
                            </Link>
                          ) : (
                            <Link className="btn primary" href={`/avaliacoes?cliente=${cliente.id}`}>
                              Acessar {cliente.nome}
                            </Link>
                          )}

                          <button
                            aria-label={`Editar cliente ${cliente.nome}`}
                            className="btn"
                            onClick={() => abrirEdicao(cliente)}
                            type="button"
                          >
                            <Icon name="edit" size={16} />
                            Editar
                          </button>

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

      {modalAberto ? (
        <div className={styles.modalFundo} role="presentation">
          <form className={styles.modal} onSubmit={adicionarCliente}>
            <div className={styles.modalTopo}>
              <h2>Novo Cliente</h2>
              <button className="btn ghost icon-only" type="button" onClick={() => setModalAberto(false)}>
                <Icon name="close" size={16} label="Fechar" />
              </button>
            </div>

            <div className="field">
              <label htmlFor="novo-cliente-nome">Nome do Cliente</label>
              <input
                className="input"
                id="novo-cliente-nome"
                placeholder="Ex: Claro, Vivo, Quinto Andar..."
                value={novoCliente.nome}
                onChange={(evento) => setNovoCliente((atual) => ({ ...atual, nome: evento.target.value }))}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="novo-cliente-status">Status</label>
              <select
                className={`select ${styles.statusSelect}`}
                id="novo-cliente-status"
                value={novoCliente.status}
                onChange={(evento) => setNovoCliente((atual) => ({ ...atual, status: evento.target.value }))}
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="novo-cliente-contrato">Data do Contrato (opcional)</label>
              <input
                className="input"
                id="novo-cliente-contrato"
                type="date"
                value={novoCliente.contrato}
                onChange={(evento) => setNovoCliente((atual) => ({ ...atual, contrato: evento.target.value }))}
              />
            </div>

            <div className={styles.modalAcoes}>
              <button className="btn" type="button" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit">
                Adicionar Cliente
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {clienteEditando ? (
        <div className={styles.modalFundo} role="presentation">
          <form className={styles.modal} onSubmit={salvarEdicao}>
            <div className={styles.modalTopo}>
              <h2>Editar Cliente</h2>
              <button className="btn ghost icon-only" type="button" onClick={() => setClienteEditando(null)}>
                <Icon name="close" size={16} label="Fechar" />
              </button>
            </div>

            <div className="field">
              <label htmlFor="editar-cliente-nome">Nome do Cliente</label>
              <input
                className="input"
                id="editar-cliente-nome"
                value={clienteEditando.nome}
                onChange={(evento) => setClienteEditando((atual) => ({ ...atual, nome: evento.target.value }))}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="editar-cliente-status">Status</label>
              <select
                className={`select ${styles.statusSelect}`}
                id="editar-cliente-status"
                value={clienteEditando.status}
                onChange={(evento) => setClienteEditando((atual) => ({ ...atual, status: evento.target.value }))}
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="editar-cliente-contrato">Data do Contrato (opcional)</label>
              <input
                className="input"
                id="editar-cliente-contrato"
                type="date"
                value={clienteEditando.contrato}
                onChange={(evento) => setClienteEditando((atual) => ({ ...atual, contrato: evento.target.value }))}
              />
            </div>

            <div className={styles.modalAcoes}>
              <button className="btn" type="button" onClick={() => setClienteEditando(null)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit">
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
