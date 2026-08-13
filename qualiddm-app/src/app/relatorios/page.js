"use client";

import { useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import {
  avaliadores,
  avaliados,
  campanhas,
  categorias,
  clientes,
  tiposRelatorio,
  tiposRelatorioIA,
} from "@/data/seed";
import AnaliseIa from "./AnaliseIa";
import styles from "./page.module.css";

/* "" = nenhum filtro aplicado naquele campo. Um sentinela só para todos os
   campos deixa a contagem e o "limpar" triviais. */
const FILTROS_VAZIOS = {
  cliente: "",
  campanha: "",
  avaliado: "",
  categoria: "",
  avaliador: "",
  idMonitoria: "",
  inicio: "",
  fim: "",
};

/* Os dois blocos da coluna da esquerda. As análises com IA vêm primeiro de
   propósito: são 14 relatórios de sistema abaixo, e embaixo deles o bloco novo
   só apareceria para quem rolasse a lista até o fim. */
const GRUPOS_TIPOS = [
  { id: "ia", titulo: "Análises com IA", itens: tiposRelatorioIA },
  { id: "sistema", titulo: "Relatórios do sistema", itens: tiposRelatorio },
];

const TODOS_OS_TIPOS = [...tiposRelatorioIA, ...tiposRelatorio];

/**
 * Conta quantos filtros o usuário realmente aplicou.
 *
 * O período conta como UM filtro mesmo com as duas datas preenchidas: para
 * quem usa a tela, "Período de Avaliação" é um campo só, e contar 2 faria o
 * rótulo mentir.
 */
function contarFiltros(filtros) {
  const simples = [
    filtros.cliente,
    filtros.campanha,
    filtros.avaliado,
    filtros.categoria,
    filtros.avaliador,
    filtros.idMonitoria,
  ];

  const total = simples.filter((valor) => valor.trim() !== "").length;
  return filtros.inicio || filtros.fim ? total + 1 : total;
}

/** aaaa-mm-dd no fuso local — toISOString() jogaria para UTC e trocaria o dia. */
function paraIso(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function formatarDataHora(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()} às ${hora}:${minuto}`;
}

/**
 * Os ids da tela e os da API são diferentes de propósito: a tela numera os
 * relatórios de IA com prefixo `ia-` para agrupá-los na lista, e a API nomeia
 * pelo tipo de análise. O mapa explícito evita que renomear um dos lados quebre
 * o outro em silêncio.
 */
const TIPO_NA_API = {
  "ia-resumo-executivo": "resumo-executivo",
  "ia-analise-ofensores": "ofensores",
  "ia-plano-coaching": "coaching",
  "ia-risco-ncg": "risco-ncg",
};

const TOM_POR_SEVERIDADE = {
  critica: "danger",
  alta: "warning",
  media: "info",
  baixa: "neutral",
};

const ROTULO_SEVERIDADE = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

/** Traduz o percentual de confiança em palavra — cor e número não bastam. */
function rotuloConfianca(percentual) {
  if (percentual >= 80) return "alta";
  if (percentual >= 60) return "média";
  return "baixa";
}

/**
 * ÚNICO ponto de contato com a IA.
 *
 * Chama a rota real, que agrega os dados em SQL e manda para o Gemini. Sem
 * banco populado ela responde erro — e o erro aparece na tela, em vez de uma
 * análise de mentira que pareceria verdadeira.
 */
async function gerarAnalise(filtros, tipo) {
  const resposta = await fetch("/api/relatorios/ia", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tipo,
      clienteId: filtros.cliente || null,
      campanhaId: filtros.campanha || null,
      avaliadoId: filtros.avaliado || null,
      avaliadorId: filtros.avaliador || null,
      categoria: filtros.categoria || null,
      dataInicio: filtros.de || null,
      dataFim: filtros.ate || null,
    }),
  });

  const payload = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new Error(payload?.error?.message ?? "Não foi possível gerar a análise.");
  }

  const dados = payload.data;

  // Adapta o formato da API ao que o painel espera. O mapa fica aqui e não no
  // componente: assim a tela não precisa conhecer o contrato da rota.
  return {
    periodo: dados.periodo
      ? `${dados.periodo.inicio} a ${dados.periodo.fim}`
      : "período completo",
    avaliacoesConsideradas: dados.totalAvaliacoes ?? 0,
    confianca: {
      valor: dados.confianca?.percentual ?? 0,
      rotulo: rotuloConfianca(dados.confianca?.percentual ?? 0),
    },
    resumo: dados.resumo ?? [],
    achados: (dados.achados ?? []).map((achado, indice) => ({
      id: `achado-${indice}`,
      titulo: achado.titulo,
      detalhe: achado.causaProvavel,
      // A API devolve a evidência já em texto ("276 avaliações, 21,5%"), porque
      // quem sabe o número é o SQL, não o modelo.
      avaliacoes: null,
      percentual: achado.evidencia,
      severidade: ROTULO_SEVERIDADE[achado.severidade] ?? achado.severidade,
      tom: TOM_POR_SEVERIDADE[achado.severidade] ?? "neutral",
    })),
    recomendacoes: (dados.recomendacoes ?? []).map((recomendacao, indice) => ({
      id: `recomendacao-${indice}`,
      acao: recomendacao.acao,
      responsavel: recomendacao.responsavel,
      impacto: recomendacao.impactoEsperado,
    })),
    recorte: contarFiltros(filtros),
    geradoEm: formatarDataHora(new Date()),
    // Guarda o recorte que originou a análise para a tela saber avisar quando
    // os filtros mudarem depois.
    assinatura: JSON.stringify(filtros),
  };
}

const ATALHOS_PERIODO = [
  { id: "7d", rotulo: "Últimos 7 dias", dias: 7 },
  { id: "30d", rotulo: "Últimos 30 dias", dias: 30 },
  { id: "mes", rotulo: "Mês atual", dias: null },
];

const BENEFICIOS = [
  {
    id: "rapido",
    icon: "clock",
    titulo: "Mais rápido",
    texto: "Evita carregar a base inteira a cada acesso à tela.",
  },
  {
    id: "preciso",
    icon: "target",
    titulo: "Mais preciso",
    texto: "Você vê apenas o recorte que importa para sua análise.",
  },
  {
    id: "exportacao",
    icon: "download",
    titulo: "Exportações enxutas",
    texto: "Excel/CSV gerados só com o que você consultar.",
  },
];

export default function RelatoriosPage() {
  const [tipoSelecionado, setTipoSelecionado] = useState("base-monitoria");
  const [favoritos, setFavoritos] = useState(() =>
    TODOS_OS_TIPOS.filter((tipo) => tipo.favorito).map((tipo) => tipo.id)
  );
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [statusConsulta, setStatusConsulta] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erroAnalise, setErroAnalise] = useState(null);
  const primeiroFiltroRef = useRef(null);

  const relatorio =
    TODOS_OS_TIPOS.find((tipo) => tipo.id === tipoSelecionado) ?? TODOS_OS_TIPOS[0];
  const ehIa = Boolean(relatorio.ia);
  const totalFiltros = useMemo(() => contarFiltros(filtros), [filtros]);
  const temFiltro = totalFiltros > 0;
  const analiseDesatualizada = Boolean(analise) && analise.assinatura !== JSON.stringify(filtros);

  function alterar(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    // Trocar o recorte invalida o aviso da consulta anterior.
    setStatusConsulta(null);
  }

  function limparTudo() {
    setFiltros(FILTROS_VAZIOS);
    setStatusConsulta(null);
  }

  function alternarFavorito(id) {
    setFavoritos((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    );
  }

  function selecionarTipo(id) {
    setTipoSelecionado(id);
    // Cada relatório tem a sua análise: manter a anterior na tela daria a
    // impressão de que ela vale para o relatório novo.
    setStatusConsulta(null);
    setAnalise(null);
    setErroAnalise(null);
    setFiltrosAbertos(true);
  }

  function aplicarPeriodo(atalho) {
    const hoje = new Date();
    const inicio =
      atalho.dias === null
        ? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
        : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (atalho.dias - 1));

    setFiltros((atual) => ({ ...atual, inicio: paraIso(inicio), fim: paraIso(hoje) }));
    setStatusConsulta(null);
  }

  /**
   * Consulta tabular ainda não tem de onde puxar dado: a base não está
   * conectada. Fingir um resultado aqui seria inventar número — melhor dizer a
   * verdade e preservar o recorte que o usuário montou.
   */
  function consultar(semFiltros = false) {
    if (!semFiltros && !temFiltro) {
      setStatusConsulta({
        tom: "warning",
        icone: "alert",
        texto:
          "Escolha pelo menos um filtro antes de consultar, ou use “Carregar tudo (sem filtros)”.",
      });
      return;
    }

    setStatusConsulta({
      tom: "info",
      icone: "info",
      texto: semFiltros
        ? "Carregamento sem filtros solicitado. A base ainda não está conectada — assim que estiver, os registros aparecem aqui."
        : `Consulta solicitada com ${totalFiltros === 1 ? "1 filtro" : `${totalFiltros} filtros`}. A base ainda não está conectada — assim que estiver, os registros aparecem aqui.`,
    });
  }

  async function solicitarAnalise() {
    if (gerando) return;

    setGerando(true);
    setErroAnalise(null);

    try {
      const resultado = await gerarAnalise(filtros, TIPO_NA_API[relatorio.id]);
      setAnalise(resultado);
      // Com a análise na tela, o painel de filtros recolhe: a leitura passa a
      // ser a tarefa, e é o que libera altura para o texto caber sem rolagem.
      setFiltrosAbertos(false);
    } catch {
      setErroAnalise("Não foi possível gerar a análise agora. Tente novamente em instantes.");
    } finally {
      setGerando(false);
    }
  }

  function irParaFiltros() {
    setFiltrosAbertos(true);
    // O foco só existe depois de o painel voltar a ser exibido.
    requestAnimationFrame(() => primeiroFiltroRef.current?.focus());
  }

  // Passo 1 já nasce concluído (há sempre um relatório selecionado); o passo 2
  // conclui quando existe filtro, e aí o passo atual vira o último.
  const passoAtual = temFiltro ? 3 : 2;
  const passos = [
    { numero: 1, titulo: "Relatório selecionado", detalhe: relatorio.nome },
    { numero: 2, titulo: "Definir filtros", detalhe: "Cliente, período, equipe..." },
    {
      numero: 3,
      titulo: ehIa ? "Gerar análise" : "Consultar dados",
      detalhe: temFiltro ? "Pronto para executar" : "Aguardando filtros",
    },
  ];

  const subtituloResultado = ehIa
    ? analise
      ? " · Análise gerada"
      : " · Aguardando geração"
    : statusConsulta
      ? " · Consulta solicitada"
      : " · Aguardando consulta";

  return (
    <AppShell active="Relatórios" breadcrumb="Qualidade > Relatórios">
      <section className={styles.pageHead}>
        <h1>Relatórios</h1>
        <p className="text-muted">
          {TODOS_OS_TIPOS.length} relatórios disponíveis, {tiposRelatorioIA.length} com IA
        </p>
      </section>

      <div className={styles.board}>
        <section className={`card ${styles.rail}`} aria-labelledby="tipos-relatorio">
          <div className={styles.railHead}>
            <h2 id="tipos-relatorio">Tipos de Relatórios</h2>
            <p>Selecione um relatório</p>
          </div>

          {/* Única região com rolagem própria da tela: são 18 relatórios e a
              página inteira não pode rolar em 1440x900. Não precisa de
              tabindex — os botões de dentro já levam o teclado até aqui. */}
          <div className={styles.railList}>
            {GRUPOS_TIPOS.map((grupo) => (
              <section className={styles.grupo} key={grupo.id} aria-labelledby={`grupo-${grupo.id}`}>
                <h3 className="label-micro" id={`grupo-${grupo.id}`}>
                  {grupo.titulo}
                </h3>

                <ul className={styles.grupoLista}>
                  {grupo.itens.map((tipo) => {
                    const favorito = favoritos.includes(tipo.id);
                    const selecionado = tipo.id === tipoSelecionado;

                    return (
                      <li className={styles.tipo} key={tipo.id}>
                        <button
                          className={styles.tipoBtn}
                          type="button"
                          aria-current={selecionado ? "true" : undefined}
                          onClick={() => selecionarTipo(tipo.id)}
                        >
                          <span className={styles.tipoNome}>{tipo.nome}</span>
                          <span className={styles.tipoMeta}>
                            <span className={tipo.ia ? "chip accent" : "chip"}>
                              {tipo.ia ? "IA" : "Sistema"}
                            </span>
                            {selecionado ? (
                              <span className={styles.tipoAtual}>Selecionado</span>
                            ) : null}
                          </span>
                        </button>

                        {/* aria-pressed carrega o estado; o rótulo diz a ação e
                            o nome do relatório, porque dezenas de botões iguais
                            sem nome são inúteis em leitor de tela. */}
                        <button
                          className={styles.estrela}
                          type="button"
                          aria-pressed={favorito}
                          aria-label={
                            favorito
                              ? `Remover ${tipo.nome} dos favoritos`
                              : `Marcar ${tipo.nome} como favorito`
                          }
                          onClick={() => alternarFavorito(tipo.id)}
                        >
                          <Icon name="sparkles" size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <div className={styles.mainCol}>
          <section className={`card ${styles.contexto}`} aria-labelledby="relatorio-atual">
            <div className={styles.contextoTopo}>
              <div className={styles.contextoNome}>
                <h2 id="relatorio-atual">{relatorio.nome}</h2>
                {ehIa ? (
                  <span className="chip accent">
                    <Icon name="sparkles" size={12} />
                    IA
                  </span>
                ) : null}
                <span className="chip success">
                  <Icon name="checkCircle" size={13} />
                  Disponível
                </span>
              </div>

              <button
                className={`btn ghost ${styles.btnCompacto}`}
                type="button"
                aria-disabled={!temFiltro}
                onClick={temFiltro ? limparTudo : undefined}
              >
                <Icon name="undo" size={15} />
                Limpar Filtros
              </button>
            </div>

            <p className={styles.contextoSub}>
              {temFiltro
                ? `${totalFiltros === 1 ? "1 filtro pronto" : `${totalFiltros} filtros prontos`} — ${ehIa ? "clique em Gerar análise" : "clique em Consultar"}`
                : "Aguardando filtros para consultar"}
            </p>

            <div className={styles.passosLinha}>
              <ol className={styles.passos}>
                {passos.map((passo) => {
                  const concluido = passo.numero < passoAtual;
                  const atual = passo.numero === passoAtual;

                  return (
                    <li
                      className={styles.passo}
                      key={passo.numero}
                      data-estado={concluido ? "concluido" : atual ? "atual" : "pendente"}
                      aria-current={atual ? "step" : undefined}
                    >
                      {passo.numero > 1 ? (
                        <Icon className={styles.passoSeta} name="chevronRight" size={14} />
                      ) : null}
                      <span className={styles.passoNum}>
                        {concluido ? <Icon name="check" size={13} /> : passo.numero}
                      </span>
                      <span className={styles.passoTexto}>
                        <strong>{passo.titulo}</strong>
                        <span>{passo.detalhe}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>

              <span className="chip accent">Dados são carregados sob demanda</span>
            </div>
          </section>

          <section className={`card ${styles.filtros}`} aria-labelledby="titulo-filtros">
            <div className={styles.filtrosTopo}>
              <div className={styles.filtrosTitulo}>
                {/* Botão dentro do heading, e não heading dentro do botão: é o
                    padrão de acordeão do WAI-ARIA e o único que mantém HTML
                    válido. O painel recolhe para a análise de IA caber. */}
                <h2 id="titulo-filtros">
                  <button
                    className={styles.filtrosToggle}
                    type="button"
                    aria-expanded={filtrosAbertos}
                    aria-controls="painel-filtros"
                    onClick={() => setFiltrosAbertos((aberto) => !aberto)}
                  >
                    <Icon name={filtrosAbertos ? "chevronUp" : "chevronDown"} size={16} />
                    Filtros
                  </button>
                </h2>
                {filtrosAbertos ? (
                  <span className="chip info">
                    <Icon name="filter" size={12} />
                    Aplique um filtro ou use &ldquo;Carregar tudo&rdquo;
                  </span>
                ) : null}
              </div>
              <span className={styles.contador}>
                {totalFiltros === 1 ? "1 filtro aplicado" : `${totalFiltros} filtros aplicados`}
              </span>
            </div>

            <div className={styles.filtrosCorpo} id="painel-filtros" hidden={!filtrosAbertos}>
              <p className={styles.aviso}>
                <Icon name="info" size={14} />
                Para evitar carregar toda a base, escolha pelo menos um filtro abaixo e clique
                em {ehIa ? "Gerar análise" : "Consultar"}.
              </p>

              <div className={styles.grade}>
                <div className="field">
                  <label htmlFor="filtro-cliente">Cliente / Operação</label>
                  <select
                    className="select"
                    id="filtro-cliente"
                    ref={primeiroFiltroRef}
                    value={filtros.cliente}
                    onChange={(evento) => alterar("cliente", evento.target.value)}
                  >
                    <option value="">Todos os Clientes</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-campanha">Campanha</label>
                  <select
                    className="select"
                    id="filtro-campanha"
                    value={filtros.campanha}
                    onChange={(evento) => alterar("campanha", evento.target.value)}
                  >
                    <option value="">Todas as Campanhas</option>
                    {campanhas.map((campanha) => (
                      <option key={campanha.nome} value={campanha.nome}>
                        {campanha.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-avaliado">Avaliado</label>
                  <select
                    className="select"
                    id="filtro-avaliado"
                    value={filtros.avaliado}
                    onChange={(evento) => alterar("avaliado", evento.target.value)}
                  >
                    <option value="">Todos os Avaliados</option>
                    {avaliados.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-categoria">Categoria</label>
                  <select
                    className="select"
                    id="filtro-categoria"
                    value={filtros.categoria}
                    onChange={(evento) => alterar("categoria", evento.target.value)}
                  >
                    <option value="">Todas as Categorias</option>
                    {categorias.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-avaliador">Avaliador / Monitor</label>
                  <select
                    className="select"
                    id="filtro-avaliador"
                    value={filtros.avaliador}
                    onChange={(evento) => alterar("avaliador", evento.target.value)}
                  >
                    <option value="">Todos os Avaliadores</option>
                    {avaliadores.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-id">ID da Monitoria</label>
                  <input
                    className="input"
                    id="filtro-id"
                    type="text"
                    placeholder="Ex: QA-24-000123 ou 000123"
                    value={filtros.idMonitoria}
                    onChange={(evento) => alterar("idMonitoria", evento.target.value)}
                  />
                </div>

                <fieldset className={`field ${styles.periodo}`}>
                  <legend>Período de Avaliação</legend>
                  <div className={styles.periodoCampos}>
                    <span className="field">
                      <label className="sr-only" htmlFor="filtro-inicio">
                        Data inicial do período
                      </label>
                      <input
                        className="input"
                        id="filtro-inicio"
                        type="date"
                        value={filtros.inicio}
                        onChange={(evento) => alterar("inicio", evento.target.value)}
                      />
                    </span>
                    <span className="field">
                      <label className="sr-only" htmlFor="filtro-fim">
                        Data final do período
                      </label>
                      <input
                        className="input"
                        id="filtro-fim"
                        type="date"
                        value={filtros.fim}
                        onChange={(evento) => alterar("fim", evento.target.value)}
                      />
                    </span>
                  </div>
                </fieldset>
              </div>

              <div className={styles.rodape}>
                {/* Atalhos de período no rodapé, e não abaixo do campo de datas:
                    uma quarta linha de controles jogaria o resultado para fora
                    da primeira dobra em 1440x900. */}
                <div className={styles.atalhos}>
                  <span className="subtle-text">Período rápido:</span>
                  {ATALHOS_PERIODO.map((atalho) => (
                    <button
                      className={`btn ${styles.btnCompacto}`}
                      key={atalho.id}
                      type="button"
                      onClick={() => aplicarPeriodo(atalho)}
                    >
                      {atalho.rotulo}
                    </button>
                  ))}
                </div>

                <div className={styles.acoesFiltro}>
                  <button
                    className={`btn ghost ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled={!temFiltro}
                    onClick={temFiltro ? limparTudo : undefined}
                  >
                    Limpar tudo
                  </button>

                  {ehIa ? (
                    <button
                      className={`btn primary ${styles.btnCompacto}`}
                      type="button"
                      aria-disabled={gerando}
                      onClick={solicitarAnalise}
                    >
                      <Icon name="sparkles" size={15} />
                      {gerando ? "Gerando análise..." : "Gerar análise"}
                    </button>
                  ) : (
                    <>
                      <button
                        className={`btn ${styles.btnCompacto}`}
                        type="button"
                        onClick={() => consultar(true)}
                      >
                        <Icon name="download" size={15} />
                        Carregar tudo (sem filtros)
                      </button>
                      <button
                        className={`btn primary ${styles.btnCompacto}`}
                        type="button"
                        aria-disabled={!temFiltro}
                        onClick={() => consultar(false)}
                      >
                        <Icon name="search" size={15} />
                        Consultar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={`card ${styles.resultado}`} aria-labelledby="titulo-resultados">
            <div className={styles.resultadoTopo}>
              <h2 className={styles.resultadoTitulo} id="titulo-resultados">
                {ehIa ? "Análise" : "Resultados"}
                <span className="text-muted">{subtituloResultado}</span>
              </h2>

              <div className={styles.acoesResultado}>
                {ehIa ? (
                  <button
                    className={`btn ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled={gerando}
                    onClick={solicitarAnalise}
                  >
                    <Icon
                      className={gerando ? "spinning" : undefined}
                      name={gerando ? "spinner" : "refresh"}
                      size={15}
                    />
                    {gerando ? "Gerando análise..." : analise ? "Gerar novamente" : "Gerar análise"}
                  </button>
                ) : (
                  <button
                    className={`btn ghost ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled="true"
                  >
                    <Icon name="refresh" size={15} />
                    Atualizar
                  </button>
                )}

                {/* Exportação ainda não implementada — botão que abre arquivo
                    vazio é pior do que botão apagado. PDF só entra na lista dos
                    relatórios de IA: texto corrido não cabe em planilha. */}
                <span className={styles.exportar}>
                  <span className="subtle-text">Exportar:</span>
                  <button
                    className={`btn ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled="true"
                    aria-label="Exportar para Excel"
                  >
                    Excel
                  </button>
                  <button
                    className={`btn ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled="true"
                    aria-label="Exportar para CSV"
                  >
                    CSV
                  </button>
                  {ehIa ? (
                    <button
                      className={`btn ${styles.btnCompacto}`}
                      type="button"
                      aria-disabled="true"
                      aria-label="Exportar para PDF"
                    >
                      PDF
                    </button>
                  ) : null}
                </span>
              </div>
            </div>

            {ehIa ? (
              <AnaliseIa
                nomeRelatorio={relatorio.nome}
                analise={analise}
                gerando={gerando}
                erro={erroAnalise}
                desatualizada={analiseDesatualizada}
                onGerar={solicitarAnalise}
                onIrParaFiltros={irParaFiltros}
              />
            ) : (
              <div className={styles.vazio}>
                <span className="chip accent">CARREGAMENTO SOB DEMANDA</span>
                <h3>Defina os filtros para consultar</h3>
                <p>
                  Esta base contém milhares de registros. Para garantir velocidade e
                  relevância, aplique pelo menos um filtro e clique em Consultar. Para
                  exportar a base inteira sem filtros, use Carregar tudo.
                </p>

                <div className="btn-row">
                  <button
                    className={`btn primary ${styles.btnCompacto}`}
                    type="button"
                    aria-disabled={!temFiltro}
                    onClick={() => consultar(false)}
                  >
                    Consultar
                  </button>
                  <button
                    className={`btn ${styles.btnCompacto}`}
                    type="button"
                    onClick={irParaFiltros}
                  >
                    Ir para filtros
                  </button>
                  <button
                    className={`btn ${styles.btnCompacto}`}
                    type="button"
                    onClick={() => consultar(true)}
                  >
                    Carregar tudo (sem filtros)
                  </button>
                </div>

                {/* Região viva nasce vazia e no DOM desde o primeiro render: só
                    assim o leitor de tela anuncia o retorno da ação sem roubar o
                    foco. Nunca guarda os benefícios, senão trocar de estado
                    faria ele ler os três cartões inteiros. */}
                <div className={styles.status} role="status">
                  {statusConsulta ? (
                    <p className={`alert ${statusConsulta.tom}`}>
                      <Icon name={statusConsulta.icone} size={16} />
                      <span className="alert-body">{statusConsulta.texto}</span>
                    </p>
                  ) : null}
                </div>

                {statusConsulta ? null : (
                  <ul className={styles.beneficios}>
                    {BENEFICIOS.map((beneficio) => (
                      <li className={styles.beneficio} key={beneficio.id}>
                        <strong>
                          <Icon name={beneficio.icon} size={14} />
                          {beneficio.titulo}
                        </strong>
                        <span>{beneficio.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
