"use client";

import Link from "next/link";
import { useState } from "react";
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

const APARENCIA_PAPEL = {
  administrador: "danger",
  supervisor: "accent",
  monitor: "info",
  operador: "",
  viewer: "",
};

/** CSV com ; e BOM: é o que o Excel em pt-BR abre sem pedir importação. */
function baixarCsv(itens) {
  const colunas = ["Nome", "E-mail", "Papel", "Cargo", "Carteira", "Situação", "Último acesso"];
  const linhas = itens.map((item) => [
    item.nome,
    item.email,
    item.papelLabel,
    item.cargo ?? "",
    item.cliente ?? "",
    item.ativo ? "Ativo" : "Inativo",
    item.ultimoAcesso ?? "Nunca acessou",
  ]);

  const escapar = (valor) => {
    const texto = String(valor ?? "");
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const conteudo = [colunas, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\r\n");
  const blob = new Blob([`﻿${conteudo}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "usuarios-qualiddm.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function GestaoUsuariosPage() {
  const [visao, setVisao] = useState("lista");
  const [busca, setBusca] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [papel, setPapel] = useState("todos");
  const [situacao, setSituacao] = useState("todos");
  const [matrizAberta, setMatrizAberta] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);

  const [ocupado, setOcupado] = useState(null);
  const [erroAcao, setErroAcao] = useState("");
  const [credencial, setCredencial] = useState(null);

  const buscaAtrasada = useDebounce(busca);

  const url = comFiltros("/api/usuarios", {
    busca: buscaAtrasada,
    cargoId,
    papel,
    situacao,
  });

  const { dados, carregando, erro, recarregar, definir } = useRecurso(url);
  // Matriz só é buscada quando alguém abre: são três tabelas em JOIN e a maioria
  // das visitas a esta tela não quer a matriz.
  const matriz = useRecurso(matrizAberta ? "/api/usuarios/permissoes" : null);

  const itens = dados?.itens ?? [];
  const contadores = dados?.contadores ?? null;
  const opcoes = dados?.opcoes ?? { cargos: [], papeis: [], clientes: [] };
  const primeiraCarga = carregando && !dados;

  async function alterar(item, alteracoes) {
    setErroAcao("");
    setCredencial(null);
    setOcupado(item.id);

    try {
      definir(
        await enviarApi(`/api/usuarios/${encodeURIComponent(item.id)}`, alteracoes, {
          metodo: "PATCH",
        }),
      );
    } catch (causa) {
      setErroAcao(`${item.nome}: ${causa.message}`);
    } finally {
      setOcupado(null);
    }
  }

  async function resetarSenha(item) {
    setErroAcao("");
    setCredencial(null);
    setOcupado(item.id);

    try {
      const resposta = await enviarApi(
        `/api/usuarios/${encodeURIComponent(item.id)}/senha`,
        {},
      );
      // A senha aparece UMA vez, na tela de quem resetou. Não fica no banco em
      // claro nem no log — se esta caixa for fechada antes de anotar, o caminho é
      // resetar de novo.
      setCredencial(resposta);
    } catch (causa) {
      setErroAcao(`${item.nome}: ${causa.message}`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <AppShell active="Gestão" breadcrumb="Administração > Gestão > Usuários">
      <section className="page-header">
        <div>
          <h1>Gestão de Usuários</h1>
          <p>Quem tem acesso ao sistema, com que papel e em que carteira</p>
        </div>

        <div className="actions">
          <Link className="btn" href="/gestao">
            <Icon name="chevronLeft" size={16} />
            Operação
          </Link>
          <button
            className="btn"
            type="button"
            aria-pressed={matrizAberta}
            onClick={() => setMatrizAberta((aberta) => !aberta)}
          >
            <Icon name="shield" size={16} />
            {matrizAberta ? "Fechar matriz" : "Ver matriz de permissões"}
          </button>
          <button
            className="btn"
            type="button"
            aria-disabled={itens.length === 0}
            onClick={itens.length > 0 ? () => baixarCsv(itens) : undefined}
          >
            <Icon name="download" size={16} />
            Exportar
          </button>
          <button
            className="btn primary"
            type="button"
            aria-expanded={criarAberto}
            onClick={() => setCriarAberto((aberto) => !aberto)}
          >
            <Icon name={criarAberto ? "close" : "plus"} size={16} />
            {criarAberto ? "Fechar" : "Novo usuário"}
          </button>
        </div>
      </section>

      {credencial ? (
        <p className="alert success">
          <Icon name="key" size={16} />
          <span className="alert-body">
            <strong>Senha provisória de {credencial.nome}</strong>
            <span>
              <code className={styles.senha}>{credencial.senhaProvisoria}</code> — anote agora e
              entregue à pessoa. Ela aparece uma única vez e o sistema exige a troca no primeiro
              acesso.
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

      {criarAberto ? (
        <FormularioNovoUsuario
          opcoes={opcoes}
          onCriado={(resposta) => {
            definir(resposta);
            setCredencial({
              nome: resposta.email,
              email: resposta.email,
              senhaProvisoria: resposta.senhaProvisoria,
            });
            setCriarAberto(false);
          }}
        />
      ) : null}

      {/* --- busca e filtros ------------------------------------------- */}
      <section className={`card pad ${styles.filtros}`} aria-labelledby="filtros-usuarios">
        <h2 className="sr-only" id="filtros-usuarios">
          Buscar e filtrar usuários
        </h2>

        <div className={styles.linhaBusca}>
          <div className={`field ${styles.campoBusca}`}>
            <label htmlFor="usuario-busca">Buscar</label>
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                className="input"
                id="usuario-busca"
                type="search"
                placeholder="Nome ou e-mail"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </div>
          </div>

          <fieldset className={styles.grupoVisao}>
            <legend>Visão</legend>
            <div className={styles.linhaChips}>
              <button
                className="btn"
                type="button"
                aria-pressed={visao === "lista"}
                onClick={() => setVisao("lista")}
              >
                <Icon name="checklist" size={15} />
                Lista
              </button>
              <button
                className="btn"
                type="button"
                aria-pressed={visao === "cards"}
                onClick={() => setVisao("cards")}
              >
                <Icon name="layers" size={15} />
                Cards
              </button>
            </div>
          </fieldset>
        </div>

        <div className={styles.chips}>
          <fieldset className={styles.grupoChips}>
            <legend>Cargo</legend>
            <div className={styles.linhaChips}>
              <button
                className="btn"
                type="button"
                aria-pressed={cargoId === ""}
                onClick={() => setCargoId("")}
              >
                Todos
              </button>
              {opcoes.cargos.map((cargo) => (
                <button
                  key={cargo.id}
                  className="btn"
                  type="button"
                  aria-pressed={cargoId === cargo.id}
                  onClick={() => setCargoId(cargo.id)}
                >
                  {cargo.nome}
                </button>
              ))}
            </div>
            {opcoes.cargos.length === 0 ? (
              <span className="field-hint">
                Nenhum cargo cadastrado — o filtro por papel de acesso continua valendo.
              </span>
            ) : null}
          </fieldset>

          <fieldset className={styles.grupoChips}>
            <legend>Papel de acesso</legend>
            <div className={styles.linhaChips}>
              <button
                className="btn"
                type="button"
                aria-pressed={papel === "todos"}
                onClick={() => setPapel("todos")}
              >
                Todos
              </button>
              {opcoes.papeis.map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  type="button"
                  aria-pressed={papel === item.id}
                  onClick={() => setPapel(item.id)}
                >
                  {item.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.grupoChips}>
            <legend>Situação</legend>
            <div className={styles.linhaChips}>
              {SITUACOES.map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  type="button"
                  aria-pressed={situacao === item.id}
                  onClick={() => setSituacao(item.id)}
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {contadores ? (
          <p className={styles.resumoFiltro}>
            <Icon name="info" size={14} />
            <span>
              {formatarNumero(contadores.total)} usuário(s) no recorte ·{" "}
              {formatarNumero(contadores.ativos)} ativo(s) ·{" "}
              {formatarNumero(contadores.inativos)} inativo(s)
              {contadores.semAcesso > 0
                ? ` · ${formatarNumero(contadores.semAcesso)} nunca acessaram`
                : ""}
            </span>
          </p>
        ) : null}
      </section>

      {/* --- matriz de permissões -------------------------------------- */}
      {matrizAberta ? <MatrizPermissoes recurso={matriz} /> : null}

      {/* --- lista ou cards ------------------------------------------- */}
      <section className="card pad" aria-labelledby="lista-usuarios">
        <div className="section-head">
          <div>
            <h2 id="lista-usuarios">Usuários</h2>
            <p>
              {primeiraCarga
                ? "Carregando usuários..."
                : `${formatarNumero(itens.length)} no recorte atual`}
            </p>
          </div>
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon
              className={carregando ? "spinning" : undefined}
              name={carregando ? "spinner" : "refresh"}
              size={16}
            />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {dados?.excedeuTeto ? (
          <p className="alert warning">
            <Icon name="alert" size={16} />
            <span className="alert-body">
              <strong>Mostrando os 2.000 primeiros</strong>
              <span>Refine a busca ou os filtros para alcançar os demais.</span>
            </span>
          </p>
        ) : null}

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar os usuários</h3>
            <p>{erro}</p>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar novamente
              </button>
            </div>
          </div>
        ) : primeiraCarga ? (
          <EsqueletoTabela colunas={6} linhas={8} />
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="users" size={22} />
            </span>
            <h3>Nenhum usuário no recorte</h3>
            <p>Ajuste a busca e os filtros, ou cadastre o primeiro acesso.</p>
          </div>
        ) : visao === "cards" ? (
          <ul className={styles.cards}>
            {itens.map((item) => (
              <li key={item.id} className={styles.cartao} data-inativo={!item.ativo}>
                <div className={styles.cartaoTopo}>
                  <span className="icon-tile sm" data-tom={item.ativo ? "accent" : ""}>
                    <Icon name="user" size={15} />
                  </span>
                  <div className={styles.cartaoIdent}>
                    <strong>{item.nome}</strong>
                    <span>{item.email}</span>
                  </div>
                </div>

                <div className={styles.cartaoChips}>
                  <span className={`chip ${APARENCIA_PAPEL[item.papel] ?? ""}`}>
                    {item.papelLabel}
                  </span>
                  {item.cargo ? <span className="chip">{item.cargo}</span> : null}
                  <span className={`chip ${item.ativo ? "success" : "danger"}`}>
                    {item.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <dl className={styles.cartaoMeta}>
                  <div>
                    <dt>Carteira</dt>
                    <dd>{item.cliente ?? SEM_VALOR}</dd>
                  </div>
                  <div>
                    <dt>Último acesso</dt>
                    <dd>{item.ultimoAcesso ?? "Nunca acessou"}</dd>
                  </div>
                </dl>

                <AcoesUsuario
                  item={item}
                  ocupado={ocupado === item.id}
                  onAlterar={alterar}
                  onResetar={resetarSenha}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.tabela}`}>
                <caption className="sr-only">
                  Usuários do sistema. {formatarNumero(itens.length)} registros no recorte.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nome e e-mail</th>
                    <th scope="col">Papel</th>
                    <th scope="col">Cargo</th>
                    <th scope="col">Carteira</th>
                    <th scope="col">Último acesso</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id} data-inativo={!item.ativo}>
                      <th scope="row">
                        <span className={styles.celulaEmpilhada}>
                          {item.nome}
                          <span className={styles.celulaSecundaria}>{item.email}</span>
                        </span>
                      </th>
                      <td>
                        <span className={`chip ${APARENCIA_PAPEL[item.papel] ?? ""}`}>
                          {item.papelLabel}
                        </span>
                        {!item.ativo ? <span className="chip danger">Inativo</span> : null}
                      </td>
                      <td>{item.cargo ?? SEM_VALOR}</td>
                      <td>{item.cliente ?? SEM_VALOR}</td>
                      <td className={styles.celulaSecundaria}>
                        {item.ultimoAcesso ?? "Nunca acessou"}
                      </td>
                      <td>
                        <AcoesUsuario
                          item={item}
                          ocupado={ocupado === item.id}
                          onAlterar={alterar}
                          onResetar={resetarSenha}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Botões que o print tem e esta tela NÃO tem. Dizer o que falta é melhor
          que oferecer um controle que não faz nada. */}
      <p className={styles.pendencias}>
        <Icon name="info" size={14} />
        <span>
          Reset de senha em massa, reset por planilha e importação de usuários ainda não estão
          implementados — cada um depende de um formato de planilha definido pela operação. O reset
          individual acima já funciona.
        </span>
      </p>
    </AppShell>
  );
}

