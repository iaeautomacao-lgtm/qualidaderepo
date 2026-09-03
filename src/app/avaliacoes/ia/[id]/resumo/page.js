"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import BotaoCopiar from "@/components/BotaoCopiar";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import {
  ROTULO_NIVEL,
  ROTULO_SEVERIDADE,
  TOM_NIVEL,
  TOM_SEVERIDADE,
  contarConformidade,
  criticidadeDaAvaliacao,
  impactoDaNota,
  impactoOperacional,
  listaTexto,
  normalizarSecoes,
  nota,
  ou,
  problemasOrdenados,
} from "../../analise";
import styles from "./page.module.css";

/**
 * Resumo executivo de uma avaliação IA.
 *
 * Ferramenta de decisão, não relatório: a página segue
 * RESULTADO -> PROBLEMA -> EVIDÊNCIA -> IMPACTO -> AÇÃO, e termina num botão que
 * fecha o caso. Antes esse conteúdo era um bloco de texto corrido no meio da
 * ficha, e o gestor tinha de ler tudo para descobrir o que fazer.
 *
 * Todo julgamento desta tela (severidade, risco, impacto) é DERIVADO dos pesos e
 * das marcações do formulário, e cada bloco mostra de onde saiu. Ver
 * `../../analise.js`.
 */
