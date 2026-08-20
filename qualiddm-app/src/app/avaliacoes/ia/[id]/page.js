"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import ChatIa from "@/components/ChatIa";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import {
  ROTULO_SEVERIDADE,
  contarConformidade,
  criticidadeDaAvaliacao,
  impactoDaNota,
  nivelConfianca,
  normalizarSecoes,
  nota,
  ou,
  percentual,
  problemasOrdenados,
} from "../analise";
import styles from "./page.module.css";

/**
 * Avaliação IA — "qual foi o resultado?" primeiro, "por quê?" depois.
 *
 * Ordem da tela: cabeçalho executivo (resultado) -> player (a fonte) ->
 * critérios em accordion (a evidência) -> resumo fixo à direita (o apoio).
 *
 * Por que accordion e não tudo aberto: uma ficha de 24 critérios com evidência,
 * raciocínio e peso em cada um dá uma página de rolagem infinita, e o critério
 * que importa — o não conforme — fica perdido no meio dos conformes. Abrem
 * fechados; os NÃO CONFORMES abrem sozinhos, porque são o motivo de alguém
 * entrar aqui.
 */

/* Falhas primeiro. A ordem anterior comecava em "Todos", e numa avaliacao com
   quatro nao conformidades entre dezessete criterios isso faz o supervisor
   procurar o problema em vez de receber ele. */
const FILTROS = [
  { id: "nao_conforme", rotulo: "Não conformes", alerta: true },
  { id: "todos", rotulo: "Todos" },
  { id: "conforme", rotulo: "Conformes" },
  { id: "nao_aplicavel", rotulo: "Não aplicáveis" },
];

const ROTULO_STATUS = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não aplicável",
  revisar: "Revisar",
};

const TOM_STATUS = {
  conforme: "success",
  nao_conforme: "danger",
  nao_aplicavel: "warning",
  revisar: "info",
};

const ICONE_STATUS = {
  conforme: "checkCircle",
  nao_conforme: "error",
  nao_aplicavel: "info",
  revisar: "alert",
};

