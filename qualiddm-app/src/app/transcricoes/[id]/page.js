"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import Abas, { PainelAba } from "@/components/Abas";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import ChatIa from "@/components/ChatIa";
import CriterioCard, { normalizarCriterio, percentual } from "@/components/CriterioCard";
import ResumoConformidade from "@/components/ResumoConformidade";
import TranscricaoFalantes from "@/components/TranscricaoFalantes";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
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

function listaTexto(valor) {
  return Array.isArray(valor) ? valor.filter(Boolean).map((item) => String(item).trim()).filter(Boolean) : [];
}

function resumoConformidade(analise, secoes) {
  const resumo = analise?.resumoConformidade || {};
  const criterios = secoes.flatMap((secao) => secao.criterios || []);
  const conformes =
    resumo.conformes != null
      ? Number(resumo.conformes) || 0
      : criterios.filter((item) => item.statusChave === "conforme").length;
  const naoConformes =
    resumo.naoConformes != null
      ? Number(resumo.naoConformes) || 0
      : criterios.filter((item) => item.statusChave === "nao_conforme").length;
  const naoAplicaveis =
    resumo.naoAplicaveis != null
      ? Number(resumo.naoAplicaveis) || 0
      : criterios.filter((item) => item.statusChave === "nao_aplicavel").length;
  const total = resumo.total != null ? Number(resumo.total) || 0 : criterios.length;
  return { conformes, naoConformes, naoAplicaveis, total };
}

const QUADRANTES = [
  { minimo: 90, rotulo: "Excelência operacional", tom: "success" },
  { minimo: 80, rotulo: "Conforme", tom: "success" },
  { minimo: 70, rotulo: "Atenção", tom: "warning" },
  { minimo: 0, rotulo: "Crítico", tom: "danger" },
];

function quadranteDaNota(valor) {
  const score = Number(valor);
  if (!Number.isFinite(score)) return { rotulo: "Sem nota", tom: "neutro" };
  return QUADRANTES.find((faixa) => score >= faixa.minimo) ?? QUADRANTES[QUADRANTES.length - 1];
}

function nivelConfianca(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "Não medida";
  if (numero >= 0.85) return "Alta";
  if (numero >= 0.7) return "Média";
  return "Baixa";
}

/**
 * Peso perdido, no total e por seção — a leitura estratégica da monitoria.
 *
 * A conta é a MESMA do backend (`normalizarAnaliseEstruturada` em
 * services/avaliacao-ia.js): critério eliminatório e não aplicável saem da base
 * de pontos, porque eliminatório zera a nota em vez de descontar peso e não
 * aplicável não é acerto nem erro. Se as duas contas divergirem, a tela passa a
 * contradizer a nota que ela mesma exibe — por isso a regra fica escrita aqui.
 *
 * O valor disso: "nota 84" não diz onde agir. "perdeu 16 pontos, 12 deles em
 * Negociação" diz.
 */
function impactoDaNota(secoes) {
  let total = 0;
  let obtido = 0;
  const porSecao = [];

  for (const secao of secoes) {
    let secaoTotal = 0;
    let secaoPerdido = 0;

    for (const criterio of secao.criterios || []) {
      if (criterio.eliminatoria || criterio.statusChave === "nao_aplicavel") continue;
      const peso = Math.max(0, Number(criterio.peso) || 0);
      secaoTotal += peso;
      total += peso;
      if (criterio.statusChave === "conforme") obtido += peso;
      else secaoPerdido += peso;
    }

    porSecao.push({
      nome: secao.nome,
      ancora: secao.ancora,
      total: secaoTotal,
      perdido: secaoPerdido,
      percentual: secaoTotal > 0 ? Math.round((secaoPerdido / secaoTotal) * 100) : 0,
    });
  }

  return {
    total,
    obtido,
    perdido: total - obtido,
    // Só seção que custou nota entra no ranking: listar as zeradas junto
    // esconderia a que importa no meio das outras.
    ofensoras: porSecao.filter((item) => item.perdido > 0).sort((a, b) => b.perdido - a.perdido),
  };
}

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "nao_conforme", rotulo: "Não conformes", alerta: true },
  { id: "conforme", rotulo: "Conformes" },
  { id: "nao_aplicavel", rotulo: "Não aplicáveis" },
];