export default function ResumoExecutivoPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar, definir } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}` : null,
  );
  const [salvando, setSalvando] = useState(false);
  const [erroTratativa, setErroTratativa] = useState("");

  const gravacao = dados?.gravacao ?? null;
  const analise = gravacao?.transcricao?.segmentos ?? null;
  const secoes = useMemo(() => normalizarSecoes(analise), [analise]);

  async function alternarTratativa(tratada) {
    if (!id || salvando) return;
    setSalvando(true);
    setErroTratativa("");
    try {
      const resposta = await enviarApi(`/api/transcricoes/${encodeURIComponent(id)}/tratativa`, {
        tratada,
      });
      // A rota devolve a gravação recarregada: aproveitar isso evita um segundo
      // request só para atualizar o selo.
      if (resposta?.gravacao && definir) definir({ gravacao: resposta.gravacao });
      else await recarregar();
    } catch (causa) {
      setErroTratativa(
        causa instanceof Error ? causa.message : "Não foi possível registrar a tratativa agora.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && !gravacao) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${id || ""} > Resumo`}>
        <div className={styles.esqueleto} aria-busy="true" aria-live="polite">
          <span className="sr-only">Carregando o resumo executivo.</span>
          <div className={`skeleton ${styles.esqueletoHero}`} />
          <div className={`skeleton ${styles.esqueletoBloco}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
        </div>
      </AppShell>
    );
  }

  if (erro || !gravacao || !analise) {
    return (
      <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${id || ""} > Resumo`}>
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge warning">
              <Icon name={erro ? "error" : "info"} size={22} />
            </span>
            <h1>{erro ? "Não foi possível abrir o resumo" : "Esta gravação não tem avaliação"}</h1>
            <p>
              {erro ||
                "Sem critérios, nota e evidências salvos não há resumo executivo para montar."}
            </p>
            <div className="btn-row">
              {id ? (
                <Link className="btn primary" href={`/transcricoes/${encodeURIComponent(id)}`}>
                  <Icon name="waveform" size={16} />
                  Abrir a transcrição
                </Link>
              ) : null}
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

  const codigo = analise.codigo || `ID ${id}`;
  const resumo = contarConformidade(analise, secoes);
  const impacto = impactoDaNota(secoes);
  const criticidade = criticidadeDaAvaliacao({ analise, secoes, impacto, resumo });
  const faixa = faixaDaNota(analise.nota);
  const problemas = problemasOrdenados(secoes);
  const dimensoes = impactoOperacional({ analise, secoes, impacto, resumo });
  const riscos = listaTexto(analise.riscos);
  const proximosPassos = listaTexto(analise.proximosPassos);
  const tratativa = gravacao.tratativa || { suportada: false, tratada: false };

  const acaoRecomendada =
    proximosPassos[0] ||
    (problemas.length > 0
      ? `Realizar feedback individual com o operador sobre "${problemas[0].nome}" antes da próxima jornada.`
      : "Registrar a conformidade em calibragem e seguir com o acompanhamento normal.");

  const cabecalho = [
    { rotulo: "Nota", valor: `${nota(analise.nota)} / 100`, tom: faixa.tom, apoio: faixa.rotulo },
    {
      rotulo: "Resultado",
      valor: analise.zerada ? "Zerada" : faixa.rotulo === "Crítico" ? "Não conforme" : faixa.rotulo,
      tom: faixa.tom,
      apoio: `${resumo.naoConformes} de ${resumo.total} critérios não conformes`,
    },
    {
      rotulo: "Risco",
      valor: criticidade.rotulo,
      tom: criticidade.tom,
      apoio: criticidade.motivos[0] || "sem fator de risco identificado",
    },
  ];

  return (
    <AppShell active="Avaliações" breadcrumb={`Avaliações > IA > ${codigo} > Resumo`}>
      <div className={styles.pagina}>
        <header className={styles.hero}>
          <div className={styles.heroTopo}>
            <div className={styles.heroIdent}>
              <p className={styles.heroSobre}>Resumo executivo</p>
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

            <div className={styles.heroAcoes}>
              {tratativa.tratada ? (
                <span className="chip success">
                  <Icon name="checkCircle" size={13} />
                  Tratada {tratativa.em ? `em ${tratativa.em}` : ""}
                </span>
              ) : null}
              <Link className="btn" href={`/avaliacoes/ia/${encodeURIComponent(id)}`}>
                <Icon name="review" size={16} />
                Avaliação completa
              </Link>
              <button className="btn" type="button" onClick={() => window.print()}>
                <Icon name="printer" size={16} />
                Imprimir
              </button>
            </div>
          </div>

          <dl className={styles.cabecalho}>
            {cabecalho.map((item) => (
              <div data-tom={item.tom} key={item.rotulo}>
                <dt>{item.rotulo}</dt>
                <dd>{item.valor}</dd>
                <dd className={styles.cabecalhoApoio}>{item.apoio}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* --- 1. O que aconteceu ----------------------------------------- */}
        <section className="card pad" aria-labelledby="o-que-aconteceu">
          <div className="section-head">
            <div>
              <h2 id="o-que-aconteceu">1. O que aconteceu</h2>
              <p>Leitura do atendimento pela IA.</p>
            </div>
          </div>
          <p className={styles.textoCorrido}>
            {ou(analise.resumo, "A IA não retornou resumo do atendimento.")}
          </p>
          {analise.observacoesIa && analise.observacoesIa !== analise.resumo ? (
            <p className={styles.textoCorrido}>{analise.observacoesIa}</p>
          ) : null}
        </section>

        {/* --- 2. Principais problemas ------------------------------------ */}
        <section className="card pad" aria-labelledby="principais-problemas">
          <div className="section-head">
            <div>
              <h2 id="principais-problemas">2. Principais problemas</h2>
              <p>Ordenados por severidade: eliminatório primeiro, depois peso do critério.</p>
            </div>
            {problemas.length > 3 ? (
              <Link className="btn" href={`/avaliacoes/ia/${encodeURIComponent(id)}`}>
                Ver os {problemas.length}
                <Icon name="chevronRight" size={16} />
              </Link>
            ) : null}
          </div>

          {problemas.length === 0 ? (
            <div className="empty-state">
              <span className="icon-badge success">
                <Icon name="checkCircle" size={20} />
              </span>
              <h3>Nenhum critério não conforme</h3>
              <p>Não há problema a tratar nesta avaliação.</p>
            </div>
          ) : (
            <ul className={styles.problemas}>
              {problemas.slice(0, 3).map((problema) => (
                <li data-severidade={problema.severidade} key={`prob-${problema.id}`}>
                  <div className={styles.problemaTopo}>
                    <span className={`chip ${TOM_SEVERIDADE[problema.severidade]}`}>
                      <Icon name={problema.severidade === "critico" ? "alert" : "error"} size={13} />
                      {ROTULO_SEVERIDADE[problema.severidade]}
                    </span>
                    <strong>{problema.nome}</strong>
                    <span className={styles.problemaSecao}>{problema.secao}</span>
                  </div>

                  {problema.raciocinio ? (
                    <p className={styles.problemaTexto}>{problema.raciocinio}</p>
                  ) : null}

                  {problema.evidencia ? (
                    <blockquote className={styles.problemaEvidencia}>
                      <span className="label-micro">Evidência</span>
                      {problema.evidencia}
                    </blockquote>
                  ) : (
                    <p className="subtle-text">A IA não citou trecho da transcrição neste critério.</p>
                  )}

                  {/* Base da severidade escrita na tela: é leitura da ferramenta a
                      partir do formulário, não regra do POP. */}
                  <p className={styles.problemaBase}>Severidade por {problema.base}.</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- 3. Impacto operacional ------------------------------------- */}
        <section className="card pad" aria-labelledby="impacto-operacional">
          <div className="section-head">
            <div>
              <h2 id="impacto-operacional">3. Impacto operacional</h2>
              <p>Estimado a partir dos pesos e das marcações do formulário aplicado.</p>
            </div>
          </div>

          <ul className={styles.dimensoes}>
            {dimensoes.map((dimensao) => (
              <li key={dimensao.dimensao}>
                <div className={styles.dimensaoTopo}>
                  <strong>{dimensao.dimensao}</strong>
                  <span className={`chip ${TOM_NIVEL[dimensao.nivel]}`}>
                    {ROTULO_NIVEL[dimensao.nivel]}
                  </span>
                </div>
                <p>{dimensao.base}</p>
              </li>
            ))}
          </ul>

          {riscos.length > 0 ? (
            <div className={styles.riscos}>
              <span className="label-micro">Riscos apontados pela IA</span>
              <ul>
                {riscos.map((risco, indice) => (
                  <li key={`risco-${indice}`}>{risco}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* --- 4. Próxima ação ------------------------------------------- */}
        <section className={`card pad ${styles.acao}`} aria-labelledby="proxima-acao">
          <div className="section-head">
            <div>
              <h2 id="proxima-acao">4. Próxima ação recomendada</h2>
              <p>O que fecha este caso.</p>
            </div>
          </div>

          <p className={styles.acaoTexto}>{acaoRecomendada}</p>

          <dl className={styles.acaoMeta}>
            <div>
              <dt>Responsável</dt>
              <dd>Supervisão</dd>
            </div>
            <div>
              <dt>Prioridade</dt>
              <dd>
                <span className={`chip ${criticidade.tom}`}>{criticidade.prioridade}</span>
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {tratativa.tratada ? (
                  <span className="chip success">
                    <Icon name="checkCircle" size={13} />
                    Tratada{tratativa.por ? ` por ${tratativa.por}` : ""}
                  </span>
                ) : (
                  <span className="chip warning">
                    <Icon name="clock" size={13} />
                    Pendente
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {proximosPassos.length > 1 ? (
            <ul className={styles.passos}>
              {proximosPassos.slice(1).map((passo, indice) => (
                <li key={`passo-${indice}`}>{passo}</li>
              ))}
            </ul>
          ) : null}

          {erroTratativa ? (
            <p className="alert danger">
              <Icon name="error" size={18} />
              <span className="alert-body">
                <strong>Tratativa não registrada</strong>
                <span>{erroTratativa}</span>
              </span>
            </p>
          ) : null}

          <div className="btn-row">
            {/* Botão só aparece quando o banco tem onde gravar: oferecer um
                controle que falha é pior que não oferecer. */}
            {tratativa.suportada ? (
              <button
                className={`btn ${tratativa.tratada ? "" : "primary"}`}
                type="button"
                disabled={salvando}
                onClick={() => alternarTratativa(!tratativa.tratada)}
              >
                <Icon name={tratativa.tratada ? "undo" : "check"} size={16} />
                {salvando
                  ? "Salvando..."
                  : tratativa.tratada
                    ? "Reabrir tratativa"
                    : "Marcar como tratado"}
              </button>
            ) : null}

            <Link className="btn" href={`/avaliacoes/ia/${encodeURIComponent(id)}`}>
              <Icon name="review" size={16} />
              Ver avaliação completa
            </Link>

            <Link className="btn" href="/feedback">
              <Icon name="feedback" size={16} />
              Abrir feedbacks
            </Link>
          </div>

          {!tratativa.suportada ? (
            <p className={styles.avisoMigration}>
              O registro de tratativa exige a migration{" "}
              <code>005_tratativa_analise_ia.sql</code>, que ainda não foi aplicada neste banco.
            </p>
          ) : null}
        </section>

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
