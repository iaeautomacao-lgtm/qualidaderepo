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
  if (status === "nao_conforme") return "Não Conforme";
  if (status === "nao_aplicavel") return "Não Aplicável";
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

export default function ResultadoTranscricaoPage() {
  const params = useParams();
  const id = params?.id;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

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
          throw new Error(payload?.error?.message || "Não foi possível carregar a análise.");
        }
        if (ativo) setDados(payload?.data?.gravacao || payload?.gravacao || null);
      } catch (causa) {
        if (ativo) setErro(causa instanceof Error ? causa.message : "Não foi possível carregar a análise.");
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
  const texto = dados?.transcricao?.texto || analise?.transcricao || "";
  const resumo = analise?.resumoConformidade || {
    conformes: 0,
    naoConformes: 0,
    naoAplicaveis: 0,
    total: 0,
  };
  const secoes = Array.isArray(analise?.secoes) ? analise.secoes : [];

  const indicadores = useMemo(
    () => [
      { rotulo: "Carteira", valor: analise?.carteira || dados?.cliente || "Não informada" },
      { rotulo: "Nota", valor: nota(analise?.nota), destaque: true },
      { rotulo: "Confiança", valor: pct(analise?.confianca ?? dados?.transcricao?.confianca) },
      { rotulo: "Duração", valor: dados?.duracao || "N/A" },
    ],
    [analise, dados],
  );

  return (
    <AppShell active="Transcrições" breadcrumb={`Qualidade > Resultado IA > ${id || ""}`}>
      <section className="page-header">
        <div>
          <p className="eyebrow">Resultado da IA</p>
          <h1>Detalhes da Análise IA</h1>
          <p>
            {dados?.arquivo || "Arquivo enviado"} {dados?.campanha ? `· ${dados.campanha}` : ""}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href="/upload">
            <Icon name="chevronLeft" size={17} />
            Voltar ao upload
          </Link>
          <Link className="btn" href="/transcricoes">
            <Icon name="waveform" size={17} />
            Ver fila
          </Link>
        </div>
      </section>

      {carregando ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge">
              <Icon className="spinning" name="spinner" size={22} />
            </span>
            <h3>Carregando análise</h3>
            <p>Aguarde enquanto buscamos o resultado salvo.</p>
          </div>
        </section>
      ) : erro ? (
        <section className="card pad">
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível abrir o resultado</h3>
            <p>{erro}</p>
          </div>
        </section>
      ) : (
        <div className={styles.layout}>
          <section className={styles.cards} aria-label="Indicadores principais">
            {indicadores.map((item) => (
              <article className="card pad" key={item.rotulo}>
                <span className="label-micro">{item.rotulo}</span>
                <strong className={item.destaque ? styles.nota : styles.cardValue}>{item.valor}</strong>
              </article>
            ))}
          </section>

          <section className="card pad">
            <div className="section-head">
              <div>
                <h2>Resumo da IA</h2>
                <p>{analise?.resumo || "Análise concluída sem resumo estruturado."}</p>
              </div>
              {analise?.zerada ? <span className="chip danger">Avaliação zerada</span> : null}
            </div>
            <p className={styles.observacao}>
              {analise?.observacoesIa || "A análise antiga foi salva apenas como texto. Reenvie o arquivo para gerar critérios, nota e evidências."}
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
                <span>Não Conformes</span>
              </div>
              <div>
                <strong className={styles.warnNumber}>{resumo.naoAplicaveis || 0}</strong>
                <span>Não Aplicáveis</span>
              </div>
              <div>
                <strong>{resumo.total || 0}</strong>
                <span>Total</span>
              </div>
            </div>
          </section>

          <section className="card pad">
            <h2>Transcrição / Conteúdo</h2>
            <pre className={styles.transcricao}>{analise?.transcricao || texto || "Sem transcrição salva."}</pre>
          </section>

          <section className="card pad">
            <h2>Insights e Próximos Passos</h2>
            <div className={styles.insightGrid}>
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
                <h3>Próximos passos</h3>
                <ul>
                  {listaOuVazio(analise?.proximosPassos, "Nenhuma ação sugerida.").map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="card pad">
            <h2>Respostas e Avaliações</h2>
            {secoes.length === 0 ? (
              <p className="subtle-text">Não há critérios estruturados nesta análise.</p>
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
                              <strong>Evidência da IA</strong>
                              <span>Confiança: {pct(criterio.confianca)}</span>
                              <p>{criterio.evidencia}</p>
                            </div>
                          ) : null}

                          <div className={styles.raciocinio}>
                            <strong>Notas da IA (raciocínio)</strong>
                            <p>{criterio.raciocinio}</p>
                          </div>

                          <p className={styles.peso}>
                            {criterio.eliminatoria ? "Critério eliminatório" : `Peso: ${criterio.peso ?? 0} pts`}
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
      )}
    </AppShell>
  );
}
