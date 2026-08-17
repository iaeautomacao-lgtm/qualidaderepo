"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

function pct(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "N/A";
  return `${Math.round((numero > 1 ? numero / 100 : numero) * 100)}%`;
}

function nota(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0.00";
  return numero.toFixed(2);
}

function statusLabel(status) {
  if (status === "conforme") return "Conforme";
  if (status === "nao_conforme") return "Nao Conforme";
  if (status === "nao_aplicavel") return "Nao Aplicavel";
  return "Revisar";
}

function statusClass(status) {
  if (status === "conforme") return styles.ok;
  if (status === "nao_conforme") return styles.bad;
  if (status === "nao_aplicavel") return styles.neutral;
  return styles.warn;
}

function listaOuVazio(itens, vazio) {
  return Array.isArray(itens) && itens.length > 0 ? itens : [vazio];
}

function textoLegado(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/^ANALISE AUTOMATICA DA GRAVACAO \/ ARQUIVO\s*/i, "")
    .trim();
}

function criteriosNaoConformes(secoes) {
  return secoes
    .flatMap((secao) =>
      (secao.criterios || []).map((criterio) => ({
        ...criterio,
        secao: secao.nome,
      })),
    )
    .filter((criterio) => criterio.status === "nao_conforme");
}

function montarRespostaChat(pergunta, contexto) {
  const texto = pergunta.toLowerCase();
  const { analise, secoes, naoConformes, transcricao } = contexto;

  if (!analise) {
    return "Esta analise ainda nao tem JSON estruturado. Para eu responder sobre nota, evidencias e operador, reenvie o arquivo para gerar a ficha completa.";
  }

  if (texto.includes("nota") || texto.includes("score")) {
    return `A nota calculada foi ${nota(analise.nota)} com confianca de ${pct(analise.confianca)}. A nota considera apenas criterios aplicaveis e zera se houver NCG nao conforme.`;
  }

  if (texto.includes("operador") || texto.includes("avaliado") || texto.includes("feedback")) {
    const pontos = naoConformes.slice(0, 4).map((criterio) => `${criterio.nome}: ${criterio.raciocinio}`);
    if (pontos.length === 0) {
      return "Nao encontrei nao conformidades na ficha estruturada. O feedback ao operador deve reforcar os pontos conformes e manter o padrao do atendimento.";
    }
    return `Para feedback do operador, priorize: ${pontos.join(" | ")}`;
  }

  if (texto.includes("risco") || texto.includes("grave") || texto.includes("ncg")) {
    const riscos = listaOuVazio(analise.riscos, "Nenhum risco critico foi identificado.");
    const ncg = secoes.find((secao) => String(secao.nome).toLowerCase().includes("ncg"));
    const falhasNcg = (ncg?.criterios || []).filter((criterio) => criterio.status === "nao_conforme");
    return falhasNcg.length > 0
      ? `Ha NCG nao conforme: ${falhasNcg.map((item) => item.nome).join(", ")}. Riscos: ${riscos.join(" | ")}`
      : `Nao ha NCG nao conforme. Riscos apontados: ${riscos.join(" | ")}`;
  }

  if (texto.includes("evidencia") || texto.includes("trecho") || texto.includes("transcricao")) {
    const comEvidencia = naoConformes.find((criterio) => criterio.evidencia) ||
      secoes.flatMap((secao) => secao.criterios || []).find((criterio) => criterio.evidencia);
    return comEvidencia
      ? `Trecho relevante: "${comEvidencia.evidencia}" (${comEvidencia.nome}, confianca ${pct(comEvidencia.confianca)}).`
      : `Nao encontrei evidencia destacada nos criterios. Trecho inicial da transcricao: ${String(transcricao || "").slice(0, 260)}`;
  }

  const proximos = listaOuVazio(analise.proximosPassos, "Revisar a analise e validar evidencias antes de aplicar feedback.");
  return `Resumo: ${analise.resumo}. Proximos passos: ${proximos.join(" | ")}`;
}