export default function ResultadoTranscricaoPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}` : null,
  );
  const [aba, setAba] = useState("resumo");
  const [filtro, setFiltro] = useState("todos");
  const [reprocessando, setReprocessando] = useState(false);
  const [erroReprocessamento, setErroReprocessamento] = useState("");

  const gravacao = dados?.gravacao ?? null;
  const analise = gravacao?.transcricao?.segmentos ?? null;

  async function reprocessarAnalise() {
    if (!id || reprocessando) return;
    setReprocessando(true);
    setErroReprocessamento("");
    try {
      await enviarApi(`/api/transcricoes/${encodeURIComponent(id)}/reprocessar`, {});
      await recarregar();
    } catch (cause) {
      setErroReprocessamento(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a análise agora. Tente novamente.",
      );
    } finally {
      setReprocessando(false);
    }
  }

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
          <div className={`skeleton ${styles.esqueletoBloco}`} />
          <div className={`skeleton ${styles.esqueletoBlocoAlto}`} />
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
  const criterios = secoes.flatMap((secao) => secao.criterios || []);
  const resumo = resumoConformidade(analise, secoes);
  const scoreNumerico = Number(analise?.nota);
  const quadrante = quadranteDaNota(analise?.nota);
  const impacto = impactoDaNota(secoes);
  const pontosFortes = criterios.filter((item) => item.statusChave === "conforme").slice(0, 4);
  const falhasCriticas = criterios
    .filter((item) => item.statusChave === "nao_conforme")
    // Ordenado pelo peso: a falha que mais custou nota é a que abre o feedback.
    .sort((a, b) => (Number(b.peso) || 0) - (Number(a.peso) || 0))
    .slice(0, 5);
  const insights = listaTexto(analise?.insights);
  const riscos = listaTexto(analise?.riscos);
  const proximosPassos = listaTexto(analise?.proximosPassos);
  const leituraExecutiva = [
    Number.isFinite(scoreNumerico) ? `Nota ${nota(scoreNumerico)} — quadrante ${quadrante.rotulo}.` : null,
    resumo.total > 0
      ? `${resumo.conformes} conforme(s), ${resumo.naoConformes} não conforme(s) e ${resumo.naoAplicaveis} não aplicável(is).`
      : null,
    impacto.perdido > 0
      ? `${impacto.perdido} de ${impacto.total} pontos perdidos${
          impacto.ofensoras[0] ? `, concentrados em ${impacto.ofensoras[0].nome}.` : "."
        }`
      : null,
    riscos[0] ? `Risco principal: ${riscos[0]}` : null,
    proximosPassos[0] ? `Ação recomendada: ${proximosPassos[0]}` : null,
  ].filter(Boolean);

  // `audioUrl` já vem `null` quando o arquivo saiu do armazenamento — a tela
  // não monta a rota por conta própria para não exibir um player que não toca.
  const audioUrl = gravacao.audioUrl || null;

  const kpis = [
    { rotulo: "Nota", valor: nota(analise?.nota), nota: quadrante.rotulo, destaque: true, tom: quadrante.tom },
    {
      rotulo: "Não conformes",
      valor: String(totalNaoConformes),
      nota: impacto.perdido > 0 ? `${impacto.perdido} pts perdidos` : "Nenhum ponto perdido",
      tom: totalNaoConformes > 0 ? "danger" : "success",
    },
    {
      rotulo: "Confiança",
      valor: percentual(confianca) || "N/A",
      // O print do QualiTalk traz um "?" com tooltip aqui. Tooltip não existe no
      // toque e não é lido por leitor de tela: a explicação fica escrita.
      nota: `Leitura ${nivelConfianca(confianca).toLowerCase()} — quanto a IA achou a transcrição suficiente para julgar.`,
    },
    { rotulo: "Duração", valor: ou(duracao) },
    { rotulo: "Persona", valor: ou(analise?.persona || analise?.carteira || gravacao.cliente) },
  ];

  const contagemFiltro = {
    todos: criterios.length,
    nao_conforme: totalNaoConformes,
    conforme: resumo.conformes,
    nao_aplicavel: resumo.naoAplicaveis,
  };

  const criteriosVisiveis =
    filtro === "todos"
      ? secoes
      : secoes
          .map((secao) => ({
            ...secao,
            criterios: secao.criterios.filter((item) => item.statusChave === filtro),
          }))
          .filter((secao) => secao.criterios.length > 0);

  const abas = [
    { id: "resumo", rotulo: "Resumo executivo", icone: "gauge" },
    {
      id: "criterios",
      rotulo: "Critérios",
      icone: "checklist",
      contagem: totalNaoConformes || criterios.length,
      alerta: totalNaoConformes > 0,
      unidade: totalNaoConformes > 0 ? "não conformes" : "critérios",
    },
    { id: "transcricao", rotulo: "Transcrição", icone: "waveform" },
    { id: "chat", rotulo: "Perguntar à IA", icone: "sparkles" },
  ];

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
              <button className="btn" type="button" onClick={() => window.print()}>
                <Icon name="printer" size={16} />
                Imprimir ficha
              </button>
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
              <div
                key={kpi.rotulo}
                data-destaque={kpi.destaque ? "true" : undefined}
                data-tom={kpi.tom}
              >
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
              <span className={`icon-badge ${gravacao.transcricao?.erro ? "danger" : "warning"}`}>
                <Icon name={gravacao.transcricao?.erro ? "error" : "info"} size={22} />
              </span>
              <h2>
                {gravacao.transcricao?.erro
                  ? "A IA não conseguiu gerar a análise"
                  : "Análise sem ficha estruturada"}
              </h2>
              <p>
                {gravacao.transcricao?.erro ||
                  "Esta gravação ainda não tem critérios, nota e evidências salvos no banco."}
              </p>
              <p>
                Use o arquivo já salvo para gerar a análise completa da IA. Se o erro mencionar
                chave/API da IA, ajuste o ambiente no cPanel e rode novamente.
              </p>
              {erroReprocessamento ? (
                <p className="alert danger">
                  <Icon name="error" size={18} />
                  <span className="alert-body">
                    <strong>Reprocessamento não concluído</strong>
                    <span>{erroReprocessamento}</span>
                  </span>
                </p>
              ) : null}
              <div className="btn-row">
                <button
                  className="btn primary"
                  type="button"
                  onClick={reprocessarAnalise}
                  disabled={reprocessando || !gravacao.armazenada}
                >
                  <Icon name="sparkles" size={16} />
                  {reprocessando ? "Gerando análise..." : "Gerar análise agora"}
                </button>
                <Link className="btn" href="/upload">
                  <Icon name="upload" size={16} />
                  Reenviar arquivo
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* O player fica FORA das abas: quem ouve o áudio precisa dele enquanto
            lê critério, transcrição ou conversa com a IA. Dentro de uma aba, o
            áudio continuaria tocando sem controle visível ao trocar de bloco. */}
        <section className={`card pad ${styles.cartaoAudio}`}>
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

        <Abas
          abas={abas}
          atual={aba}
          onTrocar={setAba}
          prefixo="ia"
          rotulo="Blocos da avaliação IA"
        />

        {/* --- Resumo executivo ------------------------------------------- */}
        <PainelAba id="resumo" atual={aba} prefixo="ia" className={styles.painel}>
          {analise ? (
            <section className={`card pad ${styles.executivo}`} aria-labelledby="leitura-executiva">
              <div className="section-head">
                <div>
                  <h2 id="leitura-executiva">Leitura executiva da monitoria</h2>
                  <p>Resumo para supervisor, qualidade e treinamento.</p>
                </div>
                <span className={`chip ${confiancaBaixa ? "warning" : "success"}`}>
                  <Icon name={confiancaBaixa ? "alert" : "checkCircle"} size={13} />
                  Confiança {nivelConfianca(confianca)}
                </span>
              </div>

              <div className={styles.gradeExecutiva}>
                <article>
                  <span className="icon-badge" aria-hidden="true">
                    <Icon name="gauge" size={18} />
                  </span>
                  <h3>Resultado</h3>
                  <p>{leituraExecutiva[0] || "Sem nota estruturada."}</p>
                </article>
                <article>
                  <span className="icon-badge warning" aria-hidden="true">
                    <Icon name="alert" size={18} />
                  </span>
                  <h3>Risco operacional</h3>
                  <p>{riscos[0] || "Nenhum risco estruturado foi retornado pela IA."}</p>
                </article>
                <article>
                  <span className="icon-badge success" aria-hidden="true">
                    <Icon name="checkCircle" size={18} />
                  </span>
                  <h3>Próxima ação</h3>
                  <p>{proximosPassos[0] || "Revisar evidências e liberar feedback quando aplicável."}</p>
                </article>
              </div>

              {leituraExecutiva.length > 1 ? (
                <ul className={styles.resumoExecutivo}>
                  {leituraExecutiva.slice(1).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <ResumoConformidade
            resumo={analise?.resumoConformidade}
            pesos={impacto.total > 0 ? { obtido: impacto.obtido, total: impacto.total } : undefined}
          />

          {analise ? (
            <ImpactoNaNota
              impacto={impacto}
              falhas={falhasCriticas}
              onIrParaCriterios={(ancora) => {
                setFiltro("todos");
                setAba("criterios");
                // A âncora só existe depois do painel aparecer: o salto espera o
                // próximo quadro em vez de correr contra a troca de aba.
                requestAnimationFrame(() => {
                  document.getElementById(ancora)?.scrollIntoView({ block: "start" });
                });
              }}
            />
          ) : null}

          {analise ? (
            <section className="card pad">
              <div className="section-head">
                <div>
                  <h2>Gestão da avaliação</h2>
                  <p>O que deve virar feedback, calibragem ou treinamento.</p>
                </div>
              </div>
              <div className={styles.gradeGestao}>
                <PainelAchados
                  titulo="Falhas que precisam de ação"
                  icone="alert"
                  itens={falhasCriticas.map((item) => ({
                    titulo: item.nome,
                    texto: item.raciocinio || item.evidencia || "Sem raciocínio estruturado.",
                    peso: item.peso,
                  }))}
                  vazio="Nenhuma falha estruturada na análise."
                  tom="danger"
                />
                <PainelAchados
                  titulo="Pontos fortes para reconhecer"
                  icone="checkCircle"
                  itens={pontosFortes.map((item) => ({
                    titulo: item.nome,
                    texto: item.evidencia || item.raciocinio || "Conformidade identificada pela IA.",
                  }))}
                  vazio="Nenhum ponto forte estruturado na análise."
                  tom="success"
                />
                <PainelAchados
                  titulo="Próximos passos"
                  icone="workflow"
                  itens={proximosPassos.map((item, indice) => ({
                    titulo: `Ação ${indice + 1}`,
                    texto: item,
                  }))}
                  vazio="A IA não retornou plano de ação estruturado."
                  tom="warning"
                />
              </div>
            </section>
          ) : null}

          <PainelListas insights={insights} riscos={riscos} proximosPassos={proximosPassos} />
        </PainelAba>

        {/* --- Critérios --------------------------------------------------- */}
        <PainelAba id="criterios" atual={aba} prefixo="ia" className={styles.painel}>
          <section className="card pad">
            <div className="section-head">
              <div>
                <h2>Respostas e Avaliações</h2>
                <p>
                  {secoes.length} {secoes.length === 1 ? "seção" : "seções"} ·{" "}
                  {criterios.length} critérios
                  {totalNaoConformes > 0 ? ` · ${totalNaoConformes} não conformes` : ""}
                </p>
              </div>
              <p className="section-meta">
                Formulário: {ou(analise?.formulario || analise?.campanha)}
              </p>
            </div>

            {secoes.length === 0 ? (
              <div className="empty-state">
                <span className="icon-badge">
                  <Icon name="checklist" size={20} />
                </span>
                <h3>Nenhum critério estruturado</h3>
                <p>Esta análise não trouxe seções de formulário preenchidas.</p>
              </div>
            ) : (
              <>
                {/* Filtro por status + índice das seções na mesma barra: era uma
                    coluna lateral de 360px que, grudada na rolagem, passava por
                    cima dos cartões vizinhos. Na horizontal, ninguém sobrepõe
                    ninguém e sobra largura para o critério. */}
                <div className={styles.barraCriterios}>
                  <div className="jump-chips" role="group" aria-label="Filtrar critérios por status">
                    {FILTROS.map((item) => {
                      const quantidade = contagemFiltro[item.id] ?? 0;
                      const ativo = filtro === item.id;
                      return (
                        <button
                          className="jump-chip"
                          key={item.id}
                          type="button"
                          aria-pressed={ativo}
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

                  {criteriosVisiveis.length > 1 ? (
                    <nav className={styles.indiceSecoes} aria-label="Ir para uma seção">
                      <span className="label-micro">Seções</span>
                      <div className="jump-chips">
                        {criteriosVisiveis.map((secao) => (
                          <a
                            className="jump-chip"
                            href={`#${secao.ancora}`}
                            key={`ir-${secao.ancora}`}
                            data-falha={secao.naoConformes > 0 ? "true" : undefined}
                          >
                            <span>{secao.nome}</span>
                            <span>
                              {secao.naoConformes > 0 ? secao.naoConformes : secao.criterios.length}
                              <span className="sr-only">
                                {secao.naoConformes > 0 ? " não conformes" : " critérios"}
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </nav>
                  ) : null}
                </div>

                {criteriosVisiveis.length === 0 ? (
                  <div className="empty-state">
                    <span className="icon-badge success">
                      <Icon name="checkCircle" size={20} />
                    </span>
                    <h3>Nenhum critério neste status</h3>
                    <p>Troque o filtro para ver os demais critérios da ficha.</p>
                    <div className="btn-row">
                      <button className="btn" type="button" onClick={() => setFiltro("todos")}>
                        Mostrar todos os critérios
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.secoes}>
                    {criteriosVisiveis.map((secao) => (
                      <section className={styles.secao} id={secao.ancora} key={secao.ancora}>
                        <div className={styles.secaoCabecalho}>
                          <div>
                            <h3>{secao.nome}</h3>
                            {secao.descricao ? <p>{secao.descricao}</p> : null}
                          </div>
                          {secao.naoConformes > 0 ? (
                            <span className="chip danger">
                              <Icon name="error" size={13} />
                              {secao.naoConformes} não conforme(s)
                            </span>
                          ) : (
                            <span className="chip success">
                              <Icon name="checkCircle" size={13} />
                              Seção conforme
                            </span>
                          )}
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
              </>
            )}
          </section>
        </PainelAba>

        {/* --- Transcrição ------------------------------------------------- */}
        <PainelAba id="transcricao" atual={aba} prefixo="ia" className={styles.painel}>
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
        </PainelAba>

        {/* --- Chat -------------------------------------------------------- */}
        <PainelAba id="chat" atual={aba} prefixo="ia" className={styles.painel}>
          <ChatIa
            escopo="gravacao"
            referencia={id ? String(id) : ""}
            descricao="Sobre a transcrição, os critérios e o feedback desta gravação."
          />
        </PainelAba>

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

/**
 * Onde a nota foi perdida — o bloco que transforma "nota 84" em plano de ação.
 *
 * Nada aqui é inventado pela tela: os pesos vêm do formulário aplicado e o
 * status de cada critério vem da IA. O que a tela faz é somar e ordenar, que é
 * exatamente o trabalho que o supervisor fazia de cabeça lendo 24 cartões.
 */
function ImpactoNaNota({ impacto, falhas, onIrParaCriterios }) {
  if (impacto.total === 0) {
    return null;
  }

  const perfeito = impacto.perdido === 0;

  return (
    <section className={`card pad ${styles.impacto}`} aria-labelledby="impacto-nota">
      <div className="section-head">
        <div>
          <h2 id="impacto-nota">Onde a nota foi perdida</h2>
          <p>Peso do formulário por seção — a fila de prioridade do feedback.</p>
        </div>
        <span className={`chip ${perfeito ? "success" : "danger"}`}>
          <Icon name={perfeito ? "checkCircle" : "trendDown"} size={13} />
          {perfeito
            ? `${impacto.obtido} de ${impacto.total} pontos`
            : `−${impacto.perdido} de ${impacto.total} pontos`}
        </span>
      </div>

      {perfeito ? (
        <p className="subtle-text">
          Nenhum ponto perdido nos critérios aplicáveis. Use as evidências para reconhecer a
          conformidade em calibragem.
        </p>
      ) : (
        <>
          <div className="progress-list">
            {impacto.ofensoras.map((secao) => (
              <div className="progress-item" key={`impacto-${secao.ancora}`}>
                <div className="progress-head">
                  <span className="progress-name">{secao.nome}</span>
                  <span className="progress-value">
                    −{secao.perdido} de {secao.total} pts ({secao.percentual}%)
                  </span>
                </div>
                {/* `role="img"` com rótulo: a barra é gráfico, e o número ao lado
                    já dá o valor exato para quem não a vê. */}
                <div
                  className="progress-track"
                  role="img"
                  aria-label={`${secao.nome}: ${secao.percentual}% do peso perdido`}
                >
                  <div className="progress-bar" style={{ "--w": `${secao.percentual}%` }} />
                </div>
              </div>
            ))}
          </div>

          {falhas.length > 0 ? (
            <div className={styles.filaFalhas}>
              <span className="label-micro">Critérios mais caros</span>
              <ul>
                {falhas.slice(0, 3).map((item) => (
                  <li key={`caro-${item.id}`}>
                    <strong>{item.nome}</strong>
                    {Number.isFinite(Number(item.peso)) ? (
                      <span className={styles.pesoFalha}>{item.peso} pts</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="btn-row">
            <button
              className="btn"
              type="button"
              onClick={() => onIrParaCriterios(impacto.ofensoras[0]?.ancora)}
            >
              <Icon name="checklist" size={16} />
              Abrir {impacto.ofensoras[0]?.nome || "os critérios"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PainelAchados({ titulo, icone, itens, vazio, tom }) {
  const lista = Array.isArray(itens) ? itens.filter((item) => item?.titulo || item?.texto) : [];

  return (
    <article className={`${styles.achados} ${styles[`achados${tom || "default"}`] || ""}`}>
      <h3>
        <Icon name={icone} size={17} />
        {titulo}
      </h3>
      {lista.length === 0 ? (
        <p>{vazio}</p>
      ) : (
        <ul>
          {lista.slice(0, 4).map((item, indice) => (
            <li key={`${titulo}-${indice}`}>
              <strong>
                {item.titulo}
                {Number.isFinite(Number(item.peso)) && Number(item.peso) > 0 ? (
                  <span className={styles.pesoFalha}>{item.peso} pts</span>
                ) : null}
              </strong>
              <span>{item.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Insights, riscos e próximos passos — as três listas soltas da IA. */
function PainelListas({ insights, riscos, proximosPassos }) {
  const grupos = [
    { titulo: "Insights", itens: insights, icone: "sparkles" },
    { titulo: "Riscos", itens: riscos, icone: "alert" },
    { titulo: "Próximos passos", itens: proximosPassos, icone: "workflow" },
  ].filter((grupo) => grupo.itens.length > 0);

  if (grupos.length === 0) {
    return (
      <section className="card pad">
        <h2 className={styles.tituloLateral}>Leitura da IA</h2>
        <p className="subtle-text">
          Esta análise não trouxe insights, riscos nem próximos passos estruturados.
        </p>
      </section>
    );
  }

  return (
    <section className={`card pad ${styles.listas}`} aria-labelledby="leitura-ia">
      <div className="section-head">
        <div>
          <h2 id="leitura-ia">Leitura da IA</h2>
          <p>O que a IA observou além da nota.</p>
        </div>
      </div>

      <div className={styles.gradeListas}>
        {grupos.map((grupo) => (
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
        ))}
      </div>
    </section>
  );
}
