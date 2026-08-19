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

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "nao_conforme", rotulo: "Não conformes", alerta: true },
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
  const [filtro, setFiltro] = useState("todos");
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

  const contagemFiltro = {
    todos: criterios.length,
    nao_conforme: resumo.naoConformes,
    conforme: resumo.conformes,
    nao_aplicavel: resumo.naoAplicaveis,
  };

  const visiveis =
    filtro === "todos"
      ? secoes
      : secoes
          .map((secao) => ({
            ...secao,
            criterios: secao.criterios.filter((item) => item.statusChave === filtro),
          }))
          .filter((secao) => secao.criterios.length > 0);

  const kpis = [
    { rotulo: "Nota", valor: `${nota(analise.nota)} / 100`, nota: faixa.rotulo, tom: faixa.tom, destaque: true },
    { rotulo: "Confiança", valor: percentual(confianca) || "N/A", nota: `Leitura ${nivel.rotulo.toLowerCase()}`, tom: nivel.tom },
    { rotulo: "Duração", valor: ou(duracao) },
    {
      rotulo: "Criticidade",
      valor: criticidade.rotulo,
      nota: criticidade.motivos[0] || null,
      tom: criticidade.tom,
    },
  ];

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

        {analise.zerada ? (
          <p className="alert danger">
            <Icon name="alert" size={18} />
            <span className="alert-body">
              <strong>Avaliação zerada</strong>
              <span>Um critério eliminatório ficou não conforme e zerou a nota da monitoria.</span>
            </span>
          </p>
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

        {/* O resumo abre a avaliação, na horizontal e em largura cheia.
            Antes ele morava na coluna lateral: quem chegava lia primeiro os 17
            critérios e só depois o parágrafo que os explica. A ordem certa é a
            contrária — o que aconteceu, quanto valeu, o que falhou, e só então o
            detalhe critério por critério. */}
        <section className={`card pad ${styles.resumoTopo}`} aria-labelledby="resumo-avaliacao">
          <div className={styles.resumoTexto}>
            <h2 id="resumo-avaliacao">Resumo da avaliação</h2>
            {analise.resumo ? <p>{analise.resumo}</p> : <p className="subtle-text">A IA não devolveu resumo para esta avaliação.</p>}
            {impacto.total > 0 ? (
              <p className={styles.pontos}>
                Pontuação: <strong>{impacto.obtido}</strong> de <strong>{impacto.total}</strong>{" "}
                pontos aplicáveis
                {impacto.perdido > 0 ? ` (−${impacto.perdido})` : ""}.
              </p>
            ) : null}
          </div>

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

          <div className={styles.problemas}>
            <span className="label-micro">Principais problemas</span>
            {problemas.length === 0 ? (
              <p className="subtle-text">Nenhum critério não conforme nesta avaliação.</p>
            ) : (
              <ul>
                {problemas.slice(0, 3).map((problema) => (
                  <li data-severidade={problema.severidade} key={`prob-${problema.id}`}>
                    <a href={`#${problema.ancora}`}>
                      <strong>{problema.nome}</strong>
                      <span>
                        {ROTULO_SEVERIDADE[problema.severidade]}
                        {problema.eliminatoria ? " · eliminatório" : ` · ${problema.peso} pts`}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a className="btn primary" href="#perguntar-ia">
              <Icon name="sparkles" size={16} />
              Perguntar à IA
            </a>
          </div>
        </section>

        {/* O player vem logo depois do resultado: é a fonte de tudo o que a IA
            afirma, e o caminho evidência -> áudio tem de ser curto. */}
        <section className={`card pad ${styles.cartaoAudio}`}>
          <AudioPlayer
            src={gravacao.audioUrl || null}
            titulo="Gravação avaliada"
            descricao={ou(gravacao.arquivo)}
            duracaoLabel={duracao}
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
                    {criterios.length} critérios em {secoes.length}{" "}
                    {secoes.length === 1 ? "seção" : "seções"} · formulário{" "}
                    {ou(analise.formulario)}
                  </p>
                </div>
              </div>

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
                  {visiveis.map((secao) => (
                    <section className={styles.secao} id={secao.ancora} key={secao.ancora}>
                      <div className={styles.secaoCabecalho}>
                        <h3>{secao.nome}</h3>
                        {secao.naoConformes > 0 ? (
                          <span className="chip danger">
                            <Icon name="error" size={13} />
                            {secao.naoConformes} não conforme(s)
                          </span>
                        ) : (
                          <span className="chip success">
                            <Icon name="checkCircle" size={13} />
                            Conforme
                          </span>
                        )}
                      </div>

                      <ul className={styles.criterios}>
                        {secao.criterios.map((criterio) => (
                          <li key={criterio.id}>
                            <CriterioAccordion criterio={criterio} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
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
function CriterioAccordion({ criterio }) {
  const status = criterio.statusChave;
  const confianca = percentual(criterio.confianca);

  return (
    <details className={styles.criterio} data-status={status} open={status === "nao_conforme"}>
      <summary>
        <span className={styles.criterioMarca} aria-hidden="true">
          <Icon name={ICONE_STATUS[status]} size={16} />
        </span>
        <span className={styles.criterioNome}>{criterio.nome}</span>
        <span className={styles.criterioMeta}>
          {criterio.eliminatoria ? (
            <span className="chip danger">
              <Icon name="alert" size={12} />
              Eliminatório
            </span>
          ) : Number.isFinite(Number(criterio.peso)) ? (
            <span className={styles.criterioPeso}>{criterio.peso} pts</span>
          ) : null}
          <span className={`chip ${TOM_STATUS[status]}`}>{ROTULO_STATUS[status]}</span>
        </span>
        <span className={styles.criterioSeta} aria-hidden="true">
          <Icon name="chevronDown" size={16} />
        </span>
      </summary>

      <div className={styles.criterioCorpo}>
        {criterio.enunciado ? (
          <p className={styles.criterioEnunciado}>{criterio.enunciado}</p>
        ) : null}

        {criterio.evidencia ? (
          <div className={styles.bloco} data-tom="evidencia">
            <p className={styles.blocoTitulo}>
              <Icon name="quote" size={14} />
              Evidência encontrada
              {confianca ? <span className={styles.confianca}>Confiança {confianca}</span> : null}
            </p>
            <blockquote>{criterio.evidencia}</blockquote>
          </div>
        ) : (
          <p className="subtle-text">A IA não citou trecho da transcrição para este critério.</p>
        )}

        {criterio.raciocinio ? (
          <div className={styles.bloco} data-tom="raciocinio">
            <p className={styles.blocoTitulo}>
              <Icon name="brain" size={14} />
              {status === "nao_conforme" ? "Por que falhou?" : "Leitura da IA"}
            </p>
            <p>{criterio.raciocinio}</p>
          </div>
        ) : null}

        <p className={styles.criterioResposta}>
          Resposta registrada: <strong>{ou(criterio.resposta, "não registrada")}</strong>
        </p>
      </div>
    </details>
  );
}