export default function ResultadoTranscricaoPage() {
  const params = useParams();
  const id = params?.id;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState([
    {
      autor: "ia",
      texto: "Pergunte sobre nota, operador, riscos, evidencias ou proximos passos desta monitoria.",
    },
  ]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const resposta = await fetch(`/api/transcricoes/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || payload?.ok === false) {
          throw new Error(payload?.error?.message || "Nao foi possivel carregar a analise.");
        }
        if (ativo) setDados(payload?.data?.gravacao || payload?.gravacao || null);
      } catch (causa) {
        if (ativo) setErro(causa instanceof Error ? causa.message : "Nao foi possivel carregar a analise.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    if (id) carregar();
    return () => {
      ativo = false;
    };
  }, [id]);

  const analise = dados?.transcricao?.segmentos || null;
  const texto = dados?.transcricao?.texto || "";
  const transcricao = analise?.transcricao || textoLegado(texto);
  const resumo = analise?.resumoConformidade || {
    conformes: 0,
    naoConformes: 0,
    naoAplicaveis: 0,
    total: 0,
  };
  const secoes = useMemo(
    () => (Array.isArray(analise?.secoes) ? analise.secoes : []),
    [analise],
  );
  const naoConformes = useMemo(() => criteriosNaoConformes(secoes), [secoes]);
  const geradaEm = dados?.transcricao?.geradaEm || dados?.enviadaEm || "N/A";
  const campanha = analise?.campanha || dados?.campanha || "Nao informada";
  const carteira = analise?.carteira || dados?.cliente || "Nao informada";

  const confiancaBaixa = Number(analise?.confianca ?? dados?.transcricao?.confianca ?? 0) < 0.7;

  function enviarPergunta(evento) {
    evento.preventDefault();
    const valor = pergunta.trim();
    if (!valor) return;
    const resposta = montarRespostaChat(valor, {
      analise,
      secoes,
      naoConformes,
      transcricao,
    });
    setMensagens((atuais) => [...atuais, { autor: "usuario", texto: valor }, { autor: "ia", texto: resposta }]);
    setPergunta("");
  }

  return (
    <AppShell active="Transcrições" breadcrumb={`Qualidade > Resultado IA > ${id || ""}`}>
      {carregando ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge">
              <Icon className="spinning" name="spinner" size={22} />
            </span>
            <h3>Carregando analise</h3>
            <p>Aguarde enquanto buscamos o resultado salvo.</p>
          </div>
        </section>
      ) : erro ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Nao foi possivel abrir o resultado</h3>
            <p>{erro}</p>
          </div>
        </section>
      ) : (
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <span className={styles.heroIcon}>
                <Icon name="review" size={30} />
              </span>
              <div className={styles.heroTitle}>
                <p className={styles.eyebrow}>Ficha de monitoria IA</p>
                <h1>{campanha !== "Nao informada" ? campanha : "Monitoria automatica"}</h1>
                <p>
                  Resultado IA · ID: {id} · {dados?.arquivo || "Arquivo enviado"}
                </p>
              </div>
              <div className={styles.heroActions}>
                <Link className="btn" href="/upload">
                  <Icon name="chevronLeft" size={17} />
                  Voltar ao upload
                </Link>
                <Link className="btn" href="/transcricoes">
                  <Icon name="waveform" size={17} />
                  Ver fila
                </Link>
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div>
                <span>Cliente / carteira</span>
                <strong>{carteira}</strong>
              </div>
              <div>
                <span>Campanha</span>
                <strong>{campanha}</strong>
              </div>
              <div>
                <span>Codigo da gravacao</span>
                <strong>{dados?.arquivo || `ID ${id}`}</strong>
              </div>
              <div>
                <span>Score</span>
                <strong>{nota(analise?.nota)}</strong>
              </div>
              <div>
                <span>Duracao</span>
                <strong>{dados?.duracao || "N/A"}</strong>
              </div>
              <div>
                <span>Confianca IA</span>
                <strong>{pct(analise?.confianca ?? dados?.transcricao?.confianca)}</strong>
              </div>
            </div>

            <div className={styles.identityGrid}>
              <div>
                <span>Usuario avaliado</span>
                <strong>Identificar no atendimento</strong>
              </div>
              <div>
                <span>Monitor</span>
                <strong>IA QualiDDM</strong>
              </div>
              <div>
                <span>Formulario</span>
                <strong>{analise ? "Ficha IA generica por carteira" : "Analise legada"}</strong>
              </div>
              <div>
                <span>Data da analise</span>
                <strong>{geradaEm}</strong>
              </div>
            </div>
          </section>

          <section className={styles.audioPanel}>
            <button className={styles.playButton} type="button" aria-label="Audio indisponivel na previa">
              <Icon name="play" size={20} />
            </button>
            <div className={styles.fakeTrack}>
              <span />
            </div>
            <span>{dados?.duracao || "N/A"}</span>
            <Icon name="volume" size={18} />
            <span>1x</span>
          </section>

          {confiancaBaixa ? (
            <p className="alert warning">
              <Icon name="alert" size={18} />
              <span className="alert-body">
                <strong>Revisao humana recomendada</strong>
                <span>A confianca da IA ficou abaixo de 70%. Use as evidencias antes de aplicar feedback.</span>
              </span>
            </p>
          ) : null}

          <div className={styles.mainGrid}>
            <div className={styles.leftColumn}>
              <section className="card pad">
                <div className="section-head">
                  <div>
                    <h2>Feedback global sobre a avaliacao</h2>
                    <p>{analise?.resumo || "Analise concluida sem resumo estruturado."}</p>
                  </div>
                  {analise?.zerada ? <span className="chip danger">Zerada</span> : null}
                </div>
                <p className={styles.observacao}>
                  {analise?.observacoesIa ||
                    "Este registro nao possui ficha estruturada. Reenvie o arquivo para gerar nota, evidencias e criterios."}
                </p>
              </section>

              <section className="card pad">
                <h2>Resumo de Conformidade</h2>
                <div className={styles.resumoGrid}>
                  <div>
                    <strong className={styles.goodNumber}>{resumo.conformes || 0}</strong>
                    <span>Conformes</span>
                  </div>
                  <div>
                    <strong className={styles.badNumber}>{resumo.naoConformes || 0}</strong>
                    <span>Nao Conformes</span>
                  </div>
                  <div>
                    <strong className={styles.warnNumber}>{resumo.naoAplicaveis || 0}</strong>
                    <span>Nao Aplicaveis</span>
                  </div>
                  <div>
                    <strong>{resumo.total || 0}</strong>
                    <span>Total</span>
                  </div>
                </div>
              </section>

              <section className="card pad">
                <h2>Transcricao / Conteudo</h2>
                <pre className={styles.transcricao}>{transcricao || "Sem transcricao salva."}</pre>
              </section>

              <section className="card pad">
                <h2>Respostas e Avaliacoes</h2>
                {secoes.length === 0 ? (
                  <p className="subtle-text">Nao ha criterios estruturados nesta analise.</p>
                ) : (
                  <div className={styles.secoes}>
                    {secoes.map((secao) => (
                      <section className={styles.secao} key={secao.nome}>
                        <div className={styles.secaoHead}>
                          <h3>{secao.nome}</h3>
                          {secao.descricao ? <p>{secao.descricao}</p> : null}
                        </div>
                        <div className={styles.criterios}>
                          {(secao.criterios || []).map((criterio) => (
                            <article className={styles.criterio} key={`${secao.nome}-${criterio.nome}`}>
                              <div className={styles.criterioTop}>
                                <div>
                                  <h4>{criterio.nome}</h4>
                                  {criterio.descricao ? <p>{criterio.descricao}</p> : null}
                                </div>
                                <span className={`${styles.status} ${statusClass(criterio.status)}`}>
                                  {statusLabel(criterio.status)}
                                </span>
                              </div>

                              <p>
                                <strong>Resposta:</strong> {criterio.resposta || statusLabel(criterio.status)}
                              </p>

                              {criterio.evidencia ? (
                                <div className={styles.evidencia}>
                                  <strong>Evidencia da IA</strong>
                                  <span>Confianca: {pct(criterio.confianca)}</span>
                                  <p>{criterio.evidencia}</p>
                                </div>
                              ) : null}

                              <div className={styles.raciocinio}>
                                <strong>Notas da IA (raciocinio)</strong>
                                <p>{criterio.raciocinio}</p>
                              </div>

                              <p className={styles.peso}>
                                {criterio.eliminatoria ? "Criterio eliminatorio" : `Peso: ${criterio.peso ?? 0} pts`}
                              </p>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className={styles.rightColumn}>
              <section className="card pad">
                <h2>Insights da IA</h2>
                <div className={styles.insightStack}>
                  <div>
                    <h3>Insights</h3>
                    <ul>
                      {listaOuVazio(analise?.insights, "Nenhum insight identificado.").map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Riscos</h3>
                    <ul>
                      {listaOuVazio(analise?.riscos, "Nenhum risco identificado.").map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Proximos passos</h3>
                    <ul>
                      {listaOuVazio(analise?.proximosPassos, "Nenhuma acao sugerida.").map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className={`card pad ${styles.chatCard}`}>
                <div className="section-head">
                  <div>
                    <h2>Chat da IA</h2>
                    <p>Pergunte sobre operador, nota, risco ou evidencia.</p>
                  </div>
                </div>

                <div className={styles.chatLog} aria-live="polite">
                  {mensagens.map((mensagem, index) => (
                    <div
                      className={`${styles.message} ${mensagem.autor === "usuario" ? styles.userMessage : styles.aiMessage}`}
                      key={`${mensagem.autor}-${index}`}
                    >
                      <span>{mensagem.autor === "usuario" ? "Voce" : "IA"}</span>
                      <p>{mensagem.texto}</p>
                    </div>
                  ))}
                </div>

                <form className={styles.chatForm} onSubmit={enviarPergunta}>
                  <label className="sr-only" htmlFor="pergunta-ia">
                    Pergunta para IA
                  </label>
                  <input
                    className="input"
                    id="pergunta-ia"
                    placeholder="Ex: o que falar para o operador?"
                    value={pergunta}
                    onChange={(evento) => setPergunta(evento.target.value)}
                  />
                  <button className="btn primary" type="submit">
                    <Icon name="sparkles" size={16} />
                    Perguntar
                  </button>
                </form>
              </section>
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}