/* ==========================================================================
   Ações de um usuário
   ========================================================================== */

function AcoesUsuario({ item, ocupado, onAlterar, onResetar }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className={styles.acoesLinha}>
      <button
        className="btn ghost"
        type="button"
        disabled={ocupado}
        onClick={() => onResetar(item)}
      >
        <Icon name={ocupado ? "spinner" : "key"} size={15} />
        Resetar senha
        <span className="sr-only"> de {item.nome}</span>
      </button>

      {confirmando ? (
        <span className={styles.confirmar}>
          {item.ativo ? "Desativar?" : "Reativar?"}
          <button
            className={`btn ${item.ativo ? "danger" : "primary"}`}
            type="button"
            disabled={ocupado}
            onClick={() => {
              onAlterar(item, { ativo: !item.ativo });
              setConfirmando(false);
            }}
          >
            Confirmar
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={ocupado}
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
        </span>
      ) : (
        <button
          className={`btn ghost ${item.ativo ? "danger" : ""}`}
          type="button"
          disabled={ocupado}
          onClick={() => setConfirmando(true)}
        >
          <Icon name={item.ativo ? "close" : "check"} size={15} />
          {item.ativo ? "Desativar" : "Reativar"}
          <span className="sr-only"> {item.nome}</span>
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
   Novo usuário
   ========================================================================== */

function FormularioNovoUsuario({ opcoes, onCriado }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("monitor");
  const [cargoId, setCargoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const incompleto = nome.trim().length < 2 || !email.includes("@");

  async function criar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      onCriado(
        await enviarApi("/api/usuarios", {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          papel,
          cargoId: cargoId || null,
          clienteId: clienteId || null,
        }),
      );
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={`card pad ${styles.formulario}`} onSubmit={criar}>
      <div className="section-head">
        <div>
          <h2>Novo usuário</h2>
          <p>O sistema gera uma senha provisória e exige a troca no primeiro acesso</p>
        </div>
      </div>

      <div className={styles.formGrade}>
        <div className="field">
          <label htmlFor="novo-nome">Nome</label>
          <input
            className="input"
            id="novo-nome"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Maria Souza"
          />
        </div>

        <div className="field">
          <label htmlFor="novo-email">E-mail</label>
          <input
            className="input"
            id="novo-email"
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            placeholder="maria.souza@grupoddm.com.br"
          />
        </div>

        <div className="field">
          <label htmlFor="novo-papel">Papel de acesso</label>
          <select
            className="select"
            id="novo-papel"
            value={papel}
            onChange={(evento) => setPapel(evento.target.value)}
          >
            {opcoes.papeis.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          <span className="field-hint">Define o que a pessoa pode fazer no sistema.</span>
        </div>

        <div className="field">
          <label htmlFor="novo-cargo">Cargo</label>
          <select
            className="select"
            id="novo-cargo"
            value={cargoId}
            onChange={(evento) => setCargoId(evento.target.value)}
          >
            <option value="">Sem cargo</option>
            {opcoes.cargos.map((cargo) => (
              <option key={cargo.id} value={cargo.id}>
                {cargo.nome}
              </option>
            ))}
          </select>
          <span className="field-hint">Nome usado pela operação. Não substitui o papel.</span>
        </div>

        <div className="field">
          <label htmlFor="novo-cliente">Carteira</label>
          <select
            className="select"
            id="novo-cliente"
            value={clienteId}
            onChange={(evento) => setClienteId(evento.target.value)}
          >
            <option value="">Sem carteira</option>
            {opcoes.clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível criar</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      <div className="btn-row">
        <button className="btn primary" type="submit" disabled={incompleto || enviando}>
          <Icon name={enviando ? "spinner" : "check"} size={16} />
          {enviando ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}

/* ==========================================================================
   Matriz de permissões
   ========================================================================== */

function MatrizPermissoes({ recurso }) {
  const dados = recurso.dados;

  return (
    <section className="card pad" aria-labelledby="matriz-permissoes">
      <div className="section-head">
        <div>
          <h2 id="matriz-permissoes">Matriz de permissões</h2>
          <p>
            {dados?.suportada === false
              ? "Cargos e permissões não estão cadastrados neste banco"
              : `${formatarNumero(dados?.total ?? 0)} permissão(ões) em ${formatarNumero(dados?.cargos?.length ?? 0)} cargo(s)`}
          </p>
        </div>
      </div>

      {recurso.erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível carregar a matriz</strong>
            <span>{recurso.erro}</span>
          </span>
        </p>
      ) : !dados ? (
        <EsqueletoTabela colunas={5} linhas={6} />
      ) : dados.suportada === false || dados.modulos.length === 0 ? (
        <div className="empty-state">
          <span className="icon-badge">
            <Icon name="shield" size={22} />
          </span>
          <h3>Nenhuma permissão cadastrada</h3>
          <p>
            As tabelas de cargos e permissões vêm da migration 003. Sem linhas nelas, o acesso é
            decidido apenas pelo papel de cada usuário.
          </p>
        </div>
      ) : (
        <>
          {/* Leitura, não edição: dizer isso evita que alguém tente clicar numa
              célula esperando conceder acesso. */}
          <p className={styles.notaMatriz}>
            <Icon name="info" size={14} />
            <span>
              Visualização do que está configurado. Conceder ou retirar permissão altera o acesso do
              cargo inteiro e não se faz por clique de célula — a alteração é feita no cadastro de
              cargos.
            </span>
          </p>

          <div className="table-block">
            <div className="table-scroll">
              <table className={`data-table branded ${styles.matriz}`}>
                <caption className="sr-only">
                  Permissões por cargo, agrupadas por módulo.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Permissão</th>
                    {dados.cargos.map((cargo) => (
                      <th key={cargo.id} scope="col">
                        {cargo.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                {dados.modulos.map((grupo) => (
                  <tbody key={grupo.modulo}>
                    <tr className={styles.linhaModulo}>
                      <th colSpan={dados.cargos.length + 1} scope="colgroup">
                        {grupo.modulo}
                      </th>
                    </tr>
                    {grupo.itens.map((permissao) => (
                      <tr key={permissao.id}>
                        <th scope="row">
                          <span className={styles.celulaEmpilhada}>
                            {permissao.nome}
                            <span className={styles.celulaSecundaria}>{permissao.slug}</span>
                          </span>
                        </th>
                        {permissao.cargos.map((concedida, indice) => (
                          <td key={dados.cargos[indice].id} className={styles.celulaMatriz}>
                            {/* Ícone + texto para leitor de tela: uma célula
                                vazia versus um check colorido não diferencia
                                nada para quem não vê cor. */}
                            {concedida ? (
                              <>
                                <Icon name="check" size={15} />
                                <span className="sr-only">Concedida</span>
                              </>
                            ) : (
                              <>
                                <span aria-hidden="true">–</span>
                                <span className="sr-only">Não concedida</span>
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
