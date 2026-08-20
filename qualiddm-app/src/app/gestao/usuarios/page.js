"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros, enviarApi } from "@/lib/api";
import { formatarNumero, SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const SITUACOES = [
  { id: "todos", rotulo: "Todos" },
  { id: "ativo", rotulo: "Ativo" },
  { id: "inativo", rotulo: "Inativo" },
];

const CARGOS_RAPIDOS = [
  "Operador",
  "Administrador",
  "Cliente",
  "Coordenador",
  "Gerente",
  "Jovem Aprendiz",
  "Monitor",
  "Monitor Feedback",
  "Monitor Full",
  "Planejamento DDM",
  "Supervisor",
];

function iniciais(nome) {
  return String(nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function baixarCsv(itens) {
  const colunas = [
    "Nome",
    "E-mail",
    "Login",
    "CPF",
    "Papel",
    "Cargo",
    "Status",
    "Matricula",
    "Turno",
    "Superior",
    "Carteira",
    "Campanhas",
  ];
  const linhas = itens.map((item) => [
    item.nome,
    item.email,
    item.login ?? "",
    item.cpf ?? "",
    item.papelLabel,
    item.cargo ?? "",
    item.ativo ? "Ativo" : "Inativo",
    item.matricula ?? "",
    item.turno ?? "",
    item.supervisor ?? "",
    item.cliente ?? "",
    item.campanhas.join(", "),
  ]);
  const escapar = (valor) => {
    const texto = String(valor ?? "");
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const conteudo = [colunas, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${conteudo}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "usuarios-qualiddm.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function GestaoUsuariosPage() {
  const [visao, setVisao] = useState("cards");
  const [busca, setBusca] = useState("");
  const [cargoNome, setCargoNome] = useState("");
  const [papel, setPapel] = useState("todos");
  const [situacao, setSituacao] = useState("todos");
  const [matrizAberta, setMatrizAberta] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(null);
  const [modalCampanhas, setModalCampanhas] = useState(null);
  const [modalHistorico, setModalHistorico] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [credencial, setCredencial] = useState(null);

  const buscaAtrasada = useDebounce(busca);
  const url = comFiltros("/api/usuarios", { busca: buscaAtrasada, papel, situacao });
  const { dados, carregando, erro, recarregar, definir } = useRecurso(url);
  const matriz = useRecurso(matrizAberta ? "/api/usuarios/permissoes" : null);

  const itens = useMemo(() => dados?.itens ?? [], [dados?.itens]);
  const opcoes = dados?.opcoes ?? { cargos: [], papeis: [], clientes: [], campanhas: [], turnos: [], supervisores: [] };
  const primeiraCarga = carregando && !dados;
  const filtrados = useMemo(() => {
    if (!cargoNome) return itens;
    return itens.filter((item) => item.cargo === cargoNome || item.papelLabel === cargoNome);
  }, [cargoNome, itens]);

  async function salvarUsuario(form) {
    setErroAcao("");
    setCredencial(null);
    try {
      const resposta = form.id
        ? await enviarApi(`/api/usuarios/${encodeURIComponent(form.id)}`, form, { metodo: "PATCH" })
        : await enviarApi("/api/usuarios", form);
      definir(resposta);
      if (resposta.senhaProvisoria) setCredencial(resposta);
      setModalUsuario(null);
    } catch (causa) {
      setErroAcao(causa.message);
    }
  }

  async function salvarCampanhas(usuario, campanhaIds) {
    setErroAcao("");
    try {
      definir(
        await enviarApi(
          `/api/usuarios/${encodeURIComponent(usuario.id)}/campanhas`,
          { campanhaIds },
          { metodo: "PATCH" },
        ),
      );
      setModalCampanhas(null);
    } catch (causa) {
      setErroAcao(causa.message);
    }
  }

  async function resetarSenha(usuario) {
    setErroAcao("");
    setCredencial(null);
    setOcupado(usuario.id);
    try {
      setCredencial(await enviarApi(`/api/usuarios/${encodeURIComponent(usuario.id)}/senha`, {}));
    } catch (causa) {
      setErroAcao(`${usuario.nome}: ${causa.message}`);
    } finally {
      setOcupado("");
    }
  }

  async function alternarAtivo(usuario) {
    setErroAcao("");
    setOcupado(usuario.id);
    try {
      definir(
        await enviarApi(
          `/api/usuarios/${encodeURIComponent(usuario.id)}`,
          { ativo: !usuario.ativo },
          { metodo: "PATCH" },
        ),
      );
    } catch (causa) {
      setErroAcao(`${usuario.nome}: ${causa.message}`);
    } finally {
      setOcupado("");
    }
  }

  return (
    <AppShell active="Gestão" breadcrumb="Administração > Usuários">
      <section className="page-header">
        <div className={styles.headerTitle}>
          <Link className="btn" href="/gestao">
            <Icon name="chevronLeft" size={16} />
            Voltar
          </Link>
          <span className="icon-badge">
            <Icon name="users" size={20} />
          </span>
          <div>
            <h1>Gestão de Usuários</h1>
            <p>Usuários, operadores, supervisores, turnos e escopo por campanha</p>
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" aria-pressed={visao === "lista"} onClick={() => setVisao("lista")}>
            <Icon name="checklist" size={16} />
            Lista
          </button>
          <button className="btn" type="button" aria-pressed={visao === "cards"} onClick={() => setVisao("cards")}>
            <Icon name="layers" size={16} />
            Cards
          </button>
          <button className="btn" type="button" onClick={() => setMatrizAberta((aberta) => !aberta)}>
            <Icon name="shield" size={16} />
            Ver Matriz de Permissões
          </button>
          <button className="btn" type="button" disabled={itens.length === 0} onClick={() => baixarCsv(itens)}>
            <Icon name="download" size={16} />
            Exportar
          </button>
          <button className="btn" type="button" disabled title="Em breve">
            <Icon name="key" size={16} />
            Resetar senha em massa
          </button>
          <button className="btn" type="button" disabled title="Em breve">
            <Icon name="upload" size={16} />
            Importar Usuários
          </button>
          <button className="btn primary" type="button" onClick={() => setModalUsuario({})}>
            <Icon name="plus" size={16} />
            Novo Usuário
          </button>
        </div>
      </section>

      {credencial ? (
        <p className="alert success">
          <Icon name="key" size={16} />
          <span className="alert-body">
            <strong>Senha provisória</strong>
            <span>
              {credencial.email} · <code className={styles.senha}>{credencial.senhaProvisoria}</code>
            </span>
          </span>
        </p>
      ) : null}

      {erroAcao ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível concluir</strong>
            <span>{erroAcao}</span>
          </span>
        </p>
      ) : null}

      <section className={`card pad ${styles.filtros}`}>
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            className="input"
            type="search"
            placeholder="Buscar por nome, login, matrícula, código..."
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
        <div className={styles.chips}>
          <span className={styles.rotuloFiltro}>Cargo</span>
          <button className="btn" type="button" aria-pressed={!cargoNome} onClick={() => setCargoNome("")}>
            Todos
          </button>
          {CARGOS_RAPIDOS.map((cargo) => (
            <button
              key={cargo}
              className="btn"
              type="button"
              aria-pressed={cargoNome === cargo}
              onClick={() => setCargoNome(cargo)}
            >
              {cargo}
            </button>
          ))}
        </div>
        <div className={styles.chips}>
          {SITUACOES.map((item) => (
            <button key={item.id} className="btn" type="button" aria-pressed={situacao === item.id} onClick={() => setSituacao(item.id)}>
              {item.rotulo}
            </button>
          ))}
        </div>
        <p className={styles.resumo}>
          {formatarNumero(filtrados.length)} usuário(s) · {formatarNumero(dados?.contadores?.ativos ?? 0)} ativo(s)
        </p>
      </section>

      {matrizAberta ? <MatrizPermissoes recurso={matriz} /> : null}

      <section className="card pad">
        <div className="section-head">
          <div>
            <h2>Usuários</h2>
            <p>{primeiraCarga ? "Carregando..." : `${formatarNumero(filtrados.length)} no recorte atual`}</p>
          </div>
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar usuários</h3>
            <p>{erro}</p>
          </div>
        ) : primeiraCarga ? (
          <EsqueletoTabela colunas={7} linhas={8} />
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="users" size={22} />
            </span>
            <h3>Nenhum usuário encontrado</h3>
            <p>Ajuste a busca ou importe a planilha de usuários.</p>
          </div>
        ) : visao === "cards" ? (
          <ul className={styles.cards}>
            {filtrados.map((item) => (
              <UsuarioCard
                key={item.id}
                item={item}
                ocupado={ocupado === item.id}
                onEditar={() => setModalUsuario(item)}
                onCampanhas={() => setModalCampanhas(item)}
                onHistorico={() => setModalHistorico(item)}
                onReset={() => resetarSenha(item)}
                onAlternar={() => alternarAtivo(item)}
              />
            ))}
          </ul>
        ) : (
          <TabelaUsuarios
            itens={filtrados}
            ocupado={ocupado}
            onEditar={setModalUsuario}
            onCampanhas={setModalCampanhas}
            onHistorico={setModalHistorico}
            onReset={resetarSenha}
            onAlternar={alternarAtivo}
          />
        )}
      </section>

      {modalUsuario ? (
        <UsuarioModal
          usuario={modalUsuario}
          opcoes={opcoes}
          onClose={() => setModalUsuario(null)}
          onSalvar={salvarUsuario}
        />
      ) : null}

      {modalCampanhas ? (
        <CampanhasModal
          usuario={modalCampanhas}
          campanhas={opcoes.campanhas}
          onClose={() => setModalCampanhas(null)}
          onSalvar={(ids) => salvarCampanhas(modalCampanhas, ids)}
        />
      ) : null}

      {modalHistorico ? <HistoricoModal usuario={modalHistorico} onClose={() => setModalHistorico(null)} /> : null}
    </AppShell>
  );
}

function UsuarioCard({ item, ocupado, onEditar, onCampanhas, onHistorico, onReset, onAlternar }) {
  return (
    <li className={styles.cardUsuario} data-inativo={!item.ativo}>
      <div className={styles.cardTopo}>
        <span className={styles.avatar}>{iniciais(item.nome)}</span>
        <div>
          <strong>{item.nome}</strong>
          <span className={`chip ${item.ativo ? "success" : "danger"}`}>{item.ativo ? "Ativo" : "Inativo"}</span>
          <span className="chip">{item.cargo || item.papelLabel}</span>
          {item.matricula ? <span className={styles.matricula}>#{item.matricula}</span> : null}
        </div>
      </div>
      <div className={styles.identidade}>
        <span>
          <small>E-mail</small>
          {item.email}
        </span>
        <span>
          <small>Login</small>
          {item.login ?? SEM_VALOR}
        </span>
      </div>
      <dl className={styles.metaGrid}>
        <div>
          <dt>Superior</dt>
          <dd>{item.supervisor ?? SEM_VALOR}</dd>
        </div>
        <div>
          <dt>Turno</dt>
          <dd>{item.turno ?? SEM_VALOR}</dd>
        </div>
        <div>
          <dt>Escopo</dt>
          <dd>{formatarNumero(item.totalCampanhas)} campanha(s)</dd>
        </div>
        <div>
          <dt>Carteira</dt>
          <dd>{item.cliente ?? SEM_VALOR}</dd>
        </div>
      </dl>
      <div className={styles.campanhas}>
        {item.campanhas.slice(0, 3).map((campanha) => (
          <span key={campanha} className="chip info">
            {campanha}
          </span>
        ))}
        {item.campanhas.length > 3 ? <span className="chip">+{item.campanhas.length - 3}</span> : null}
      </div>
      <div className={styles.acoesCard}>
        <button className="btn primary" type="button" onClick={onEditar}>
          <Icon name="settings" size={15} />
          Editar
        </button>
        <button className="btn accent" type="button" onClick={onCampanhas}>
          <Icon name="target" size={15} />
          Camp.
        </button>
        <button className="btn" type="button" onClick={onHistorico}>
          <Icon name="history" size={15} />
          Hist.
        </button>
        <button className="btn warning" type="button" disabled={ocupado} onClick={onReset}>
          <Icon name={ocupado ? "spinner" : "key"} size={15} />
          Reset
        </button>
        <button className="btn danger" type="button" disabled={ocupado} onClick={onAlternar}>
          <Icon name={item.ativo ? "close" : "check"} size={15} />
          {item.ativo ? "Del." : "Ativ."}
        </button>
      </div>
    </li>
  );
}

function TabelaUsuarios({ itens, ocupado, onEditar, onCampanhas, onHistorico, onReset, onAlternar }) {
  return (
    <div className="table-block">
      <div className="table-scroll">
        <table className={`data-table branded ${styles.tabela}`}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Cargo</th>
              <th>Supervisor</th>
              <th>Turno</th>
              <th>Escopo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                  <small>{item.email}</small>
                  <small>{item.login ?? SEM_VALOR}</small>
                </td>
                <td>{item.cargo || item.papelLabel}</td>
                <td>{item.supervisor ?? SEM_VALOR}</td>
                <td>{item.turno ?? SEM_VALOR}</td>
                <td>{formatarNumero(item.totalCampanhas)} campanha(s)</td>
                <td>
                  <span className={`chip ${item.ativo ? "success" : "danger"}`}>{item.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td>
                  <div className={styles.acoesTabela}>
                    <button className="btn ghost" type="button" onClick={() => onEditar(item)}>Editar</button>
                    <button className="btn ghost" type="button" onClick={() => onCampanhas(item)}>Camp.</button>
                    <button className="btn ghost" type="button" onClick={() => onHistorico(item)}>Hist.</button>
                    <button className="btn ghost" type="button" disabled={ocupado === item.id} onClick={() => onReset(item)}>Reset</button>
                    <button className="btn ghost danger" type="button" disabled={ocupado === item.id} onClick={() => onAlternar(item)}>
                      {item.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsuarioModal({ usuario, opcoes, onClose, onSalvar }) {
  const [form, setForm] = useState({
    id: usuario.id,
    nome: usuario.nome ?? "",
    email: usuario.email ?? "",
    cpf: usuario.cpf ?? "",
    papel: usuario.papel ?? "operador",
    cargoId: usuario.cargoId ?? "",
    ativo: usuario.ativo ?? true,
    matricula: usuario.matricula ?? "",
    login: usuario.login ?? "",
    turnoId: usuario.turnoId ?? "",
    clienteId: usuario.clienteId ?? "",
    supervisorId: usuario.supervisorId ?? "",
    dataInicioProduto: usuario.dataInicioProduto ?? "",
    hierarquiaVigencia: usuario.hierarquiaVigencia ?? "",
    hierarquiaMotivo: usuario.hierarquiaMotivo ?? "Criação ou atualização do usuário com vínculo hierárquico",
  });
  const setCampo = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const editando = Boolean(usuario.id);
  const podeSalvar = form.nome.trim().length >= 2;

  return (
    <div className={styles.backdrop}>
      <form
        className={`card pad ${styles.modalUsuario}`}
        onSubmit={(evento) => {
          evento.preventDefault();
          onSalvar(form);
        }}
      >
        <div className="section-head">
          <div>
            <h2>{editando ? "Editar Usuário" : "Novo Usuário"}</h2>
            <p>Cadastro usado para login, escopo de avaliação e hierarquia operacional.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className={styles.formUsuario}>
          <label className="field">
            <span>Nome *</span>
            <input className="input" value={form.nome} onChange={(evento) => setCampo("nome", evento.target.value)} />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input className="input" type="email" value={form.email} onChange={(evento) => setCampo("email", evento.target.value)} />
          </label>
          <label className="field">
            <span>CPF</span>
            <input className="input" value={form.cpf} onChange={(evento) => setCampo("cpf", evento.target.value)} />
          </label>
          <label className="field">
            <span>Login</span>
            <input className="input" value={form.login} onChange={(evento) => setCampo("login", evento.target.value)} />
          </label>
          <label className="field">
            <span>Cargo *</span>
            <select className="select" value={form.cargoId} onChange={(evento) => setCampo("cargoId", evento.target.value)}>
              <option value="">Sem cargo</option>
              {opcoes.cargos.map((cargo) => (
                <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Papel de acesso *</span>
            <select className="select" value={form.papel} onChange={(evento) => setCampo("papel", evento.target.value)}>
              {opcoes.papeis.map((papel) => (
                <option key={papel.id} value={papel.id}>{papel.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select className="select" value={form.ativo ? "ativo" : "inativo"} onChange={(evento) => setCampo("ativo", evento.target.value === "ativo")}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
          <label className="field">
            <span>Matrícula *</span>
            <input className="input" value={form.matricula} onChange={(evento) => setCampo("matricula", evento.target.value)} />
          </label>
          <label className="field">
            <span>Turno</span>
            <select className="select" value={form.turnoId} onChange={(evento) => setCampo("turnoId", evento.target.value)}>
              <option value="">Nenhum turno</option>
              {opcoes.turnos.map((turno) => (
                <option key={turno.id} value={turno.id}>{turno.descricao}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Carteira</span>
            <select className="select" value={form.clienteId} onChange={(evento) => setCampo("clienteId", evento.target.value)}>
              <option value="">Nenhuma carteira</option>
              {opcoes.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Superior *</span>
            <select className="select" value={form.supervisorId} onChange={(evento) => setCampo("supervisorId", evento.target.value)}>
              <option value="">Sem superior</option>
              {opcoes.supervisores.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.nome} · {supervisor.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Data início no produto</span>
            <input className="input" type="date" value={form.dataInicioProduto || ""} onChange={(evento) => setCampo("dataInicioProduto", evento.target.value)} />
          </label>
          <label className="field">
            <span>Vigência da Hierarquia</span>
            <input className="input" type="date" value={form.hierarquiaVigencia || ""} onChange={(evento) => setCampo("hierarquiaVigencia", evento.target.value)} />
          </label>
          <label className={`field ${styles.campoLargo}`}>
            <span>Motivo da Alteração Hierárquica</span>
            <input className="input" value={form.hierarquiaMotivo} onChange={(evento) => setCampo("hierarquiaMotivo", evento.target.value)} />
          </label>
        </div>

        <div className="btn-row">
          <button className="btn primary" type="submit" disabled={!podeSalvar}>
            <Icon name="check" size={16} />
            {editando ? "Atualizar Usuário" : "Criar Usuário"}
          </button>
          <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function CampanhasModal({ usuario, campanhas, onClose, onSalvar }) {
  const [selecionadas, setSelecionadas] = useState(new Set(usuario.campanhaIds ?? []));
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const campanha of campanhas) {
      const chave = campanha.cliente || "Sem cliente";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(campanha);
    }
    return [...mapa.entries()];
  }, [campanhas]);

  const alternar = (id) =>
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  return (
    <div className={styles.backdrop}>
      <div className={`${styles.modalCampanhas}`} role="dialog" aria-modal="true">
        <div className={styles.campanhasHead}>
          <div>
            <h2>Gerenciar Acesso às Campanhas - {usuario.nome}</h2>
            <p>O escopo define quais monitorias este operador aparece como avaliado.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className={styles.campanhasLista}>
          {grupos.map(([cliente, itens]) => {
            const marcadas = itens.filter((item) => selecionadas.has(item.id)).length;
            return (
              <section key={cliente} className={styles.campanhaGrupo}>
                <header>
                  <label>
                    <input
                      type="checkbox"
                      checked={marcadas === itens.length && itens.length > 0}
                      onChange={(evento) => {
                        setSelecionadas((atual) => {
                          const proximo = new Set(atual);
                          for (const campanha of itens) {
                            if (evento.target.checked) proximo.add(campanha.id);
                            else proximo.delete(campanha.id);
                          }
                          return proximo;
                        });
                      }}
                    />
                    <strong>{cliente}</strong>
                  </label>
                  <span>{marcadas}/{itens.length}</span>
                </header>
                <div className={styles.campanhaItens}>
                  {itens.map((campanha) => (
                    <label key={campanha.id}>
                      <input type="checkbox" checked={selecionadas.has(campanha.id)} onChange={() => alternar(campanha.id)} />
                      {campanha.nome}
                      <span>active</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className={styles.campanhasFooter}>
          <button className="btn primary" type="button" onClick={() => onSalvar([...selecionadas])}>
            Salvar Associações
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
        </footer>
      </div>
    </div>
  );
}

function HistoricoModal({ usuario, onClose }) {
  return (
    <div className={styles.backdrop}>
      <div className={`card pad ${styles.modalUsuario}`} role="dialog" aria-modal="true">
        <div className="section-head">
          <div>
            <h2>Histórico - {usuario.nome}</h2>
            <p>Resumo do cadastro e vínculo hierárquico.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>
        <dl className={styles.historico}>
          <div><dt>Criado em</dt><dd>{usuario.criadoEm ?? SEM_VALOR}</dd></div>
          <div><dt>Último acesso</dt><dd>{usuario.ultimoAcesso ?? "Nunca acessou"}</dd></div>
          <div><dt>Superior atual</dt><dd>{usuario.supervisor ?? SEM_VALOR}</dd></div>
          <div><dt>Vigência</dt><dd>{usuario.hierarquiaVigencia ?? SEM_VALOR}</dd></div>
          <div><dt>Motivo</dt><dd>{usuario.hierarquiaMotivo ?? SEM_VALOR}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function MatrizPermissoes({ recurso }) {
  const dados = recurso.dados;
  return (
    <section className="card pad">
      <div className="section-head">
        <div>
          <h2>Matriz de permissões</h2>
          <p>{dados ? `${formatarNumero(dados.total)} permissões` : "Carregando permissões..."}</p>
        </div>
      </div>
      {recurso.erro ? (
        <p className="alert danger">{recurso.erro}</p>
      ) : !dados ? (
        <EsqueletoTabela colunas={5} linhas={5} />
      ) : dados.modulos.length === 0 ? (
        <div className="empty-state">
          <span className="icon-badge"><Icon name="shield" size={22} /></span>
          <h3>Nenhuma permissão cadastrada</h3>
          <p>O acesso segue pelo papel/cargo do usuário.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className={`data-table branded ${styles.tabela}`}>
            <thead>
              <tr>
                <th>Permissão</th>
                {dados.cargos.map((cargo) => <th key={cargo.id}>{cargo.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {dados.modulos.map((modulo) =>
                modulo.itens.map((permissao) => (
                  <tr key={permissao.id}>
                    <td>{permissao.nome}</td>
                    {permissao.cargos.map((permitido, indice) => (
                      <td key={`${permissao.id}-${indice}`}>{permitido ? "Sim" : "Não"}</td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
