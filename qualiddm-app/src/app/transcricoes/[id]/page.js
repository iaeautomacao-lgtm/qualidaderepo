"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import ChatIa from "@/components/ChatIa";
import CriterioCard, { normalizarCriterio, percentual } from "@/components/CriterioCard";
import ResumoConformidade from "@/components/ResumoConformidade";
import TranscricaoFalantes from "@/components/TranscricaoFalantes";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import styles from "./page.module.css";

/** "0.00" — a nota da IA é sempre exibida com duas casas, como no QualiTalk. */
function nota(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2) : "N/A";
}

function ou(valor) {
  if (valor === null || valor === undefined) return "N/A";
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : "N/A";
}

/** Análise antiga guardava a transcrição em texto com um cabeçalho fixo. */
function textoLegado(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/^ANALISE AUTOMATICA DA GRAVACAO \/ ARQUIVO\s*/i, "")
    .trim();
}

export default function ResultadoTranscricaoPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}` : null,
  );
  const [soNaoConformes, setSoNaoConformes] = useState(false);

  const gravacao = dados?.gravacao ?? null;
  const analise = gravacao?.transcricao?.segmentos ?? null;

  const secoes = useMemo(() => {
    const lista = Array.isArray(analise?.secoes) ? analise.secoes : [];
    return lista.map((secao, indice) => {
      const criterios = (Array.isArray(secao?.criterios) ? secao.criterios : []).map(
        (criterio, posicao) => normalizarCriterio(criterio, `${indice}-${posicao}`),
      );
      return {
        ancora: `secao-ia-${indice}`,
        nome: secao?.nome || `Seção ${indice + 1}`,
        descricao: secao?.descricao || null,
        criterios,
        naoConformes: criterios.filter((item) => item.statusChave === "nao_conforme").length,
      };
    });
  }, [analise]);

  if (carregando && !gravacao) {
    return (
      <AppShell active="Transcrições" breadcrumb={`Transcrições > ${id || ""}`}>
        <div className={styles.esqueleto} aria-busy="true" aria-live="polite">
          <span className="sr-only">Carregando os detalhes da avaliação da IA.</span>
          <div className={`skeleton ${styles.esqueletoHero}`} />
          <div className={`skeleton ${styles.esqueletoKpis}`} />
          <div className={styles.esqueletoCorpo}>
            <div className={styles.esqueletoColuna}>
              <div className={`skeleton ${styles.esqueletoBloco}`} />
              <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
            </div>
            <div className={styles.esqueletoColuna}>
              <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (erro || !gravacao) {
    return (
      <AppShell active="Transcrições" breadcrumb={`Transcrições > ${id || ""}`}>
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h1>Não foi possível abrir o resultado</h1>
            <p>{erro || "A gravação não foi encontrada no banco."}</p>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={recarregar}>
                <Icon name="refresh" size={16} />
                Tentar de novo
              </button>
              <Link className="btn" href="/transcricoes">
                <Icon name="chevronLeft" size={16} />
                Voltar para Transcrições
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const codigo = analise?.codigo || gravacao.codigo || `ID ${id}`;
  const transcricao = analise?.transcricao || textoLegado(gravacao?.transcricao?.texto);
  const confianca = analise?.confianca ?? gravacao?.transcricao?.confianca;
  const duracao = analise?.duracao || gravacao?.duracao;
  const totalNaoConformes = secoes.reduce((soma, secao) => soma + secao.naoConformes, 0);
  const confiancaBaixa = Number(confianca ?? 0) > 0 && Number(confianca ?? 0) < 0.7;

  // `audioUrl` já vem `null` quando o arquivo saiu do armazenamento — a tela
  // não monta a rota por conta própria para não exibir um player que não toca.
  const audioUrl = gravacao.audioUrl || null;

  const kpis = [
    { rotulo: "Persona", valor: ou(analise?.persona || analise?.carteira || gravacao.cliente) },
    { rotulo: "Nota", valor: nota(analise?.nota), destaque: true },
    {
      rotulo: "Confiança",
      valor: percentual(confianca) || "N/A",
      // O print do QualiTalk traz um "?" com tooltip aqui. Tooltip não existe no
      // toque e não é lido por leitor de tela: a explicação fica escrita.
      nota: "Quanto a IA achou a transcrição suficiente para julgar os critérios.",
    },
    { rotulo: "Duração", valor: ou(duracao) },
  ];

  const criteriosVisiveis = soNaoConformes
    ? secoes
        .map((secao) => ({
          ...secao,
          criterios: secao.criterios.filter((item) => item.statusChave === "nao_conforme"),
        }))
        .filter((secao) => secao.criterios.length > 0)
    : secoes;

  return (
    <AppShell active="Transcrições" breadcrumb={`Transcrições > ${codigo}`}>
      <div className={styles.pagina}>
        <header className={styles.hero}>
          <div className={styles.heroTopo}>
            <span className={styles.heroIcone} aria-hidden="true">
              <Icon name="robot" size={22} />
            </span>
            <div className={styles.heroIdent}>
              <p className={styles.heroSobre}>Monitoria automática</p>
              <h1>Detalhes da Avaliação IA</h1>
              <p className={styles.heroLinha}>
                <span className={styles.heroCodigo}>
                  {codigo}
                  <BotaoCopiar valor={String(codigo)} rotulo="código da análise" />
                </span>
                <span aria-hidden="true">•</span>
                {ou(gravacao.arquivo)}
              </p>
            </div>
            <div className={styles.heroAcoes}>
              <Link className="btn" href="/transcricoes">
                <Icon name="waveform" size={16} />
                Fila de transcrições
              </Link>
              <Link className="btn" href="/upload">
                <Icon name="upload" size={16} />
                Nova gravação
              </Link>
            </div>
          </div>

          <dl className={styles.kpis}>
            {kpis.map((kpi) => (
              <div key={kpi.rotulo} data-destaque={kpi.destaque ? "true" : undefined}>
                <dt>{kpi.rotulo}</dt>
                <dd>{kpi.valor}</dd>
                {kpi.nota ? <dd className={styles.kpiNota}>{kpi.nota}</dd> : null}
              </div>
            ))}
          </dl>
        </header>

        {analise?.zerada ? (
          <p className="alert danger">
            <Icon name="alert" size={18} />
            <span className="alert-body">
              <strong>Avaliação zerada</strong>
              <span>Um critério eliminatório ficou não conforme e zerou a nota da monitoria.</span>
            </span>
          </p>
        ) : null}

        {confiancaBaixa ? (
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

        {!analise ? (
          <section className="card pad">
            <div className="empty-state">
              <span className="icon-badge warning">
                <Icon name="info" size={22} />
              </span>
              <h2>Análise sem ficha estruturada</h2>
              <p>
                Esta gravação foi transcrita antes da avaliação por formulário. Reenvie o arquivo
                pelo Monitor IA para gerar nota, critérios e evidências.
              </p>
              <div className="btn-row">
                <Link className="btn primary" href="/upload">
                  <Icon name="upload" size={16} />
                  Reenviar gravação
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className={styles.corpo}>
          <div className={styles.principal}>
            <section className="card pad">
              <AudioPlayer
                src={audioUrl}
                titulo="Gravação"
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

            <TranscricaoFalantes
              texto={transcricao}
              vazioTexto="A transcrição desta gravação não foi salva no banco."
            />

            {analise?.observacoesIa || analise?.resumo ? (
              <section className="card pad">
                <div className="section-head">
                  <div>
                    <h2>Observações da IA</h2>
                    <p>Leitura corrida do atendimento, antes dos critérios.</p>
                  </div>
                  <span className="icon-badge" aria-hidden="true">
                    <Icon name="robot" size={18} />
                  </span>
                </div>
                {analise.resumo ? <p className={styles.textoCorrido}>{analise.resumo}</p> : null}
                {analise.observacoesIa ? (
                  <p className={styles.textoCorrido}>{analise.observacoesIa}</p>
                ) : null}
              </section>
            ) : null}

            {analise ? (
              <section className={`card pad ${styles.cartaoFormulario}`}>
                <h2>Respostas da Avaliação</h2>
                <p>
                  <span className={styles.rotuloInline}>Formulário:</span>{" "}
                  {ou(analise.formulario || analise.campanha)}
                </p>
              </section>
            ) : null}

            <ResumoConformidade resumo={analise?.resumoConformidade} />

            <section className="card pad">
              <div className="section-head">
                <div>
                  <h2>Respostas e Avaliações</h2>
                  <p>
                    {secoes.length} {secoes.length === 1 ? "seção" : "seções"}
                    {totalNaoConformes > 0 ? ` · ${totalNaoConformes} não conformes` : ""}
                  </p>
                </div>
                {secoes.length > 0 ? (
                  <button
                    className="btn"
                    type="button"
                    aria-pressed={soNaoConformes}
                    onClick={() => setSoNaoConformes((atual) => !atual)}
                  >
                    <Icon name="filter" size={16} />
                    {soNaoConformes ? "Mostrar todos" : "Só não conformes"}
                  </button>
                ) : null}
              </div>

              {secoes.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge">
                    <Icon name="checklist" size={20} />
                  </span>
                  <h3>Nenhum critério estruturado</h3>
                  <p>Esta análise não trouxe seções de formulário preenchidas.</p>
                </div>
              ) : criteriosVisiveis.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-badge success">
                    <Icon name="checkCircle" size={20} />
                  </span>
                  <h3>Nenhum critério não conforme</h3>
                  <p>Todos os critérios avaliados estão conformes ou não aplicáveis.</p>
                  <div className="btn-row">
                    <button className="btn" type="button" onClick={() => setSoNaoConformes(false)}>
                      Mostrar todos os critérios
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secoes}>
                  {criteriosVisiveis.map((secao) => (
                    <section className={styles.secao} id={secao.ancora} key={secao.ancora}>
                      <div className={styles.secaoCabecalho}>
                        <h3>{secao.nome}</h3>
                        {secao.descricao ? <p>{secao.descricao}</p> : null}
                      </div>
                      <div className={styles.criterios}>
                        {secao.criterios.map((criterio) => (
                          <CriterioCard criterio={criterio} key={criterio.id} nivelTitulo={4} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className={styles.trilha}>
            {/* Mesma regra da ficha: só entra na navegação a seção que está
                renderizada, para nenhuma âncora apontar para o vazio. */}
            {criteriosVisiveis.length > 0 ? (
              <nav className={`card pad ${styles.navSecoes}`} aria-label="Seções da avaliação">
                <h2 className={styles.tituloLateral}>Seções</h2>
                <ul>
                  {criteriosVisiveis.map((secao) => (
                    <li key={`nav-${secao.ancora}`}>
                      <a href={`#${secao.ancora}`}>
                        <span>{secao.nome}</span>
                        {secao.naoConformes > 0 ? (
                          <span className="count-badge danger">
                            {secao.naoConformes}
                            <span className="sr-only"> não conformes</span>
                          </span>
                        ) : (
                          <span className="count-badge">
                            {secao.criterios.length}
                            <span className="sr-only"> critérios, todos conformes</span>
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <PainelListas analise={analise} />

            <ChatIa
              escopo="gravacao"
              referencia={id ? String(id) : ""}
              descricao="Sobre a transcrição, os critérios e o feedback desta gravação."
            />
          </aside>
        </div>

        <footer className={styles.rodape}>
          <Link className="btn" href="/transcricoes">
            <Icon name="chevronLeft" size={16} />
            Voltar para Transcrições
          </Link>
        </footer>
      </div>
    </AppShell>
  );
}

function PainelListas({ analise }) {
  const grupos = [
    { titulo: "Insights", itens: analise?.insights, icone: "sparkles" },
    { titulo: "Riscos", itens: analise?.riscos, icone: "alert" },
    { titulo: "Próximos passos", itens: analise?.proximosPassos, icone: "workflow" },
  ];

  const preenchidos = grupos.filter((grupo) => Array.isArray(grupo.itens) && grupo.itens.length > 0);

  return (
    <section className={`card pad ${styles.listas}`}>
      <h2 className={styles.tituloLateral}>Leitura da IA</h2>

      {preenchidos.length === 0 ? (
        <p className="subtle-text">
          Esta análise não trouxe insights, riscos nem próximos passos estruturados.
        </p>
      ) : (
        preenchidos.map((grupo) => (
          <div key={grupo.titulo}>
            <h3>
              <Icon name={grupo.icone} size={15} />
              {grupo.titulo}
            </h3>
            <ul>
              {grupo.itens.map((item, indice) => (
                <li key={`${grupo.titulo}-${indice}`}>{item}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