export default function AvaliacaoIaPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}` : null,
  );
  /* Abre em "Não conformes" quando ha falha: e o que a tela existe para mostrar.
     `useState` com funcao porque o valor depende dos dados da primeira carga --
     e um `useEffect` que corrigisse o filtro depois faria a lista piscar. */
  const [filtro, setFiltro] = useState(null);
  /* Pedido de salto no áudio. O `nonce` faz dois cliques no MESMO trecho
     valerem: sem ele o objeto seria igual e o player não reagiria. */
  const [salto, setSalto] = useState(null);
  const paginaRef = useRef(null);
  const restaurar = useRef(null);

  /**
   * No papel, todo critério sai aberto.
   *
   * Não dá para resolver isso no @media print: o conteúdo de um `<details>`
   * fechado é escondido pelo próprio navegador, e CSS de página não alcança.
   * Então o `open` é ligado em todos antes de imprimir e devolvido ao estado
   * anterior depois — quem imprimiu não perde a tela como estava.
   */
  useEffect(() => {
    function abrirTudo() {
      const abertos = new Set();
      for (const item of paginaRef.current?.querySelectorAll("details") ?? []) {
        if (item.open) abertos.add(item);
        else item.open = true;
      }
      restaurar.current = () => {
        for (const item of paginaRef.current?.querySelectorAll("details") ?? []) {
          item.open = abertos.has(item);
        }
      };
    }

    function devolver() {
      restaurar.current?.();
    }

    window.addEventListener("beforeprint", abrirTudo);
    window.addEventListener("afterprint", devolver);
    return () => {
      window.removeEventListener("beforeprint", abrirTudo);
      window.removeEventListener("afterprint", devolver);
    };
  }, []);

  const gravacao = dados?.gravacao ?? null;
  const analise = gravacao?.transcricao?.segmentos ?? null;
  const secoes = useMemo(() => normalizarSecoes(analise), [analise]);
  // Resumo em três partes, quando a análise foi gerada depois desta versão.
  const estruturado = analise?.resumoEstruturado ?? null;

  if (carregando && !gravacao) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${id || ""}`}>
        <div className={styles.esqueleto} aria-busy="true" aria-live="polite">
          <span className="sr-only">Carregando a avaliação da IA.</span>
          <div className={`skeleton ${styles.esqueletoHero}`} />
          <div className={`skeleton ${styles.esqueletoBloco}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
        </div>
      </AppShell>
    );
  }

  if (erro || !gravacao) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${id || ""}`}>
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h1>Não foi possível abrir a avaliação</h1>
            <p>{erro || "A gravação não foi encontrada no banco."}</p>
            {/* "Gravação não encontrada" quer dizer que o id da URL não existe em
                `gravacoes` — não que a análise falhou. Quem cai aqui precisa da
                fila de transcrições, que mostra o que de fato foi enviado e em que
                estado está. Sem este caminho, a tela é um beco. */}
            <p className={styles.dicaErro}>
              O identificador <strong>{id}</strong> não corresponde a nenhuma gravação. Se você
              acabou de enviar um arquivo, confira a fila de transcrições: lá aparecem os envios
              recebidos e, quando a análise falha, o motivo.
            </p>
            <div className="btn-row">
              <Link className="btn primary" href="/transcricoes">
                <Icon name="waveform" size={16} />
                Ver fila de transcrições
              </Link>
              <button className="btn" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar de novo
              </button>
              <Link className="btn" href="/avaliacoes">
                <Icon name="chevronLeft" size={16} />
                Voltar para Avaliações
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const codigo = analise?.codigo || `ID ${id}`;

  // Sem ficha estruturada não há o que avaliar: a recuperação é na tela da
  // transcrição, que é onde fica o botão de gerar a análise.
  if (!analise) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${codigo}`}>
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge warning">
              <Icon name="info" size={22} />
            </span>
            <h1>Esta gravação ainda não tem avaliação</h1>
            <p>
              {gravacao.transcricao?.erro ||
                "Não há critérios, nota nem evidências salvos para esta gravação."}
            </p>
            <div className="btn-row">
              <Link className="btn primary" href={`/transcricoes/${encodeURIComponent(id)}`}>
                <Icon name="waveform" size={16} />
                Abrir a transcrição e gerar a avaliação
              </Link>
              <Link className="btn" href="/avaliacoes">
                <Icon name="chevronLeft" size={16} />
                Voltar para Avaliações
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const resumo = contarConformidade(analise, secoes);
  const impacto = impactoDaNota(secoes);
  const criticidade = criticidadeDaAvaliacao({ analise, secoes, impacto, resumo });
  const faixa = faixaDaNota(analise.nota);
  const confianca = analise.confianca ?? gravacao.transcricao?.confianca;
  const nivel = nivelConfianca(confianca);
  const duracao = analise.duracao || gravacao.duracao;
  const problemas = problemasOrdenados(secoes);
  const criterios = secoes.flatMap((secao) => secao.criterios || []);

  /* Filtro efetivo: `null` significa "ainda nao escolhido" e cai em nao
     conformes quando existem, senao em todos. Guardar a escolha explicita do
     usuario separada do default evita que a lista pule quando os dados chegam. */
  const filtroEfetivo = filtro ?? (resumo.naoConformes > 0 ? "nao_conforme" : "todos");

  /* Pontos por secao: obtido, total e perdido. `impactoDaNota` ja calcula isso
     com a mesma regra da nota -- eliminatorio e nao aplicavel fora da base. */
  /* Sem `useMemo`: este ponto do componente esta DEPOIS dos returns de
     carregando/erro, e hook depois de return condicional quebra a ordem entre
     renders. O calculo e uma varredura de meia duzia de secoes -- memoizar
     custaria mais em risco que em CPU. */
  const pontosPorSecao = (() => {
    const mapa = new Map();
    for (const secao of impacto.ofensoras) mapa.set(secao.ancora, secao);
    for (const secao of secoes) {
      if (mapa.has(secao.ancora)) continue;
      const total = (secao.criterios || []).reduce((soma, criterio) => {
        if (criterio.eliminatoria || criterio.statusChave === "nao_aplicavel") return soma;
        return soma + Math.max(0, Number(criterio.peso) || 0);
      }, 0);
      mapa.set(secao.ancora, { ancora: secao.ancora, total, perdido: 0 });
    }
    // `obtido` derivado, para a tela nao repetir a subtracao em tres lugares.
    for (const [chave, valor] of mapa) {
      mapa.set(chave, { ...valor, obtido: Math.max(0, valor.total - valor.perdido) });
    }
    return mapa;
  })();

  const contagemFiltro = {
    todos: criterios.length,
    nao_conforme: resumo.naoConformes,
    conforme: resumo.conformes,
    nao_aplicavel: resumo.naoAplicaveis,
  };

  const visiveis =
    filtroEfetivo === "todos"
      ? secoes
      : secoes
          .map((secao) => ({
            ...secao,
            criterios: secao.criterios.filter((item) => item.statusChave === filtroEfetivo),
          }))
          .filter((secao) => secao.criterios.length > 0);

  /* Critérios eliminatórios reprovados: é o que zera, e é o que a explicação do
     zero precisa NOMEAR. "Um critério eliminatório ficou não conforme" não diz
     qual, e a primeira pergunta de quem lê é exatamente qual. */
  const eliminatoriosFalhos = problemas.filter((problema) => problema.eliminatoria);

  /* A nota que sairia dos pesos, sem a regra do eliminatório. É o número que
     desfaz a leitura de contradição entre "0/100" e "65 de 77". */
  const notaBase =
    impacto.total > 0 ? Math.round((impacto.obtido / impacto.total) * 1000) / 10 : null;

  /* Quatro medidas, e nenhuma repetindo outra. Saiu "Criticidade", que dizia com
     outras palavras o que o selo "Zerada" e o bloco de explicação já dizem, e
     saiu "Duração", que não é resultado — foi para a linha de identificação e
     para o player, onde tem uso. */
  const kpis = [
    {
      rotulo: "Nota final",
      valor: `${nota(analise.nota)} / 100`,
      nota: analise.zerada ? "zerada por eliminatório" : faixa.rotulo,
      tom: faixa.tom,
      destaque: true,
    },
    {
      rotulo: "Pontuação base",
      valor: impacto.total > 0 ? `${impacto.obtido} / ${impacto.total}` : "N/A",
      nota:
        notaBase == null
          ? "sem peso cadastrado"
          : `${String(notaBase).replace(".", ",")}% antes do eliminatório`,
    },
    {
      rotulo: "Não conformes",
      valor: String(resumo.naoConformes),
      nota:
        eliminatoriosFalhos.length > 0
          ? `${eliminatoriosFalhos.length} eliminatório(s)`
          : `de ${resumo.total} critérios`,
      tom: resumo.naoConformes > 0 ? "danger" : "success",
    },
    {
      rotulo: "Confiança",
      valor: percentual(confianca) || "N/A",
      nota: `Leitura ${nivel.rotulo.toLowerCase()}`,
      tom: nivel.tom,
    },
  ];

  /* Marcadores do player: uma falha por marcador, só as que a IA soube situar no
     áudio. Documento e chat não têm tempo, então a lista vem vazia e o player
     fica como sempre foi. */
  const marcadores = problemas
    .filter((problema) => problema.momento)
    .map((problema) => ({
      id: `marca-${problema.id}`,
      segundos: problema.momento.segundos,
      rotulo: problema.nome,
      tom: problema.eliminatoria ? "danger" : "warning",
    }));

  return (
    <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${codigo}`}>
      <div className={styles.pagina} ref={paginaRef}>
        {/* Cabeçalho executivo: identificação numa linha, resultado numa faixa.
            Antes nota, confiança, duração, status, resumo e player disputavam a
            mesma dobra e nenhum vencia. */}
        <header className={styles.hero}>
          <div className={styles.heroTopo}>
            <div className={styles.heroIdent}>
              <p className={styles.heroSobre}>Avaliação automática</p>
              <h1>
                <span className={styles.heroCodigo}>
                  {codigo}
                  <BotaoCopiar valor={String(codigo)} rotulo="código da avaliação" />
                </span>
              </h1>
              <p className={styles.heroLinha}>
                {ou(gravacao.cliente)}
                <span aria-hidden="true">•</span>
                {ou(gravacao.enviadaEm)}
                <span aria-hidden="true">•</span>
                {ou(gravacao.avaliado, "operador não informado")}
                {duracao && duracao !== "N/A" ? (
                  <>
                    <span aria-hidden="true">•</span>
                    {duracao}
                  </>
                ) : null}
              </p>
            </div>

            <div className={styles.heroDireita}>
              <span className={`chip ${faixa.tom} ${styles.selo}`}>
                <Icon name={faixa.tom === "success" ? "checkCircle" : "alert"} size={14} />
                {analise.zerada ? "Zerada" : faixa.rotulo}
              </span>
              <div className={styles.heroAcoes}>
                <Link className="btn primary" href={`/avaliacoes/ia/${encodeURIComponent(id)}/resumo`}>
                  <Icon name="gauge" size={16} />
                  Resumo executivo
                </Link>
                <Link className="btn" href={`/transcricoes/${encodeURIComponent(id)}`}>
                  <Icon name="waveform" size={16} />
                  Transcrição
                </Link>
                <button className="btn" type="button" onClick={() => window.print()}>
                  <Icon name="printer" size={16} />
                  Imprimir
                </button>
              </div>
            </div>
          </div>

          <dl className={styles.kpis}>
            {kpis.map((kpi) => (
              <div key={kpi.rotulo} data-destaque={kpi.destaque ? "true" : undefined} data-tom={kpi.tom}>
                <dt>{kpi.rotulo}</dt>
                <dd>{kpi.valor}</dd>
                {kpi.nota ? <dd className={styles.kpiNota}>{kpi.nota}</dd> : null}
              </div>
            ))}
          </dl>
        </header>

        {/* Por que o zero, com nome e número.
            A versão anterior dizia "um critério eliminatório ficou não conforme"
            e parava ali — e duas linhas abaixo a tela mostrava "65 de 77 pontos".
            Quem não conhece a regra lia contradição e concluía que um dos dois
            números estava com defeito. */}
        {analise.zerada ? (
          <section className={`card pad ${styles.porQueZerou}`} aria-labelledby="por-que-zerou">
            <h2 id="por-que-zerou">
              <Icon name="alert" size={18} />
              Por que a nota foi zerada
            </h2>
            <p>
              {notaBase == null ? (
                <>
                  Nenhum peso aplicável foi apurado nesta avaliação, e{" "}
                  {eliminatoriosFalhos.length === 1 ? "o critério" : "os critérios"}{" "}
                  {eliminatoriosFalhos.map((problema) => `“${problema.nome}”`).join(" e ")}{" "}
                  {eliminatoriosFalhos.length === 1 ? "é eliminatório" : "são eliminatórios"}.
                </>
              ) : (
                <>
                  A avaliação atingiu <strong>{impacto.obtido} de {impacto.total} pontos</strong>{" "}
                  ({String(notaBase).replace(".", ",")}%), porém{" "}
                  {eliminatoriosFalhos.length === 0 ? (
                    "um critério eliminatório ficou não conforme"
                  ) : (
                    <>
                      {eliminatoriosFalhos.map((problema) => `“${problema.nome}”`).join(" e ")}{" "}
                      {eliminatoriosFalhos.length === 1
                        ? "é critério eliminatório"
                        : "são critérios eliminatórios"}
                    </>
                  )}
                  . Por isso a nota final é <strong>0</strong>.
                </>
              )}
            </p>
            {/* A regra em si, uma vez, para quem chega novo: é o que diferencia
                "errou muito" de "errou uma coisa que não se compensa". */}
            <p className={styles.regraZero}>
              Erro crítico não se compensa com acerto em outro critério — é o que separa a falha
              eliminatória do desconto por peso.
            </p>
          </section>
        ) : null}

        {nivel.rotulo === "Baixa" ? (
          <p className="alert warning">
            <Icon name="alert" size={18} />
            <span className="alert-body">
              <strong>Revisão humana recomendada</strong>
              <span>
                A confiança da IA ficou abaixo de 70%. Confira as evidências no áudio antes de
                aplicar feedback.
              </span>
            </span>
          </p>
        ) : null}

        {/* Resumo e problemas lado a lado: o que aconteceu e onde falhou são a
            mesma pergunta vista de dois ângulos. Os problemas ficam na coluna da
            direita e com peso próprio — operacionalmente valem mais que a
            contagem de conformes, que virou bloco de apoio no rodapé. */}
        <div className={styles.faixaResumo}>
          <section className={`card pad ${styles.resumoAtendimento}`} aria-labelledby="resumo-avaliacao">
            <h2 id="resumo-avaliacao">Resumo do atendimento</h2>

            {estruturado ? (
              <div className={styles.resumoBlocos}>
                <div>
                  <span className="label-micro">Contexto</span>
                  <p>{estruturado.contexto}</p>
                </div>

                <div>
                  <span className="label-micro">O que aconteceu</span>
                  <ul className={styles.eventos}>
                    {estruturado.eventos.map((evento, indice) => (
                      <li key={`evento-${indice}`}>{evento}</li>
                    ))}
                  </ul>
                </div>

                {estruturado.desfecho ? (
                  <div>
                    <span className="label-micro">Desfecho</span>
                    <p>{estruturado.desfecho}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Análise gravada antes desta versão não tem o resumo em partes.
                 Fatiar o parágrafo aqui para simular a estrutura seria adivinhar
                 qual frase é contexto e qual é desfecho. */
              <p className={styles.resumoParagrafo}>
                {analise.resumo || "A IA não devolveu resumo para esta avaliação."}
              </p>
            )}
          </section>

          <section className={`card pad ${styles.blocoProblemas}`} aria-labelledby="principais-problemas">
            <h2 id="principais-problemas">Principais problemas</h2>

            {problemas.length === 0 ? (
              <p className="subtle-text">Nenhum critério não conforme nesta avaliação.</p>
            ) : (
              <ul className={styles.problemasLista}>
                {problemas.slice(0, 5).map((problema) => (
                  <li data-severidade={problema.severidade} key={`prob-${problema.id}`}>
                    <div className={styles.problemaTopo}>
                      <strong>{problema.nome}</strong>
                      <span className={`chip ${problema.eliminatoria ? "danger" : "warning"}`}>
                        {problema.eliminatoria ? "Eliminatório" : `−${problema.peso} pts`}
                      </span>
                    </div>

                    {problema.evidencia ? (
                      <p className={styles.problemaEvidencia}>{problema.evidencia}</p>
                    ) : null}

                    <div className={styles.problemaAcoes}>
                      <a className="btn ghost" href={`#${problema.ancora}`}>
                        <Icon name="review" size={15} />
                        Ver critério
                      </a>
                      {/* "Ouvir trecho" só aparece quando a IA situou a evidência
                          no áudio. Botão que leva a 0:00 seria pior que ausência:
                          o supervisor ouviria outro momento e concluiria que o
                          apontamento está errado. */}
                      {problema.momento && gravacao.audioUrl ? (
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() =>
                            setSalto({ segundos: problema.momento.segundos, nonce: Date.now() })
                          }
                        >
                          <Icon name="play" size={15} />
                          Ouvir {problema.momento.rotulo}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {problemas.length > 5 ? (
              <p className="metric-note">
                Mais {problemas.length - 5} não conformidade(s) na lista de critérios abaixo.
              </p>
            ) : null}
          </section>
        </div>

        {/* O player vem logo depois do resultado: é a fonte de tudo o que a IA
            afirma, e o caminho evidência -> áudio tem de ser curto. */}
        <section className={`card pad ${styles.cartaoAudio}`}>
          <AudioPlayer
            src={gravacao.audioUrl || null}
            titulo="Gravação avaliada"
            descricao={ou(gravacao.arquivo)}
            duracaoLabel={duracao}
            marcadores={marcadores}
            saltoExterno={salto}
            emptyTitle="Áudio não disponível"
            emptyHint={
              gravacao.armazenada
                ? "O arquivo original não está mais no armazenamento desta gravação."
                : "Esta gravação foi registrada sem arquivo de áudio."
            }
          />
        </section>

        <div className={styles.corpo}>
          <div className={styles.principal}>
            <section className="card pad">
              <div className="section-head">
                <div>
                  <h2>Critérios avaliados</h2>
                  <p>
                    {resumo.conformes} conformes · {resumo.naoConformes} não conformes ·{" "}
                    {resumo.naoAplicaveis} não aplicáveis · formulário {ou(analise.formulario)}
                  </p>
                </div>
              </div>

              {/* Falhas primeiro na ordem dos filtros, e "Não conformes" já
                  selecionado quando existe alguma. A ordem antiga abria em
                  "Todos" e obrigava o supervisor a caçar o problema entre 17
                  itens — sendo que 13 deles estão certos e não pedem nada. */}
              <div className={styles.filtros} role="group" aria-label="Filtrar critérios por status">
                <div className="jump-chips">
                  {FILTROS.map((item) => {
                    const quantidade = contagemFiltro[item.id] ?? 0;
                    return (
                      <button
                        className="jump-chip"
                        key={item.id}
                        type="button"
                        aria-pressed={filtro === item.id}
                        data-falha={item.alerta && quantidade > 0 ? "true" : undefined}
                        disabled={quantidade === 0 && item.id !== "todos"}
                        onClick={() => setFiltro(item.id)}
                      >
                        <span>{item.rotulo}</span>
                        <span>{quantidade}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navegação por seção: 17 critérios em 6 seções não caem na tela
                  toda, e o estado de cada seção no atalho evita abrir uma por uma
                  para descobrir onde está a falha. */}
              {secoes.length > 2 ? (
                <nav className={styles.atalhoSecoes} aria-label="Ir para uma seção">
                  {secoes.map((secao) => {
                    const pontos = pontosPorSecao.get(secao.ancora);
                    return (
                      <a
                        className={styles.atalhoSecao}
                        href={`#${secao.ancora}`}
                        key={`atalho-${secao.ancora}`}
                        data-estado={secao.naoConformes > 0 ? "falha" : "ok"}
                      >
                        <Icon
                          name={secao.naoConformes > 0 ? "error" : "checkCircle"}
                          size={13}
                        />
                        {secao.nome}
                        {secao.naoConformes > 0 ? <strong>{secao.naoConformes}</strong> : null}
                        {(secao.criterios || []).some(
                          (criterio) =>
                            criterio.eliminatoria && criterio.statusChave === "nao_conforme",
                        ) ? (
                          <span data-zera="true">zera</span>
                        ) : pontos && pontos.total > 0 ? (
                          <span>
                            {pontos.obtido}/{pontos.total}
                          </span>
                        ) : null}
                      </a>
                    );
                  })}
                </nav>
              ) : null}

              {visiveis.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge success">
                    <Icon name="checkCircle" size={20} />
                  </span>
                  <h3>Nenhum critério neste status</h3>
                  <div className="btn-row">
                    <button className="btn" type="button" onClick={() => setFiltro("todos")}>
                      Mostrar todos
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secoes}>
                  {visiveis.map((secao) => {
                    const pontos = pontosPorSecao.get(secao.ancora);
                    const temFalha = secao.naoConformes > 0;
                    /* Eliminatório não tem peso: ele fica fora da pontuação base.
                       Sem esta marca, uma seção com duas falhas eliminatórias
                       exibia "10/10 pts" e parecia que nada foi perdido. */
                    const zeraNota = (secao.criterios || []).some(
                      (criterio) =>
                        criterio.eliminatoria && criterio.statusChave === "nao_conforme",
                    );

                    return (
                      /* Seção 100% conforme começa FECHADA. Ela ocupava a mesma
                         altura da que tem problema, e a página abria com quatro
                         telas de coisa que está certa. */
                      <details
                        className={styles.secao}
                        id={secao.ancora}
                        key={secao.ancora}
                        open={temFalha || filtroEfetivo !== "todos"}
                      >
                        <summary className={styles.secaoCabecalho}>
                          <span className={styles.secaoMarca} aria-hidden="true">
                            <Icon name={temFalha ? "error" : "checkCircle"} size={16} />
                          </span>
                          <span className={styles.secaoIdent}>
                            <strong>{secao.nome}</strong>
                            <span>
                              {secao.criterios.length}{" "}
                              {secao.criterios.length === 1 ? "critério" : "critérios"}
                              {temFalha ? ` · ${secao.naoConformes} não conforme(s)` : " conformes"}
                            </span>
                          </span>
                          <span className={styles.secaoResultado}>
                            {zeraNota ? (
                              <span className="chip danger">
                                <Icon name="alert" size={12} />
                                zera a nota
                              </span>
                            ) : null}
                            {pontos && pontos.total > 0 ? (
                              <span
                                className={styles.secaoPontos}
                                data-perdeu={pontos.perdido > 0 ? "true" : undefined}
                              >
                                {pontos.obtido}/{pontos.total} pts
                              </span>
                            ) : null}
                          </span>
                          <span className={styles.criterioSeta} aria-hidden="true">
                            <Icon name="chevronDown" size={16} />
                          </span>
                        </summary>

                        <ul className={styles.criterios}>
                          {secao.criterios.map((criterio) =>
                            criterio.statusChave === "nao_conforme" ? (
                              <li key={criterio.id}>
                                <CriterioFalha
                                  criterio={criterio}
                                  gravacaoId={id}
                                  temAudio={Boolean(gravacao.audioUrl)}
                                  onOuvir={setSalto}
                                />
                              </li>
                            ) : (
                              /* Conforme e não aplicável em linha compacta: dez
                                 cartões com borda, ícone, peso, selo e seta para
                                 itens que não pedem ação viram ruído em volta dos
                                 quatro que pedem. */
                              <li key={criterio.id}>
                                <div className={styles.criterioOk} data-status={criterio.statusChave}>
                                  <Icon name={ICONE_STATUS[criterio.statusChave]} size={15} />
                                  <span className={styles.criterioOkNome}>{criterio.nome}</span>
                                  <span className={styles.criterioOkPontos}>
                                    {pontuacaoDoCriterio(criterio)}
                                  </span>
                                </div>
                              </li>
                            ),
                          )}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={`card pad ${styles.proximaAcao}`} aria-labelledby="proxima-acao">
              <div className={styles.proximaTopo}>
                <div>
                  <h2 id="proxima-acao">Próxima ação</h2>
                  <p>
                    {problemas.length === 0
                      ? "Nada a tratar: nenhum critério ficou não conforme."
                      : eliminatoriosFalhos.length > 0
                        ? "Feedback prioritário — houve falha eliminatória."
                        : "Feedback de orientação sobre os pontos abaixo."}
                  </p>
                </div>
                <span
                  className={`chip ${eliminatoriosFalhos.length > 0 ? "danger" : problemas.length > 0 ? "warning" : "success"}`}
                >
                  <Icon
                    name={
                      eliminatoriosFalhos.length > 0
                        ? "alert"
                        : problemas.length > 0
                          ? "info"
                          : "checkCircle"
                    }
                    size={13}
                  />
                  {eliminatoriosFalhos.length > 0
                    ? "Prioritário"
                    : problemas.length > 0
                      ? "Orientação"
                      : "Sem pendência"}
                </span>
              </div>

              {problemas.length > 0 ? (
                <div className={styles.revisarCom}>
                  <span className="label-micro">Revisar com o operador</span>
                  <ul>
                    {problemas.slice(0, 5).map((problema) => (
                      <li key={`revisar-${problema.id}`}>
                        <a href={`#${problema.ancora}`}>{problema.nome}</a>
                        <span>{problema.eliminatoria ? "eliminatório" : `${problema.peso} pts`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <AcoesDaAnalise id={id} />
            </section>

            {/* Conformidade desceu para cá: é conferência, não decisão. No topo
                ela competia com a nota e com os problemas. */}
            <section className={`card pad ${styles.conformidade}`} aria-labelledby="conformidade">
              <h2 id="conformidade">Conformidade</h2>
              <dl className={styles.contagens}>
                <div data-tom="success">
                  <dt>Conformes</dt>
                  <dd>{resumo.conformes}</dd>
                </div>
                <div data-tom="danger">
                  <dt>Não conformes</dt>
                  <dd>{resumo.naoConformes}</dd>
                </div>
                <div data-tom="warning">
                  <dt>Não aplicáveis</dt>
                  <dd>{resumo.naoAplicaveis}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{resumo.total}</dd>
                </div>
              </dl>
              {impacto.total > 0 ? (
                <p className={styles.pontos}>
                  Pontuação base: <strong>{impacto.obtido}</strong> de{" "}
                  <strong>{impacto.total}</strong> pontos aplicáveis
                  {impacto.perdido > 0 ? ` (−${impacto.perdido})` : ""}. Eliminatórios e critérios
                  não aplicáveis ficam fora desta conta.
                </p>
              ) : null}
            </section>

            <section className="card pad" id="perguntar-ia">
              <ChatIa
                escopo="gravacao"
                referencia={id ? String(id) : ""}
                titulo="Perguntar à IA sobre esta avaliação"
                descricao="Respostas ancoradas nos critérios e na transcrição desta gravação."
              />
            </section>
          </div>
        </div>

        <footer className={styles.rodape}>
          <Link className="btn" href="/avaliacoes">
            <Icon name="chevronLeft" size={16} />
            Voltar para Avaliações
          </Link>
        </footer>
      </div>
    </AppShell>
  );
}

/**
 * Um critério como accordion.
 *
 * `<details>`/`<summary>` nativo em vez de estado em React: abre e fecha com
 * teclado sem código, o navegador anuncia expandido/recolhido para leitor de
 * tela, e a busca do próprio navegador (Ctrl+F) encontra texto dentro de
 * `<details>` fechado nos navegadores atuais.
 *
 * Aberto por padrão só quando é NÃO CONFORME: é o que a pessoa vem ler.
 */
/**
 * Pontuação de um critério, como texto.
 *
 * Eliminatório NÃO ganha "0/5 pts". O peso dele fica fora da pontuação base —
 * não entra no numerador nem no denominador — e mostrar um denominador ali
 * diria que 5 pontos estavam disponíveis e foram perdidos. Não foram: o
 * eliminatório zera a nota inteira, e é isso que o rótulo diz.
 */
function pontuacaoDoCriterio(criterio) {
  if (criterio.eliminatoria) return "eliminatório";

  const peso = Number(criterio.peso);
  if (!Number.isFinite(peso) || peso <= 0) return "sem peso";

  const obtido = criterio.statusChave === "conforme" ? peso : 0;
  if (criterio.statusChave === "nao_aplicavel") return "fora da conta";
  return `${obtido}/${peso} pts`;
}

/**
 * Não conformidade: o cartão rico.
 *
 * Responde as três perguntas na ordem em que quem revisa faz:
 * por que falhou -> qual a evidência -> onde no áudio -> o que isso custou.
 */
function CriterioFalha({ criterio, gravacaoId, temAudio, onOuvir }) {
  const confianca = percentual(criterio.confianca);

  return (
    <details className={styles.falha} data-eliminatoria={criterio.eliminatoria} open>
      <summary>
        <span className={styles.falhaMarca} aria-hidden="true">
          <Icon name={criterio.eliminatoria ? "alert" : "error"} size={16} />
        </span>
        <span className={styles.falhaIdent}>
          <strong>{criterio.nome}</strong>
          <span>
            {criterio.eliminatoria ? "Crítico · eliminatório" : "Não conforme"}
            {criterio.momento ? ` · ${criterio.momento.rotulo}` : ""}
          </span>
        </span>
        <span className={styles.falhaPontos}>{pontuacaoDoCriterio(criterio)}</span>
        <span className={styles.criterioSeta} aria-hidden="true">
          <Icon name="chevronDown" size={16} />
        </span>
      </summary>

      <div className={styles.falhaCorpo}>
        {criterio.enunciado ? (
          <p className={styles.criterioEnunciado}>{criterio.enunciado}</p>
        ) : null}

        {criterio.raciocinio ? (
          <div className={styles.bloco} data-tom="raciocinio">
            <p className={styles.blocoTitulo}>
              <Icon name="brain" size={14} />
              Por que não conforme
            </p>
            <p>{criterio.raciocinio}</p>
          </div>
        ) : null}

        {criterio.evidencia ? (
          <div className={styles.bloco} data-tom="evidencia">
            <p className={styles.blocoTitulo}>
              <Icon name="quote" size={14} />
              Evidência na transcrição
              {criterio.momento ? (
                <span className={styles.momentoSelo}>{criterio.momento.rotulo}</span>
              ) : null}
              {confianca ? <span className={styles.confianca}>Confiança {confianca}</span> : null}
            </p>
            <blockquote>{criterio.evidencia}</blockquote>
          </div>
        ) : (
          <p className="subtle-text">
            A IA não citou trecho para este critério. Sem evidência citada, confira o áudio antes de
            aplicar feedback.
          </p>
        )}

        <div className={styles.falhaAcoes}>
          {/* "Ouvir" só quando existe áudio E a IA situou o trecho. Botão que
              leva a 0:00 faria o supervisor ouvir outro momento e concluir que o
              apontamento está errado. */}
          {criterio.momento && temAudio ? (
            <button
              className="btn"
              type="button"
              onClick={() => onOuvir({ segundos: criterio.momento.segundos, nonce: Date.now() })}
            >
              <Icon name="play" size={15} />
              Ouvir {criterio.momento.rotulo}
            </button>
          ) : null}
          <Link className="btn ghost" href={`/transcricoes/${encodeURIComponent(gravacaoId)}`}>
            <Icon name="waveform" size={15} />
            Ver na transcrição
          </Link>
        </div>

        {/* Impacto por último: é a consequência, e ela só faz sentido depois de
            ver a evidência. */}
        <p className={styles.falhaImpacto}>
          <Icon name="info" size={14} />
          <span>
            {criterio.eliminatoria
              ? "Critério eliminatório: uma única falha aqui zera a nota da monitoria, sem compensação por peso em outro critério."
              : `Desconto de ${Number(criterio.peso) || 0} pontos na pontuação base desta avaliação.`}
          </span>
        </p>

        <p className={styles.criterioResposta}>
          Resposta registrada: <strong>{ou(criterio.resposta, "não registrada")}</strong>
        </p>
      </div>
    </details>
  );
}
function AcoesDaAnalise({ id }) {
  const { dados, carregando, erro, definir } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}/ficha` : null,
  );

  const [formularioId, setFormularioId] = useState("");
  const [avaliadoId, setAvaliadoId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [falha, setFalha] = useState("");

  // Só busca a lista de pessoas quando a gravação subiu sem operador vinculado.
  const precisaAvaliado = Boolean(dados) && !dados.avaliadoId && !dados.fichaCodigo;
  const { dados: opcoes } = useRecurso(precisaAvaliado ? "/api/relatorios/opcoes" : null);

  const formularios = dados?.formularios ?? [];
  const escolhido = formularioId || formularios[0]?.id || "";
  const faltaAvaliado = precisaAvaliado && !avaliadoId;

  async function gerar() {
    setFalha("");
    setGerando(true);

    try {
      const resposta = await enviarApi(`/api/transcricoes/${encodeURIComponent(id)}/ficha`, {
        formularioId: escolhido,
        avaliadoId: avaliadoId || null,
      });
      // Troca o estado local para os botões da ficha aparecerem na hora, sem
      // recarregar a análise inteira.
      definir({ ...dados, fichaCodigo: resposta.codigo });
    } catch (causa) {
      setFalha(causa.message);
    } finally {
      setGerando(false);
    }
  }

  if (erro) {
    return (
      <p className="alert danger">
        <Icon name="alert" size={16} />
        <span className="alert-body">
          <strong>Não foi possível verificar a monitoria desta gravação</strong>
          <span>{erro}</span>
        </span>
      </p>
    );
  }

  if (carregando && !dados) {
    return <span className={`skeleton ${styles.esqueletoAcoes}`} aria-hidden="true" />;
  }

  // --- 1. já virou monitoria ---------------------------------------------
  if (dados?.fichaCodigo) {
    return (
      <>
        <div className="btn-row">
          <Link className="btn primary" href={`/feedback/${encodeURIComponent(dados.fichaCodigo)}`}>
            <Icon name="feedback" size={16} />
            Aplicar feedback
          </Link>
          <Link className="btn" href={`/contestacoes/${encodeURIComponent(dados.fichaCodigo)}`}>
            <Icon name="alert" size={16} />
            Criar contestação
          </Link>
          <Link className="btn" href={`/avaliacoes/${encodeURIComponent(dados.fichaCodigo)}`}>
            <Icon name="review" size={16} />
            Ver a ficha {dados.fichaCodigo}
          </Link>
        </div>
        <p className={styles.notaAcao}>
          <Icon name="info" size={14} />
          <span>
            Esta gravação já foi avaliada por formulário na monitoria{" "}
            <strong>{dados.fichaCodigo}</strong>. É lá que o feedback e a contestação acontecem — a
            nota da ficha vem dos critérios cadastrados, não desta análise livre.
          </span>
        </p>
      </>
    );
  }

  // --- 4. sem carteira ----------------------------------------------------
  if (!dados?.clienteId) {
    return (
      <>
        <div className="btn-row">
          <Link className="btn primary" href={`/avaliacoes/ia/${encodeURIComponent(id)}/resumo`}>
            <Icon name="gauge" size={16} />
            Abrir resumo executivo e tratar
          </Link>
          <a className="btn" href="#perguntar-ia">
            <Icon name="sparkles" size={16} />
            Perguntar à IA
          </a>
        </div>
        <p className={styles.notaAcao}>
          <Icon name="info" size={14} />
          <span>
            Esta gravação subiu sem carteira, e formulário é régua de carteira. Para aplicar
            feedback é preciso vincular a gravação a uma operação e avaliá-la por um formulário.
          </span>
        </p>
      </>
    );
  }

  // --- 3. carteira sem formulário ativo -----------------------------------
  if (formularios.length === 0) {
    return (
      <>
        <div className="btn-row">
          <Link className="btn primary" href={`/avaliacoes/ia/${encodeURIComponent(id)}/resumo`}>
            <Icon name="gauge" size={16} />
            Abrir resumo executivo e tratar
          </Link>
          <Link className="btn" href="/formularios/gerenciamento">
            <Icon name="checklist" size={16} />
            Cadastrar formulário
          </Link>
        </div>
        <p className={styles.notaAcao}>
          <Icon name="info" size={14} />
          <span>
            A carteira <strong>{dados.cliente}</strong> não tem formulário ativo com critérios.
            Feedback e contestação são ancorados em monitoria com formulário — cadastre a régua da
            carteira e esta gravação poderá ser avaliada por ela.
          </span>
        </p>
      </>
    );
  }

  // --- 2. dá para converter ----------------------------------------------
  return (
    <>
      <div className={styles.gerarFicha}>
        <div className="field">
          <label htmlFor="ficha-formulario">Avaliar por qual formulário</label>
          <select
            className="select"
            id="ficha-formulario"
            value={escolhido}
            onChange={(evento) => setFormularioId(evento.target.value)}
          >
            {formularios.map((formulario) => (
              <option key={formulario.id} value={formulario.id}>
                {formulario.nome}
                {formulario.campanha ? ` — ${formulario.campanha}` : ""} ({formulario.criterios}{" "}
                critérios)
              </option>
            ))}
          </select>
        </div>

        {/* A gravação subiu sem operador: sem escolher, a ficha entraria na média
            de alguém que não fez o atendimento. */}
        {precisaAvaliado ? (
          <div className="field">
            <label htmlFor="ficha-avaliado">Quem foi avaliado</label>
            <select
              className="select"
              id="ficha-avaliado"
              value={avaliadoId}
              onChange={(evento) => setAvaliadoId(evento.target.value)}
            >
              <option value="">Selecione a pessoa</option>
              {(opcoes?.avaliados ?? []).map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
            <span className="field-hint">
              A gravação subiu sem operador vinculado. A nota da ficha entra na média de quem for
              escolhido aqui.
            </span>
          </div>
        ) : null}
      </div>

      {falha ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível gerar a monitoria</strong>
            <span>{falha}</span>
          </span>
        </p>
      ) : null}

      <div className="btn-row">
        <button
          className="btn primary"
          type="button"
          disabled={gerando || !escolhido || faltaAvaliado}
          onClick={gerar}
        >
          <Icon name={gerando ? "spinner" : "checklist"} size={16} />
          {gerando ? "Avaliando pelo formulário..." : "Gerar monitoria e aplicar feedback"}
        </button>
        <Link className="btn" href={`/avaliacoes/ia/${encodeURIComponent(id)}/resumo`}>
          <Icon name="gauge" size={16} />
          Só registrar tratativa
        </Link>
      </div>

      {/* A nota vai mudar, e dizer isso antes evita a leitura de que o botão
          "aplica" a nota que está na tela. */}
      <p className={styles.notaAcao}>
        <Icon name="info" size={14} />
        <span>
          Gerar a monitoria reprocessa o arquivo contra os critérios do formulário escolhido, então
          a nota da ficha será outra — os critérios são outros. Depois disso o feedback e a
          contestação passam a existir para esta gravação.
        </span>
      </p>
    </>
  );
}
