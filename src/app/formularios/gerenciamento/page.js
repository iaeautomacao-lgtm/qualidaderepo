"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros, enviarApi, excluirApi } from "@/lib/api";
import { formatarNumero } from "@/lib/formato";
import styles from "./page.module.css";

const APARENCIA_STATUS = {
  ativo: { tom: "success", icone: "checkCircle" },
  rascunho: { tom: "", icone: "edit" },
  desenvolvimento: { tom: "warning", icone: "clock" },
  inativo: { tom: "danger", icone: "close" },
};

export default function GerenciamentoFormulariosPage() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [clienteId, setClienteId] = useState("");
  const [status, setStatus] = useState("todos");

  const [editando, setEditando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [erroAcao, setErroAcao] = useState("");

  const buscaAtrasada = useDebounce(busca);

  const url = comFiltros("/api/formularios/gerenciamento", {
    busca: buscaAtrasada,
    categoria,
    clienteId,
    status,
  });

  const { dados, carregando, erro, recarregar, definir } = useRecurso(url);

  const itens = dados?.itens ?? [];
  const contadores = dados?.contadores ?? null;
  const opcoes = dados?.opcoes ?? { clientes: [], categorias: [], status: [] };
  const modos = dados?.modosCalculo ?? [];
  const cadastroCompleto = dados?.cadastroCompleto !== false;
  const primeiraCarga = carregando && !dados;

  async function salvarCadastro(item, alteracoes) {
    setErroAcao("");
    setAviso("");
    setOcupado(item.id);

    try {
      const resposta = await enviarApi(
        `/api/formularios/${encodeURIComponent(item.id)}`,
        alteracoes,
        { metodo: "PATCH" },
      );
      // A rota devolve o catálogo inteiro: a tela troca o estado sem um GET extra.
      definir(resposta);
      setEditando(null);
    } catch (causa) {
      setErroAcao(`${item.nome}: ${causa.message}`);
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(item) {
    setErroAcao("");
    setAviso("");
    setOcupado(item.id);

    try {
      const resposta = await excluirApi(`/api/formularios/${encodeURIComponent(item.id)}`);
      definir(resposta);
      setConfirmando(null);
      // A tela diz qual das duas coisas aconteceu: "excluído" para um cadastro
      // sem uso e "desativado" quando havia monitoria lançada. Anunciar
      // "excluído" nos dois casos seria mentira.
      setAviso(
        resposta.acao === "excluido"
          ? `Formulário “${resposta.nome}” excluído.`
          : `Formulário “${resposta.nome}” desativado: ${formatarNumero(resposta.avaliacoes)} monitoria(s) já usam esta régua e o histórico delas precisa dela.`,
      );
    } catch (causa) {
      setErroAcao(`${item.nome}: ${causa.message}`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <AppShell active="Formulários" breadcrumb="Qualidade > Formulários > Gerenciamento">
      <section className="page-header">
        <div>
          <h1>Gerenciamento de Formulários</h1>
          <p>Réguas de monitoria cadastradas por carteira</p>
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
          <Link className="btn primary" href="/formularios/novo">
            <Icon name="plus" size={16} />
            Criar formulário
          </Link>
        </div>
      </section>

      {!cadastroCompleto && dados ? (
        <p className="alert warning">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Descrição e tipo de cálculo indisponíveis neste banco</strong>
            <span>
              Rode a migration <code>008_formulario_descricao_e_tipo_calculo.sql</code> para
              habilitar os dois campos. O resto da tela funciona normalmente.
            </span>
          </span>
        </p>
      ) : null}

      {/* --- busca e filtros ------------------------------------------- */}
      <section className={`card pad ${styles.filtros}`} aria-labelledby="filtros-formularios">
        <h2 className="sr-only" id="filtros-formularios">
          Buscar e filtrar formulários
        </h2>

        <div className="field">
          <label htmlFor="form-busca">Buscar formulário</label>
          <div className="search-field">
            <Icon name="search" size={18} />
            <input
              className="input"
              id="form-busca"
              type="search"
              placeholder="Nome do formulário ou cliente"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        </div>

        <div className={styles.chips}>
          <fieldset className={styles.grupoChips}>
            <legend>Categoria</legend>
            <div className={styles.linhaChips}>
              <button
                className="btn"
                type="button"
                aria-pressed={categoria === "todos"}
                onClick={() => setCategoria("todos")}
              >
                Todas
              </button>
              {opcoes.categorias.map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  type="button"
                  aria-pressed={categoria === item.id}
                  onClick={() => setCategoria(item.id)}
                >
                  {item.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.grupoChips}>
            <legend>Situação</legend>
            <div className={styles.linhaChips}>
              <button
                className="btn"
                type="button"
                aria-pressed={status === "todos"}
                onClick={() => setStatus("todos")}
              >
                Todas
              </button>
              {opcoes.status.map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  type="button"
                  aria-pressed={status === item.id}
                  onClick={() => setStatus(item.id)}
                >
                  {item.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <div className={`field ${styles.campoCliente}`}>
            <label htmlFor="form-cliente">Cliente</label>
            <select
              className="select"
              id="form-cliente"
              value={clienteId}
              onChange={(evento) => setClienteId(evento.target.value)}
            >
              <option value="">Todos os clientes</option>
              {opcoes.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {contadores ? (
          <p className={styles.resumoFiltro}>
            <Icon name="info" size={14} />
            <span>
              {formatarNumero(contadores.total)} formulário(s) no recorte ·{" "}
              {formatarNumero(contadores.ativos)} ativo(s) ·{" "}
              {formatarNumero(contadores.perguntas)} pergunta(s) no total
            </span>
          </p>
        ) : null}
      </section>

      {aviso ? (
        <p className="alert success">
          <Icon name="checkCircle" size={16} />
          <span className="alert-body">
            <strong>Pronto</strong>
            <span>{aviso}</span>
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

      {/* --- cartões --------------------------------------------------- */}
      {erro ? (
        <div className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar os formulários</h3>
            <p>{erro}</p>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      ) : primeiraCarga ? (
        <div className={styles.esqueleto} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : itens.length === 0 ? (
        <div className="card pad">
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="checklist" size={22} />
            </span>
            <h3>Nenhum formulário no recorte</h3>
            <p>Ajuste a busca e os filtros, ou cadastre a primeira régua da carteira.</p>
            <div className="btn-row">
              <Link className="btn primary" href="/formularios/novo">
                <Icon name="plus" size={16} />
                Criar formulário
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <ul className={styles.lista}>
          {itens.map((item) => (
            <li key={item.id}>
              <CartaoFormulario
                item={item}
                modos={modos}
                cadastroCompleto={cadastroCompleto}
                emEdicao={editando === item.id}
                emConfirmacao={confirmando === item.id}
                ocupado={ocupado === item.id}
                onEditar={() => {
                  setEditando(editando === item.id ? null : item.id);
                  setConfirmando(null);
                }}
                onConfirmar={() => {
                  setConfirmando(confirmando === item.id ? null : item.id);
                  setEditando(null);
                }}
                onSalvar={(alteracoes) => salvarCadastro(item, alteracoes)}
                onExcluir={() => excluir(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

/* ==========================================================================
   Cartão de um formulário
   ========================================================================== */

function CartaoFormulario({
  item,
  modos,
  cadastroCompleto,
  emEdicao,
  emConfirmacao,
  ocupado,
  onEditar,
  onConfirmar,
  onSalvar,
  onExcluir,
}) {
  const [descricao, setDescricao] = useState(item.descricao ?? "");
  const [tipoCalculo, setTipoCalculo] = useState(item.tipoCalculo ?? "criterio");
  const [status, setStatus] = useState(item.status);

  const aparencia = APARENCIA_STATUS[item.status] ?? { tom: "", icone: "info" };

  return (
    <article className={`card ${styles.cartao}`} data-inativo={item.status === "inativo"}>
      <header className={styles.cartaoTopo}>
        <div className={styles.identidade}>
          <h3>{item.nome}</h3>
          <span className={styles.idTecnico}>ID: {item.id}</span>
          <span className={`chip ${aparencia.tom}`}>
            <Icon name={aparencia.icone} size={12} />
            {item.statusLabel}
          </span>
          <span className="chip">{item.categoriaLabel}</span>
          {item.versao > 1 ? <span className="chip">v{item.versao}</span> : null}
        </div>

        <div className={styles.acoes}>
          <Link
            className="btn ghost"
            href={`/formularios/iniciar?formularioId=${encodeURIComponent(item.id)}`}
          >
            <Icon name="play" size={15} />
            Aplicar
          </Link>
          <button className="btn ghost" type="button" onClick={onEditar} aria-expanded={emEdicao}>
            <Icon name="edit" size={15} />
            {emEdicao ? "Fechar" : "Editar cadastro"}
          </button>
          {emConfirmacao ? (
            <span className={styles.confirmar}>
              Excluir?
              <button className="btn danger" type="button" disabled={ocupado} onClick={onExcluir}>
                <Icon name={ocupado ? "spinner" : "trash"} size={15} />
                {ocupado ? "Excluindo..." : "Confirmar"}
              </button>
              <button className="btn ghost" type="button" disabled={ocupado} onClick={onConfirmar}>
                Cancelar
              </button>
            </span>
          ) : (
            <button className="btn ghost icon-only danger" type="button" onClick={onConfirmar}>
              <Icon name="trash" size={15} label={`Excluir o formulário ${item.nome}`} />
            </button>
          )}
        </div>
      </header>

      {item.descricao ? (
        <p className={styles.descricao}>{item.descricao}</p>
      ) : cadastroCompleto ? (
        <p className={styles.semDescricao}>
          Sem descrição cadastrada. Quem chega depois não sabe para que serve esta régua — use
          “Editar cadastro”.
        </p>
      ) : null}

      <dl className={styles.meta}>
        <div>
          <dt>Perguntas</dt>
          <dd>{formatarNumero(item.perguntas)}</dd>
        </div>
        <div>
          <dt>Seções</dt>
          <dd>{formatarNumero(item.secoes)}</dd>
        </div>
        <div>
          <dt>Criado em</dt>
          <dd>{item.criadoEm}</dd>
        </div>
        <div>
          <dt>Editado em</dt>
          <dd>{item.editadoEm}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{item.cliente}</dd>
        </div>
        <div className={styles.metaLarga}>
          <dt>Campanhas</dt>
          <dd>{item.campanhas ?? "Nenhuma campanha vinculada"}</dd>
        </div>
      </dl>

      {/* --- tipo de cálculo ------------------------------------------- */}
      {item.tipoCalculo ? (
        <section className={styles.calculo} aria-labelledby={`calculo-${item.id}`}>
          <h4 id={`calculo-${item.id}`}>Tipo de cálculo</h4>
          <ul className={styles.modos}>
            {modos.map((modo) => {
              const escolhido = item.tipoCalculo === modo.id;
              return (
                <li key={modo.id} className={styles.modo} data-escolhido={escolhido}>
                  <span className={styles.modoTopo}>
                    <Icon name="metrics" size={15} />
                    {modo.rotulo.toUpperCase()}
                    {escolhido ? <Icon name="checkCircle" size={15} /> : null}
                  </span>
                  <strong>{modo.titulo}</strong>
                  <span>{modo.descricao}</span>
                  <em>{modo.exemplo}</em>
                </li>
              );
            })}
          </ul>
          {/* O campo é cadastro, não regra executada. Dizer isso na tela é o que
              impede alguém de trocar o modo esperando a nota mudar. */}
          <p className={styles.avisoCalculo}>
            <Icon name="info" size={14} />
            <span>
              Registro de cadastro. A nota continua sendo calculada pela fórmula única do sistema:
              percentual dos pesos obtidos sobre os pesos aplicáveis, com critério eliminatório
              zerando a ficha.
            </span>
          </p>
        </section>
      ) : null}

      {/* --- edição ---------------------------------------------------- */}
      {emEdicao ? (
        <form
          className={styles.edicao}
          onSubmit={(evento) => {
            evento.preventDefault();
            const alteracoes = { status };
            if (cadastroCompleto) {
              alteracoes.descricao = descricao.trim();
              alteracoes.tipoCalculo = tipoCalculo;
            }
            onSalvar(alteracoes);
          }}
        >
          {cadastroCompleto ? (
            <>
              <div className="field">
                <label htmlFor={`descricao-${item.id}`}>Descrição</label>
                <textarea
                  className={`input ${styles.area}`}
                  id={`descricao-${item.id}`}
                  rows={4}
                  placeholder="O que esta régua avalia e em que contato ela se aplica..."
                  value={descricao}
                  onChange={(evento) => setDescricao(evento.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor={`tipo-${item.id}`}>Tipo de cálculo</label>
                <select
                  className="select"
                  id={`tipo-${item.id}`}
                  value={tipoCalculo}
                  onChange={(evento) => setTipoCalculo(evento.target.value)}
                >
                  {modos.map((modo) => (
                    <option key={modo.id} value={modo.id}>
                      {modo.rotulo} — {modo.titulo}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="field">
            <label htmlFor={`status-${item.id}`}>Situação</label>
            <select
              className="select"
              id={`status-${item.id}`}
              value={status}
              onChange={(evento) => setStatus(evento.target.value)}
            >
              <option value="ativo">Ativo</option>
              <option value="rascunho">Rascunho</option>
              <option value="desenvolvimento">Em desenvolvimento</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div className="btn-row">
            <button className="btn primary" type="submit" disabled={ocupado}>
              <Icon name={ocupado ? "spinner" : "check"} size={16} />
              {ocupado ? "Salvando..." : "Salvar cadastro"}
            </button>
            <button className="btn" type="button" disabled={ocupado} onClick={onEditar}>
              Cancelar
            </button>
          </div>

          {/* Seções e critérios ficam fora da edição em linha de propósito. */}
          <p className={styles.notaEdicao}>
            <Icon name="info" size={14} />
            <span>
              Seções, critérios e pesos não se editam aqui: mudar peso de régua que já tem monitoria
              lançada trocaria a medida sem recalcular as notas antigas. Isso é uma nova versão do
              formulário.
            </span>
          </p>
        </form>
      ) : null}
    </article>
  );
}
