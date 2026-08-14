"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

const TODOS = "todos";
const POR_PAGINA = 50;

const FILTROS_INICIAIS = {
  busca: "",
  operacao: TODOS,
  campanha: TODOS,
  id: "",
  avaliador: TODOS,
  avaliado: TODOS,
  performance: TODOS,
  de: "",
  ate: "",
  categoria: TODOS,
  departamento: TODOS,
};

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function opcoes(rotulo, valores) {
  return [
    { value: TODOS, label: rotulo },
    ...Array.from(new Set(valores.filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((valor) => ({
      value: valor,
      label: valor,
    })),
  ];
}

function opcoesComPadrao(rotulo, opcoesBanco, valoresFallback) {
  if (Array.isArray(opcoesBanco) && opcoesBanco.length > 0) {
    return [{ value: TODOS, label: rotulo }, ...opcoesBanco];
  }
  return opcoes(rotulo, valoresFallback);
}

function scoreFaixa(score) {
  const valor = Number(score);
  if (valor >= 90) return "excelente";
  if (valor >= 80) return "bom";
  if (valor >= 70) return "atencao";
  return "critico";
}

function tomDoScore(score) {
  const valor = Number(score);
  if (valor >= 85) return "success";
  if (valor >= 70) return "warning";
  return "danger";
}

function contarFiltros(filtros) {
  return Object.entries(filtros).filter(([chave, valor]) => {
    if (chave === "busca") return false;
    return valor !== FILTROS_INICIAIS[chave];
  }).length;
}

export default function AvaliacoesPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(0);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [opcoesBanco, setOpcoesBanco] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarAvaliacoes() {
      try {
        const resposta = await fetch("/api/avaliacoes?limit=500", { cache: "no-store" });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar avaliações do banco.");
        }
        if (ativo) {
          setAvaliacoes(payload.data.avaliacoes || []);
          setOpcoesBanco(payload.data.opcoes || null);
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setAvaliacoes([]);
          setOpcoesBanco(null);
          setErro(error.message);
        }
      }
    }

    carregarAvaliacoes();
    return () => {
      ativo = false;
    };
  }, []);

  const opcoesFiltro = useMemo(
    () => ({
      operacao: opcoesComPadrao("Todas as Operações", opcoesBanco?.operacoes, avaliacoes.map((item) => item.cliente)),
      campanha: opcoesComPadrao("Todas as Campanhas", opcoesBanco?.campanhas, avaliacoes.map((item) => item.campanha)),
      avaliador: opcoesComPadrao("Todos os Avaliadores", opcoesBanco?.avaliadores, avaliacoes.map((item) => item.avaliador)),
      avaliado: opcoesComPadrao("Todos os Avaliados", opcoesBanco?.avaliados, avaliacoes.map((item) => item.avaliado)),
      categoria: opcoesComPadrao("Todas as Categorias", opcoesBanco?.categorias, avaliacoes.map((item) => item.categoria)),
      departamento: opcoesComPadrao("Todos os Departamentos", opcoesBanco?.departamentos, avaliacoes.map((item) => item.departamento)),
    }),
    [avaliacoes, opcoesBanco],
  );

  const filtradas = useMemo(() => {
    const busca = normalizar(filtros.busca);
    const idBusca = normalizar(filtros.id).replace(/^qa-?/, "");

    return avaliacoes.filter((item) => {
      if (filtros.operacao !== TODOS && item.cliente !== filtros.operacao) return false;
      if (filtros.campanha !== TODOS && item.campanha !== filtros.campanha) return false;
      if (filtros.avaliador !== TODOS && item.avaliador !== filtros.avaliador) return false;
      if (filtros.avaliado !== TODOS && item.avaliado !== filtros.avaliado) return false;
      if (filtros.categoria !== TODOS && item.categoria !== filtros.categoria) return false;
      if (filtros.departamento !== TODOS && item.departamento !== filtros.departamento) return false;
      if (filtros.performance !== TODOS && scoreFaixa(item.score) !== filtros.performance) return false;
      if (filtros.de && item.data < filtros.de) return false;
      if (filtros.ate && item.data > filtros.ate) return false;
      if (idBusca && !normalizar(item.id).replace(/^qa-?/, "").includes(idBusca)) return false;
      if (
        busca &&
        ![
          item.id,
          item.formulario,
          item.avaliado,
          item.avaliador,
          item.supervisor,
          item.cliente,
          item.campanha,
          item.codGravacao,
        ].some((campo) => normalizar(campo).includes(busca))
      ) {
        return false;
      }
      return true;
    });
  }, [avaliacoes, filtros]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);
  const filtrosAtivos = contarFiltros(filtros);

  function alterarFiltro(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
    setPagina(0);
  }

  function limparDatas() {
    setFiltros((atual) => ({ ...atual, de: "", ate: "" }));
    setPagina(0);
  }

  function limparTudo() {
    setFiltros(FILTROS_INICIAIS);
    setPagina(0);
  }

  function exportarCsv() {
    const header = ["ID", "Formulário", "Cliente", "Campanha", "Avaliado", "Monitor", "Score", "Data"];
    const linhas = filtradas.map((item) =>
      [item.id, item.formulario, item.cliente, item.campanha, item.avaliado, item.avaliador, item.score, item.dataFormatada]
        .map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "avaliacoes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Avaliações">
      <div className={styles.tela}>
        <header className={styles.cabecalho}>
          <div className={styles.tituloComIcone}>
            <Link className="btn ghost icon-only" href="/formularios">
              <Icon name="chevronLeft" size={16} label="Voltar" />
            </Link>
            <span className="icon-badge neutral" aria-hidden="true">
              <Icon name="checklist" size={18} />
            </span>
            <div>
              <h1>Avaliações</h1>
              <p>Visualize e gerencie avaliações</p>
            </div>
          </div>

          <div className={styles.cabecalhoAcoes}>
            <div className={`search-field ${styles.buscaTopo}`}>
              <Icon name="search" size={18} />
              <input
                className="input"
                placeholder="Buscar avaliações..."
                type="search"
                value={filtros.busca}
                onChange={(evento) => alterarFiltro("busca", evento.target.value)}
              />
            </div>
            <button className="btn" type="button" onClick={exportarCsv}>
              <Icon name="download" size={16} />
              Exportar
            </button>
          </div>
        </header>

        <section className={`card ${styles.filtros}`} aria-labelledby="filtros-titulo">
          <div className={styles.filtrosHead}>
            <span className="icon-badge neutral" aria-hidden="true">
              <Icon name="filter" size={18} />
            </span>
            <div>
              <h2 id="filtros-titulo">Filtros de Avaliação</h2>
              <p>Refine os resultados conforme necessário</p>
            </div>
            <div className={styles.filtrosStatus}>
              <span>Filtros ativos</span>
              <strong>{filtrosAtivos}</strong>
              <button className="btn ghost" type="button" onClick={limparTudo}>
                Limpar Todos
              </button>
            </div>
          </div>

          <div className={styles.gradeFiltros}>
            <div className="field">
              <label htmlFor="operacao">Operação</label>
              <select className="select" id="operacao" value={filtros.operacao} onChange={(e) => alterarFiltro("operacao", e.target.value)}>
                {opcoesFiltro.operacao.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="campanha">Campanha</label>
              <select className="select" id="campanha" value={filtros.campanha} onChange={(e) => alterarFiltro("campanha", e.target.value)}>
                {opcoesFiltro.campanha.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="id-monitoria">ID da Monitoria</label>
              <input className="input" id="id-monitoria" placeholder="Ex: QA-24-000123 ou 000123" value={filtros.id} onChange={(e) => alterarFiltro("id", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="avaliador">Avaliador</label>
              <select className="select" id="avaliador" value={filtros.avaliador} onChange={(e) => alterarFiltro("avaliador", e.target.value)}>
                {opcoesFiltro.avaliador.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="avaliado">Avaliado</label>
              <select className="select" id="avaliado" value={filtros.avaliado} onChange={(e) => alterarFiltro("avaliado", e.target.value)}>
                {opcoesFiltro.avaliado.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="performance">Nível de Performance</label>
              <select className="select" id="performance" value={filtros.performance} onChange={(e) => alterarFiltro("performance", e.target.value)}>
                <option value={TODOS}>Todos os Scores</option>
                <option value="excelente">90 a 100</option>
                <option value="bom">80 a 89</option>
                <option value="atencao">70 a 79</option>
                <option value="critico">Abaixo de 70</option>
              </select>
            </div>
            <fieldset className={styles.periodo}>
              <legend>Período de Avaliação</legend>
              <input className="input" type="date" value={filtros.de} max={filtros.ate || undefined} onChange={(e) => alterarFiltro("de", e.target.value)} />
              <input className="input" type="date" value={filtros.ate} min={filtros.de || undefined} onChange={(e) => alterarFiltro("ate", e.target.value)} />
            </fieldset>
            <div className="field">
              <label htmlFor="categoria">Categoria</label>
              <select className="select" id="categoria" value={filtros.categoria} onChange={(e) => alterarFiltro("categoria", e.target.value)}>
                {opcoesFiltro.categoria.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="departamento">Departamento</label>
              <select className="select" id="departamento" value={filtros.departamento} onChange={(e) => alterarFiltro("departamento", e.target.value)}>
                {opcoesFiltro.departamento.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.filtrosRodape}>
            <span>Dica: Combine múltiplos filtros para resultados mais precisos</span>
            <button className="btn ghost" type="button" onClick={limparDatas}>
              <Icon name="calendar" size={14} />
              Limpar Datas
            </button>
          </div>
        </section>

        <section className={styles.resumoGrid} aria-label="Resumo da listagem">
          <div className={`card ${styles.resumoCard}`}>
            <strong>{filtradas.length}</strong>
            <span>Total de Avaliações</span>
          </div>
          <div className={`card ${styles.resumoCard}`}>
            <strong>{paginaAtual + 1}<span> / {paginas}</span></strong>
            <span>Página atual · {POR_PAGINA} por página</span>
          </div>
        </section>

        <section className="card" aria-labelledby="lista-avaliacoes">
          <h2 className="sr-only" id="lista-avaliacoes">Lista de avaliações</h2>
          {erro ? (
            <div className="empty-state">
              <Icon name="error" size={38} />
              <h3>Não foi possível carregar avaliações</h3>
              <p>{erro}</p>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="empty-state">
              <Icon name="filter" size={38} />
              <h3>Nenhuma avaliação encontrada</h3>
              <p>Ajuste os filtros para ampliar o resultado.</p>
            </div>
          ) : (
            <ul className={styles.lista}>
              {visiveis.map((item) => (
                <li className={styles.cardAvaliacao} key={item.id}>
                  <span className={styles.statusIcone} aria-hidden="true">
                    <Icon name="check" size={22} />
                  </span>

                  <div className={styles.avaliacaoCorpo}>
                    <div className={styles.avaliacaoTopo}>
                      <div>
                        <h3>{item.formulario}</h3>
                        <p>
                          <span className={`score ${tomDoScore(item.score)}`}>Nota: {item.score}</span>
                          <span>ID: {item.id}</span>
                          <button className={styles.copiar} type="button" onClick={() => navigator.clipboard?.writeText(item.id)}>
                            <Icon name="checklist" size={13} label="Copiar ID" />
                          </button>
                        </p>
                        <span className={styles.dataLinha}>
                          <Icon name="clock" size={13} />
                          {item.dataFormatada}
                        </span>
                      </div>
                      <div className={styles.acoesCard}>
                        <Link className="btn" href={`/avaliacoes/${item.id}`}>
                          <Icon name="search" size={15} />
                          Visualizar
                        </Link>
                        <Link className="btn" href={`/avaliacoes/${item.id}`}>
                          <Icon name="edit" size={15} />
                          Editar
                        </Link>
                        <button className="btn ghost icon-only" type="button">
                          <Icon name="calendar" size={15} label="Agendar" />
                        </button>
                        <button className="btn ghost icon-only danger" type="button">
                          <Icon name="close" size={15} label="Excluir" />
                        </button>
                      </div>
                    </div>

                    <dl className={styles.detalhes}>
                      <div><dt>Avaliado</dt><dd>{item.avaliado}</dd></div>
                      <div><dt>Monitor</dt><dd>{item.avaliador}</dd></div>
                      <div><dt>Supervisor</dt><dd>{item.supervisor}</dd></div>
                      <div><dt>Duração</dt><dd>{item.duracao}</dd></div>
                      <div><dt>Data</dt><dd>{item.dataFormatada}</dd></div>
                      <div><dt>Cód. Gravação</dt><dd>{item.codGravacao}</dd></div>
                      <div><dt>Campos</dt><dd>{item.campos}</dd></div>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <nav className="pagination" aria-label="Paginação das avaliações">
          <button className="btn ghost" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)} type="button">
            Anterior
          </button>
          <span aria-live="polite">Página {paginaAtual + 1} de {paginas}</span>
          <button className="btn ghost" disabled={paginaAtual >= paginas - 1} onClick={() => setPagina(paginaAtual + 1)} type="button">
            Próxima
          </button>
        </nav>
      </div>
    </AppShell>
  );
}
