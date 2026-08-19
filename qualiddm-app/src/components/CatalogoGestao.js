"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell from "./AppShell";
import { Icon } from "./icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi, excluirApi } from "@/lib/api";
import { normalizar } from "@/lib/formato";
import styles from "./CatalogoGestao.module.css";

/**
 * Painel de cadastro com desempenho — a mesma tela para Operações, Campanhas e
 * Avaliados.
 *
 * As três respondem à mesma pergunta em recortes diferentes: "o que existe
 * cadastrado, como está indo e o que falta tratar". Escrever três páginas quase
 * iguais garantiria que a quarta mudança de layout fosse aplicada em duas delas
 * e esquecida na terceira. O que varia — KPIs, campos do cartão, formulário de
 * cadastro, destino do "Acessar" — entra por propriedade.
 *
 * O que NÃO varia, e é o valor da tela: cada item mostra o desempenho geral, a
 * quebra por canal (Chat / Telefone ativo) e uma leitura em uma linha. A leitura
 * vem calculada do servidor a partir dos números, não de modelo de IA.
 */
export default function CatalogoGestao({
  ativo,
  breadcrumb,
  titulo,
  descricao,
  endpoint,
  buscaPlaceholder = "Buscar...",
  kpis,
  camposDoItem,
  acessar = null,
  criar = null,
  excluir = null,
  vazio = { titulo: "Nada cadastrado", texto: "Cadastre o primeiro registro para começar." },
}) {
  const { dados, carregando, erro, recarregar } = useRecurso(endpoint);
  const [busca, setBusca] = useState("");
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [confirmando, setConfirmando] = useState(null);
  const [aviso, setAviso] = useState("");

  // `?? []` cria array novo a cada render e invalidaria o useMemo abaixo toda
  // vez; memorizar a lista mantém o filtro estável enquanto os dados não mudam.
  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const canais = dados?.canais ?? [];

  const visiveis = useMemo(() => {
    const alvo = normalizar(busca.trim());
    return itens.filter((item) => {
      if (alvo && !normalizar(`${item.nome} ${item.cliente ?? ""} ${item.email ?? ""}`).includes(alvo)) {
        return false;
      }
      // O filtro de canal olha o desempenho: uma campanha de chat sem monitoria
      // no período não deve aparecer como se tivesse resultado de telefone.
      if (canalFiltro !== "todos") {
        if (item.canal) return item.canal === canalFiltro;
        const canal = (item.canais || []).find((entrada) => entrada.canal === canalFiltro);
        return Boolean(canal && canal.monitorias > 0);
      }
      return true;
    });
  }, [itens, busca, canalFiltro]);

  async function cadastrar(evento) {
    evento.preventDefault();
    if (!criar || salvando) return;

    const formulario = new FormData(evento.currentTarget);
    const corpo = {};
    for (const campo of criar.campos) {
      const valor = String(formulario.get(campo.nome) ?? "").trim();
      if (valor) corpo[campo.nome] = valor;
    }

    setSalvando(true);
    setErroAcao("");
    try {
      await enviarApi(criar.endpoint, corpo);
      setFormAberto(false);
      setAviso(criar.mensagem || "Cadastro concluído.");
      await recarregar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item) {
    if (!excluir || salvando) return;
    setSalvando(true);
    setErroAcao("");
    try {
      const resposta = await excluirApi(excluir.endpoint(item));
      setConfirmando(null);
      // A API decide entre apagar e desativar (histórico de monitoria não se
      // apaga): a tela repete a decisão em vez de afirmar "excluído".
      setAviso(
        resposta?.resultado?.desativado
          ? `${item.nome} foi desativado porque tem monitoria vinculada. O histórico continua no sistema.`
          : `${item.nome} foi excluído.`,
      );
      await recarregar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível excluir.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell active={ativo} breadcrumb={breadcrumb}>
      <section className={styles.cabecalho}>
        <div>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>

        <div className={styles.cabecalhoAcoes}>
          <div className="search-field">
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="busca-catalogo">
              {buscaPlaceholder}
            </label>
            <input
              className="input"
              id="busca-catalogo"
              type="search"
              placeholder={buscaPlaceholder}
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>

          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon className={carregando ? "spinning" : undefined} name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>

          {criar ? (
            <button
              className="btn primary"
              type="button"
              aria-expanded={formAberto}
              onClick={() => {
                setFormAberto((aberto) => !aberto);
                setErroAcao("");
              }}
            >
              <Icon name={formAberto ? "close" : "plus"} size={16} />
              {formAberto ? "Cancelar" : criar.rotulo}
            </button>
          ) : null}
        </div>
      </section>

      {erro ? (
        <p className="alert danger">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Não foi possível carregar</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {aviso ? (
        <p className="alert success" role="status">
          <Icon name="checkCircle" size={18} />
          <span className="alert-body">
            <strong>Pronto</strong>
            <span>{aviso}</span>
          </span>
          <button className="btn" type="button" onClick={() => setAviso("")}>
            Fechar
          </button>
        </p>
      ) : null}

      {formAberto && criar ? (
        <section className={`card pad ${styles.formulario}`} aria-labelledby="titulo-cadastro">
          <div className="section-head">
            <div>
              <h2 id="titulo-cadastro">{criar.titulo}</h2>
              {criar.descricao ? <p>{criar.descricao}</p> : null}
            </div>
          </div>

          <form className={styles.formGrade} onSubmit={cadastrar}>
            {criar.campos.map((campo) => (
              <div className="field" key={campo.nome}>
                <label htmlFor={`campo-${campo.nome}`}>
                  {campo.rotulo}
                  {campo.obrigatorio ? " *" : ""}
                </label>

                {campo.opcoes ? (
                  <select
                    className="select"
                    id={`campo-${campo.nome}`}
                    name={campo.nome}
                    defaultValue={campo.padrao ?? ""}
                    required={campo.obrigatorio}
                  >
                    {campo.opcoes.length === 0 ? <option value="">Nenhuma opção disponível</option> : null}
                    {campo.opcoes.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    id={`campo-${campo.nome}`}
                    name={campo.nome}
                    type={campo.tipo || "text"}
                    minLength={campo.minimo}
                    maxLength={campo.maximo}
                    placeholder={campo.exemplo}
                    required={campo.obrigatorio}
                  />
                )}

                {campo.ajuda ? <span className="field-hint">{campo.ajuda}</span> : null}
              </div>
            ))}

            {erroAcao ? (
              <p className="alert danger" role="alert">
                <Icon name="error" size={18} />
                <span className="alert-body">
                  <strong>Não foi possível salvar</strong>
                  <span>{erroAcao}</span>
                </span>
              </p>
            ) : null}

            <div className="btn-row">
              <button className="btn primary" type="submit" disabled={salvando}>
                <Icon name="check" size={16} />
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button className="btn" type="button" onClick={() => setFormAberto(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.kpis} aria-label="Indicadores do cadastro">
        {(kpis?.(dados) ?? []).map((kpi) => (
          <article className={styles.kpi} data-tom={kpi.tom} key={kpi.rotulo}>
            <p className={styles.kpiRotulo}>{kpi.rotulo}</p>
            <p className={styles.kpiValor}>{carregando && !dados ? "—" : kpi.valor}</p>
            {kpi.nota ? <p className={styles.kpiNota}>{kpi.nota}</p> : null}
          </article>
        ))}
      </section>

      {canais.length > 0 ? (
        <div className="jump-chips" role="group" aria-label="Filtrar por canal">
          <button
            className="jump-chip"
            type="button"
            aria-pressed={canalFiltro === "todos"}
            onClick={() => setCanalFiltro("todos")}
          >
            <span>Todos os canais</span>
            <span>{itens.length}</span>
          </button>
          {canais.map((canal) => (
            <button
              className="jump-chip"
              key={canal.id}
              type="button"
              aria-pressed={canalFiltro === canal.id}
              onClick={() => setCanalFiltro(canal.id)}
            >
              <span>{canal.rotulo}</span>
            </button>
          ))}
        </div>
      ) : null}

      {carregando && !dados ? (
        <div className={styles.grade} aria-busy="true">
          {[1, 2, 3].map((posicao) => (
            <div className={`skeleton ${styles.esqueletoCartao}`} key={posicao} />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="wallet" size={20} />
            </span>
            <h2>{busca ? "Nada encontrado para esta busca" : vazio.titulo}</h2>
            <p>{busca ? "Ajuste o termo ou limpe a busca." : vazio.texto}</p>
          </div>
        </section>
      ) : (
        <ul className={styles.grade}>
          {visiveis.map((item) => (
            <li key={item.id}>
              <article className={`card pad ${styles.cartao}`} data-inativo={item.ativo === false || item.ativa === false ? "true" : undefined}>
                <header className={styles.cartaoTopo}>
                  <div className={styles.cartaoIdent}>
                    <h3>{item.nome}</h3>
                    <p>{item.subtitulo ?? item.cliente ?? item.email ?? ""}</p>
                  </div>
                  <span className={`chip ${item.ativo === false || item.ativa === false ? "warning" : "success"}`}>
                    {item.ativo === false || item.ativa === false ? "Inativo" : "Ativo"}
                  </span>
                </header>

                <dl className={styles.campos}>
                  {camposDoItem(item).map((campo) => (
                    <div key={campo.rotulo}>
                      <dt>{campo.rotulo}</dt>
                      <dd data-tom={campo.tom}>{campo.valor}</dd>
                    </div>
                  ))}
                </dl>

                {/* Quebra por canal: é o que o briefing pede — insight e nota
                    divididos entre chat e telefone, não só o total. */}
                {(item.canais || []).length > 0 ? (
                  <ul className={styles.canais}>
                    {item.canais.map((canal) => (
                      <li key={canal.canal} data-vazio={canal.monitorias === 0 ? "true" : undefined}>
                        <span className={styles.canalNome}>{canal.rotulo}</span>
                        <span className={styles.canalNumeros}>
                          <strong>{canal.score == null ? "—" : String(canal.score).replace(".", ",")}</strong>
                          <small>
                            {canal.monitorias} monitoria(s)
                            {canal.naoConformes > 0 ? ` · ${canal.naoConformes} falha(s)` : ""}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {item.insight ? (
                  <p className={styles.insight}>
                    <Icon name="sparkles" size={14} />
                    {item.insight}
                  </p>
                ) : null}

                <div className={styles.cartaoAcoes}>
                  {acessar ? (
                    <Link className="btn primary" href={acessar.href(item)}>
                      <Icon name={acessar.icone || "chevronRight"} size={16} />
                      {acessar.rotulo || "Acessar"}
                    </Link>
                  ) : null}

                  {excluir ? (
                    confirmando === item.id ? (
                      <span className={styles.confirmar}>
                        <span>Confirma?</span>
                        <button className="btn danger" type="button" disabled={salvando} onClick={() => remover(item)}>
                          <Icon name="trash" size={16} />
                          Excluir
                        </button>
                        <button className="btn" type="button" onClick={() => setConfirmando(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          setConfirmando(item.id);
                          setErroAcao("");
                        }}
                      >
                        <Icon name="trash" size={16} />
                        Excluir
                      </button>
                    )
                  ) : null}
                </div>

                {erroAcao && confirmando === item.id ? (
                  <p className="alert danger" role="alert">
                    <Icon name="error" size={18} />
                    <span className="alert-body">
                      <strong>Não foi possível excluir</strong>
                      <span>{erroAcao}</span>
                    </span>
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
