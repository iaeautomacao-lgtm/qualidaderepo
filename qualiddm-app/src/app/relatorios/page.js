"use client";

import { useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { baixarArquivo, formatarDataHora, formatarNumero, linhaCsv, paraIso } from "@/lib/formato";
import AnaliseIa from "./AnaliseIa";
import styles from "./page.module.css";

const POR_PAGINA = 100;

/* "" = nenhum filtro naquele campo. Um sentinela só para todos os campos deixa a
   contagem e o "limpar" triviais. As chaves são as MESMAS que a rota aceita em
   `filtros` — chave desconhecida faz o backend recusar a consulta de propósito. */
const FILTROS_VAZIOS = {
  clienteId: "",
  campanhaId: "",
  avaliadoId: "",
  categoria: "",
  avaliadorId: "",
  codigo: "",
  dataInicio: "",
  dataFim: "",
};

/**
 * Slug do catálogo -> tipo da rota de IA.
 *
 * Os dois lados nomeiam diferente: o catálogo agrupa com prefixo `ia-`, e o
 * serviço de IA nomeia pela análise. "ia-analise-ofensores" viraria
 * "analise-ofensores" numa regra automática, mas o serviço espera "ofensores" —
 * por isso o mapa é explícito, e não um `replace`.
 */
const TIPO_IA = {
  "ia-resumo-executivo": "resumo-executivo",
  "ia-analise-ofensores": "ofensores",
  "ia-plano-coaching": "coaching",
  "ia-risco-ncg": "risco-ncg",
};

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

const ROTULO_SEVERIDADE = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const TOM_SEVERIDADE = {
  critica: "danger",
  alta: "warning",
  media: "info",
  baixa: "",
};

const GRUPOS = [
  { id: "ia", titulo: "Análises com IA" },
  { id: "sistema", titulo: "Relatórios do sistema" },
];

/**
 * Conta quantos filtros o usuário realmente aplicou.
 *
 * O período conta como UM filtro mesmo com as duas datas preenchidas: para quem
 * usa a tela, "Período de Avaliação" é um campo só, e contar 2 faria o rótulo
 * mentir.
 */
function contarFiltros(filtros) {
  const simples = ["clienteId", "campanhaId", "avaliadoId", "categoria", "avaliadorId", "codigo"];
  const total = simples.filter((chave) => filtros[chave].trim() !== "").length;
  return filtros.dataInicio || filtros.dataFim ? total + 1 : total;
}

/** Só o que está preenchido vai no corpo — a rota recusa filtro vazio. */
function filtrosPreenchidos(filtros) {
  return Object.fromEntries(
    Object.entries(filtros).filter(([, valor]) => String(valor).trim() !== ""),
  );
}

/** Traduz o percentual de confiança em palavra — cor e número não bastam. */
function rotuloConfianca(percentual) {
  if (percentual >= 80) return "alta";
  if (percentual >= 60) return "média";
  return "baixa";
}

/** Adapta a resposta da rota de IA ao formato que o painel `AnaliseIa` espera. */
function adaptarAnalise(dados, filtros) {
  return {
    periodo: dados.periodo ? `${dados.periodo.inicio} a ${dados.periodo.fim}` : "período completo",
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
      // A rota devolve a evidência já em texto ("276 avaliações, 21,5%"), porque
      // quem sabe o número é o SQL, não o modelo.
      avaliacoes: null,
      percentual: achado.evidencia,
      severidade: ROTULO_SEVERIDADE[achado.severidade] ?? achado.severidade,
      tom: TOM_SEVERIDADE[achado.severidade] ?? "",
    })),
    recomendacoes: (dados.recomendacoes ?? []).map((recomendacao, indice) => ({
      id: `recomendacao-${indice}`,
      acao: recomendacao.acao,
      responsavel: recomendacao.responsavel,
      impacto: recomendacao.impactoEsperado,
    })),
    recorte: contarFiltros(filtros),
    geradoEm: formatarDataHora(new Date()),
    // Guarda o recorte que originou a análise para a tela avisar quando os
    // filtros mudarem depois.
    assinatura: JSON.stringify(filtros),
  };
}

export default function RelatoriosPage() {
  const [slugSelecionado, setSlugSelecionado] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [pagina, setPagina] = useState(0);

  // Consulta tabular: estado próprio porque ela é SOB DEMANDA. `useRecurso`
  // buscaria na montagem, que é exatamente o que esta tela evita.
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [analise, setAnalise] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erroAnalise, setErroAnalise] = useState("");

  // Estrelas alteradas nesta sessão, sobrepostas ao que veio do banco. Evita
  // recarregar o catálogo inteiro a cada clique na estrela.
  const [favoritosLocais, setFavoritosLocais] = useState({});

  const primeiroFiltroRef = useRef(null);

  /* Catálogo da coluna esquerda: vem do banco com a estrela do usuário logado.
     `relatorio_tipos` é a fonte — e é a mesma que o backend consulta para saber
     se o slug existe, então a lista nunca oferece um relatório que a execução
     recusaria. */
  const {
    dados: catalogo,
    carregando: carregandoTipos,
    erro: erroTipos,
  } = useRecurso("/api/relatorios");

  /* Opções dos selects vêm do catálogo do banco, não de uma amostra de
     avaliações: derivar do que já está carregado esconderia clientes e campanhas
     que ficaram fora do recorte, e o usuário não teria como filtrar por eles. */
  const { dados: opcoesApi, erro: erroOpcoes } = useRecurso("/api/relatorios/opcoes");

  const tipos = useMemo(() => catalogo?.tipos ?? [], [catalogo]);

  const opcoes = {
    clientes: opcoesApi?.clientes ?? [],
    campanhas: opcoesApi?.campanhas ?? [],
    avaliados: opcoesApi?.avaliados ?? [],
    avaliadores: opcoesApi?.avaliadores ?? [],
    categorias: opcoesApi?.categorias ?? [],
  };

  // Antes do catálogo chegar não há relatório selecionado: a tela mostra o
  // esqueleto da lista em vez de fingir uma seleção que o backend não conhece.
  const relatorio =
    tipos.find((tipo) => tipo.slug === slugSelecionado) ??
    tipos.find((tipo) => tipo.grupo === "sistema") ??
    tipos[0] ??
    null;

  const ehIa = Boolean(relatorio?.ia);
  const totalFiltros = useMemo(() => contarFiltros(filtros), [filtros]);
  const temFiltro = totalFiltros > 0;
  const analiseDesatualizada =
    Boolean(analise) && analise.assinatura !== JSON.stringify(filtros);

  function favoritoDe(tipo) {
    return favoritosLocais[tipo.slug] ?? tipo.favorito;
  }

  function limparResultado() {
    setResultado(null);
    setErroConsulta(null);
    setAviso(null);
    setPagina(0);
  }

  function alterar(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    // Trocar o recorte invalida o resultado anterior: mantê-lo na tela faria o
    // usuário ler números de um filtro que não está mais aplicado.
    limparResultado();
  }

  function limparTudo() {
    setFiltros(FILTROS_VAZIOS);
    limparResultado();
  }

  async function alternarFavorito(tipo) {
    const proximo = !favoritoDe(tipo);
    // Otimista: a estrela responde na hora. Se a rota falhar, ela volta ao
    // estado anterior — melhor do que um clique que não faz nada por 300ms.
    setFavoritosLocais((atual) => ({ ...atual, [tipo.slug]: proximo }));

    try {
      await enviarApi("/api/relatorios/favoritos", { slug: tipo.slug });
    } catch {
      setFavoritosLocais((atual) => ({ ...atual, [tipo.slug]: !proximo }));
    }
  }

  function selecionarTipo(tipo) {
    setSlugSelecionado(tipo.slug);
    // Cada relatório tem o seu resultado: manter o anterior daria a impressão de
    // que ele vale para o relatório novo.
    limparResultado();
    setAnalise(null);
    setErroAnalise("");
    setFiltrosAbertos(true);
  }

  function aplicarPeriodo(atalho) {
    const hoje = new Date();
    const inicio =
      atalho.dias === null
        ? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
        : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (atalho.dias - 1));

    setFiltros((atual) => ({ ...atual, dataInicio: paraIso(inicio), dataFim: paraIso(hoje) }));
    limparResultado();
  }

  async function consultar({ carregarTudo = false, paginaDestino = 0 } = {}) {
    if (consultando || !relatorio) return;

    if (!carregarTudo && !temFiltro) {
      setAviso({
        tom: "warning",
        icone: "alert",
        texto:
          "Escolha pelo menos um filtro antes de consultar, ou use “Carregar tudo (sem filtros)”.",
      });
      return;
    }

    setConsultando(true);
    setErroConsulta(null);
    setAviso(null);

    try {
      const dados = await enviarApi("/api/relatorios", {
        slug: relatorio.slug,
        filtros: carregarTudo ? {} : filtrosPreenchidos(filtros),
        carregarTudo,
        limit: POR_PAGINA,
        offset: paginaDestino * POR_PAGINA,
        formato: "tela",
      });

      setResultado({
        colunas: dados.colunas ?? [],
        linhas: dados.linhas ?? [],
        total: dados.paginacao?.total ?? (dados.linhas ?? []).length,
        duracaoMs: dados.duracaoMs ?? null,
        aviso: dados.aviso ?? null,
        consultadoEm: formatarDataHora(new Date()),
        carregarTudo,
      });
      setPagina(paginaDestino);
      // Com resultado na tela, o painel de filtros recolhe: a leitura passa a ser
      // a tarefa, e é o que libera altura para a tabela.
      setFiltrosAbertos(false);
    } catch (causa) {
      setResultado(null);
      // `filtrosAceitos` vem do backend quando o relatório não suporta um filtro
      // enviado. Mostrar a lista é a diferença entre "deu erro" e "este relatório
      // não filtra por campanha".
      setErroConsulta({
        mensagem: causa.message,
        filtrosAceitos: causa.detalhes?.filtrosAceitos ?? null,
      });
    } finally {
      setConsultando(false);
    }
  }

  async function solicitarAnalise() {
    if (gerando || !relatorio) return;

    setGerando(true);
    setErroAnalise("");

    try {
      const dados = await enviarApi("/api/relatorios/ia", {
        tipo: TIPO_IA[relatorio.slug] ?? relatorio.slug,
        clienteId: filtros.clienteId || null,
        campanhaId: filtros.campanhaId || null,
        avaliadoId: filtros.avaliadoId || null,
        avaliadorId: filtros.avaliadorId || null,
        categoria: filtros.categoria || null,
        dataInicio: filtros.dataInicio || null,
        dataFim: filtros.dataFim || null,
      });

      setAnalise(adaptarAnalise(dados, filtros));
      setFiltrosAbertos(false);
    } catch (causa) {
      setErroAnalise(causa.message);
    } finally {
      setGerando(false);
    }
  }

  function irParaFiltros() {
    setFiltrosAbertos(true);
    // O foco só existe depois de o painel voltar a ser exibido.
    requestAnimationFrame(() => primeiroFiltroRef.current?.focus());
  }

  /* CSV sai no cliente: as linhas já estão na tela, e uma segunda ida ao servidor
     só somaria espera. Planilha binária não se monta no navegador sem carregar
     uma biblioteca inteira — o Excel fica com o backend. */
  function exportarCsv() {
    if (!resultado) return;

    const cabecalho = resultado.colunas.map((coluna) => coluna.titulo);
    const linhas = resultado.linhas.map((linha) =>
      linhaCsv(resultado.colunas.map((coluna) => linha[coluna.chave])),
    );

    baixarArquivo(
      `${relatorio.slug}.csv`,
      // BOM na frente: sem ele o Excel abre acentuação quebrada no Windows.
      `﻿${[linhaCsv(cabecalho), ...linhas].join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  }

  const paginas = resultado ? Math.max(1, Math.ceil(resultado.total / POR_PAGINA)) : 1;

  // Passo 1 conclui quando há relatório; o passo 2 quando existe filtro.
  const passoAtual = temFiltro ? 3 : 2;
  const passos = [
    { numero: 1, titulo: "Relatório selecionado", detalhe: relatorio?.nome ?? "Carregando..." },
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
    : resultado
      ? ` · ${formatarNumero(resultado.total)} registros`
      : " · Aguardando consulta";

  const totalIa = tipos.filter((tipo) => tipo.ia).length;
  const indisponivel = Boolean(relatorio) && !ehIa && relatorio.disponivel === false;

  return (
    <AppShell active="Relatórios" breadcrumb="Avaliações > Relatórios">
      <section className={styles.pageHead}>
        <h1>Relatórios</h1>
        <p className="text-muted">
          {carregandoTipos && tipos.length === 0
            ? "Carregando catálogo..."
            : `${tipos.length} relatórios disponíveis, ${totalIa} com IA`}
        </p>
      </section>

      <div className={styles.board}>
        <section className={`card ${styles.rail}`} aria-labelledby="tipos-relatorio">
          <div className={styles.railHead}>
            <h2 id="tipos-relatorio">Tipos de Relatórios</h2>
            <p>Selecione um relatório</p>
          </div>

          {/* Única região com rolagem própria da tela: são 18 relatórios e a
              página inteira não pode rolar em 1440x900. Não precisa de tabindex
              — os botões de dentro já levam o teclado até aqui. */}
          <div className={styles.railList}>
            {erroTipos ? (
              <p className="alert danger">
                <Icon name="error" size={16} />
                <span className="alert-body">
                  <strong>Catálogo indisponível</strong>
                  <span>{erroTipos}</span>
                </span>
              </p>
            ) : carregandoTipos && tipos.length === 0 ? (
              <ul className={styles.grupoLista} aria-hidden="true">
                {Array.from({ length: 8 }, (_, indice) => (
                  <li key={indice}>
                    <span className={`skeleton ${styles.esqueletoTipo}`} />
                  </li>
                ))}
              </ul>
            ) : (
              GRUPOS.map((grupo) => {
                const itens = tipos.filter((tipo) => tipo.grupo === grupo.id);
                if (itens.length === 0) return null;

                return (
                  <section
                    className={styles.grupo}
                    key={grupo.id}
                    aria-labelledby={`grupo-${grupo.id}`}
                  >
                    <h3 className="label-micro" id={`grupo-${grupo.id}`}>
                      {grupo.titulo}
                    </h3>

                    <ul className={styles.grupoLista}>
                      {itens.map((tipo) => {
                        const favorito = favoritoDe(tipo);
                        const selecionado = tipo.slug === relatorio?.slug;

                        return (
                          <li className={styles.tipo} key={tipo.slug}>
                            <button
                              className={styles.tipoBtn}
                              type="button"
                              aria-current={selecionado ? "true" : undefined}
                              onClick={() => selecionarTipo(tipo)}
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

                            {/* aria-pressed carrega o estado; o rótulo diz a ação
                                e o nome do relatório, porque dezenas de botões
                                iguais sem nome são inúteis em leitor de tela. */}
                            <button
                              className={styles.estrela}
                              type="button"
                              aria-pressed={favorito}
                              aria-label={
                                favorito
                                  ? `Remover ${tipo.nome} dos favoritos`
                                  : `Marcar ${tipo.nome} como favorito`
                              }
                              onClick={() => alternarFavorito(tipo)}
                            >
                              <Icon name="star" size={15} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </section>

        <div className={styles.mainCol}>
          <section className={`card ${styles.contexto}`} aria-labelledby="relatorio-atual">
            <div className={styles.contextoTopo}>
              <div className={styles.contextoNome}>
                <h2 id="relatorio-atual">{relatorio?.nome ?? "Relatórios"}</h2>
                {ehIa ? (
                  <span className="chip accent">
                    <Icon name="sparkles" size={12} />
                    IA
                  </span>
                ) : null}
                {relatorio ? (
                  <span className={indisponivel ? "chip warning" : "chip success"}>
                    <Icon name={indisponivel ? "alert" : "checkCircle"} size={13} />
                    {indisponivel ? "Em preparação" : "Disponível"}
                  </span>
                ) : null}
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
              {relatorio?.descricao ??
                (temFiltro ? "Pronto para consultar" : "Aguardando filtros para consultar")}
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
                    válido. O painel recolhe para o resultado caber. */}
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
                Para evitar carregar toda a base, escolha pelo menos um filtro abaixo e clique em{" "}
                {ehIa ? "Gerar análise" : "Consultar"}.
              </p>

              {/* Opções indisponíveis não deixam a tela muda: sem elas os selects
                  ficariam vazios sem explicar por quê. */}
              {erroOpcoes ? (
                <p className="alert warning">
                  <Icon name="alert" size={16} />
                  <span className="alert-body">
                    <strong>Não foi possível carregar as opções de filtro</strong>
                    <span>
                      {erroOpcoes} Você ainda pode filtrar por ID da monitoria e por período.
                    </span>
                  </span>
                </p>
              ) : null}

              <div className={styles.grade}>
                <div className="field">
                  <label htmlFor="filtro-cliente">Cliente / Operação</label>
                  <select
                    className="select"
                    id="filtro-cliente"
                    ref={primeiroFiltroRef}
                    value={filtros.clienteId}
                    onChange={(evento) => alterar("clienteId", evento.target.value)}
                  >
                    <option value="">Todos os Clientes</option>
                    {opcoes.clientes.map((cliente) => (
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
                    value={filtros.campanhaId}
                    onChange={(evento) => alterar("campanhaId", evento.target.value)}
                  >
                    <option value="">Todas as Campanhas</option>
                    {/* Com cliente escolhido, só as campanhas dele: a lista
                        inteira tem dezenas de nomes de outros clientes. */}
                    {opcoes.campanhas
                      .filter(
                        (campanha) =>
                          !filtros.clienteId || campanha.clienteId === filtros.clienteId,
                      )
                      .map((campanha) => (
                        <option key={campanha.id} value={campanha.id}>
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
                    value={filtros.avaliadoId}
                    onChange={(evento) => alterar("avaliadoId", evento.target.value)}
                  >
                    <option value="">Todos os Avaliados</option>
                    {opcoes.avaliados.map((avaliado) => (
                      <option key={avaliado.id} value={avaliado.id}>
                        {avaliado.nome}
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
                    {opcoes.categorias.map((categoria) => {
                      const valor = typeof categoria === "string" ? categoria : categoria.nome;
                      return (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="filtro-avaliador">Avaliador / Monitor</label>
                  <select
                    className="select"
                    id="filtro-avaliador"
                    value={filtros.avaliadorId}
                    onChange={(evento) => alterar("avaliadorId", evento.target.value)}
                  >
                    <option value="">Todos os Avaliadores</option>
                    {opcoes.avaliadores.map((avaliador) => (
                      <option key={avaliador.id} value={avaliador.id}>
                        {avaliador.nome}
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
                    value={filtros.codigo}
                    onChange={(evento) => alterar("codigo", evento.target.value)}
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
                        max={filtros.dataFim || undefined}
                        value={filtros.dataInicio}
                        onChange={(evento) => alterar("dataInicio", evento.target.value)}
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
                        min={filtros.dataInicio || undefined}
                        value={filtros.dataFim}
                        onChange={(evento) => alterar("dataFim", evento.target.value)}
                      />
                    </span>
                  </div>
                </fieldset>
              </div>

              <div className={styles.rodape}>
                {/* Atalhos de período no rodapé, e não abaixo do campo de datas:
                    uma quarta linha de controles jogaria o resultado para fora da
                    primeira dobra em 1440x900. */}
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
                      disabled={gerando || !relatorio}
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
                        disabled={consultando || !relatorio}
                        onClick={() => consultar({ carregarTudo: true })}
                      >
                        <Icon name="download" size={15} />
                        Carregar tudo (sem filtros)
                      </button>
                      <button
                        className={`btn primary ${styles.btnCompacto}`}
                        type="button"
                        disabled={consultando || !relatorio}
                        aria-disabled={!temFiltro}
                        onClick={() => consultar()}
                      >
                        <Icon
                          className={consultando ? "spinning" : undefined}
                          name={consultando ? "spinner" : "search"}
                          size={15}
                        />
                        {consultando ? "Consultando..." : "Consultar"}
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
                    disabled={gerando || !relatorio}
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
                  <>
                    <button
                      className={`btn ghost ${styles.btnCompacto}`}
                      type="button"
                      disabled={consultando || !resultado}
                      onClick={() =>
                        consultar({
                          carregarTudo: resultado?.carregarTudo ?? false,
                          paginaDestino: pagina,
                        })
                      }
                    >
                      <Icon
                        className={consultando ? "spinning" : undefined}
                        name={consultando ? "spinner" : "refresh"}
                        size={15}
                      />
                      Atualizar
                    </button>

                    {/* Exportação só existe quando há o que exportar: botão que
                        baixa arquivo vazio é pior do que botão apagado.

                        Um botão só, e rotulado "CSV (abre no Excel)": o CSV sai
                        com BOM, que é o que faz o Excel respeitar a acentuação.
                        Um segundo botão escrito "Excel" que baixasse o mesmo CSV
                        seria propaganda enganosa; um .xlsx de verdade depende de
                        a rota servir o arquivo binário.

                        TODO backend: a rota aceita `formato: "excel"`, mas ainda
                        responde JSON — falta servir o .xlsx como download. */}
                    <span className={styles.exportar}>
                      <span className="subtle-text">Exportar:</span>
                      <button
                        className={`btn ${styles.btnCompacto}`}
                        type="button"
                        disabled={!resultado}
                        onClick={exportarCsv}
                      >
                        <Icon name="download" size={15} />
                        CSV (abre no Excel)
                      </button>
                    </span>
                  </>
                )}
              </div>
            </div>

            {ehIa ? (
              <AnaliseIa
                nomeRelatorio={relatorio?.nome ?? "Análise"}
                analise={analise}
                gerando={gerando}
                erro={erroAnalise}
                desatualizada={analiseDesatualizada}
                onGerar={solicitarAnalise}
                onIrParaFiltros={irParaFiltros}
              />
            ) : erroConsulta ? (
              <div className="empty-state">
                <span className="icon-badge danger">
                  <Icon name="error" size={22} />
                </span>
                <h3>Não foi possível consultar o relatório</h3>
                <p>{erroConsulta.mensagem}</p>
                {erroConsulta.filtrosAceitos ? (
                  <p className="subtle-text">
                    Filtros aceitos por este relatório: {erroConsulta.filtrosAceitos.join(", ")}.
                  </p>
                ) : null}
                <div className="btn-row">
                  <button className="btn primary" type="button" onClick={irParaFiltros}>
                    <Icon name="filter" size={16} />
                    Revisar filtros
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => consultar({ paginaDestino: pagina })}
                  >
                    <Icon name="refresh" size={16} />
                    Tentar novamente
                  </button>
                </div>
              </div>
            ) : consultando ? (
              <>
                <EsqueletoTabela colunas={6} linhas={8} />
                <p className="sr-only" role="status">
                  Consultando o relatório {relatorio?.nome}.
                </p>
              </>
            ) : resultado ? (
              <div className={styles.tabelaBloco}>
                <p className={styles.resultadoMeta} role="status">
                  {formatarNumero(resultado.total)}{" "}
                  {resultado.total === 1 ? "registro" : "registros"} · consultado em{" "}
                  {resultado.consultadoEm}
                  {resultado.duracaoMs != null ? ` · ${resultado.duracaoMs} ms` : ""}
                  {resultado.carregarTudo ? " · sem filtros" : ""}
                </p>

                {resultado.aviso ? (
                  <p className="alert warning">
                    <Icon name="alert" size={16} />
                    <span className="alert-body">{resultado.aviso}</span>
                  </p>
                ) : null}

                {resultado.linhas.length === 0 ? (
                  <div className="empty-state">
                    <span className="icon-badge">
                      <Icon name="filter" size={22} />
                    </span>
                    <h3>Nenhum registro no recorte</h3>
                    <p>
                      A consulta rodou, mas nada corresponde a estes filtros. Amplie o período ou
                      remova um filtro.
                    </p>
                    <div className="btn-row">
                      <button className="btn" type="button" onClick={irParaFiltros}>
                        <Icon name="filter" size={16} />
                        Ajustar filtros
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Região focável: as células deste relatório são texto puro,
                        sem link nem botão, então sem `tabIndex` o teclado não
                        teria como rolar a tabela — nem na horizontal nem dentro
                        do `max-height` (WCAG 2.1.1). O nome acessível vem do
                        `aria-label`, senão o foco pararia num "grupo" sem
                        identificação. */}
                    <div
                      className="table-scroll"
                      role="region"
                      aria-label={`Resultados de ${relatorio?.nome ?? "relatório"} — use as setas para rolar`}
                      tabIndex={0}
                    >
                      <table className="data-table branded">
                        <caption className="sr-only">
                          {relatorio?.nome} — exibindo{" "}
                          {formatarNumero(resultado.linhas.length)} de{" "}
                          {formatarNumero(resultado.total)} linhas.
                        </caption>
                        <thead>
                          <tr>
                            {resultado.colunas.map((coluna) => (
                              <th
                                className={coluna.tipo === "numero" ? "num" : undefined}
                                key={coluna.chave}
                                scope="col"
                              >
                                {coluna.titulo}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.linhas.map((linha, indice) => (
                            // Vários relatórios são agregações e não têm id
                            // próprio; nesses o índice é a única chave estável.
                            <tr key={linha.id ?? linha.codigo ?? indice}>
                              {resultado.colunas.map((coluna) => (
                                <td
                                  className={coluna.tipo === "numero" ? "num" : undefined}
                                  key={coluna.chave}
                                >
                                  {formatarCelula(linha[coluna.chave], coluna.tipo)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {paginas > 1 ? (
                      <nav className="pagination" aria-label="Paginação do relatório">
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={pagina === 0 || consultando}
                          onClick={() =>
                            consultar({
                              carregarTudo: resultado.carregarTudo,
                              paginaDestino: pagina - 1,
                            })
                          }
                        >
                          <Icon name="chevronLeft" size={15} />
                          Anterior
                        </button>
                        <span aria-live="polite">
                          Página {pagina + 1} de {paginas}
                        </span>
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={pagina >= paginas - 1 || consultando}
                          onClick={() =>
                            consultar({
                              carregarTudo: resultado.carregarTudo,
                              paginaDestino: pagina + 1,
                            })
                          }
                        >
                          Próxima
                          <Icon name="chevronRight" size={15} />
                        </button>
                      </nav>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className={styles.vazio}>
                <span className="chip accent">CARREGAMENTO SOB DEMANDA</span>
                <h3>Defina os filtros para consultar</h3>
                <p>
                  Esta base contém milhares de registros. Para garantir velocidade e relevância,
                  aplique pelo menos um filtro e clique em Consultar. Para exportar a base inteira
                  sem filtros, use Carregar tudo.
                </p>

                <div className="btn-row">
                  <button
                    className={`btn primary ${styles.btnCompacto}`}
                    type="button"
                    disabled={!relatorio}
                    aria-disabled={!temFiltro}
                    onClick={() => consultar()}
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
                    disabled={!relatorio}
                    onClick={() => consultar({ carregarTudo: true })}
                  >
                    Carregar tudo (sem filtros)
                  </button>
                </div>

                {/* Região viva nasce vazia e no DOM desde o primeiro render: só
                    assim o leitor de tela anuncia o retorno da ação sem roubar o
                    foco. Nunca guarda os benefícios, senão trocar de estado faria
                    ele ler os três cartões inteiros. */}
                <div className={styles.status} role="status">
                  {aviso ? (
                    <p className={`alert ${aviso.tom}`}>
                      <Icon name={aviso.icone} size={16} />
                      <span className="alert-body">{aviso.texto}</span>
                    </p>
                  ) : null}
                </div>

                {aviso ? null : (
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

/**
 * Formata a célula conforme o tipo declarado pela coluna.
 *
 * O backend já entrega data e hora prontas na maioria dos relatórios, então aqui
 * só tratamos o que chega cru: booleano (0/1 viraria "0" na tela) e nulo, que
 * precisa do travessão para não deixar a célula vazia sem explicação.
 */
function formatarCelula(valor, tipo) {
  if (valor == null || valor === "") return "—";
  if (tipo === "booleano") return Number(valor) === 1 || valor === true ? "Sim" : "Não";
  if (tipo === "numero") return formatarNumero(valor);
  return String(valor);
}
