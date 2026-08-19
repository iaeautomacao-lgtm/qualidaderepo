"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import AudioPlayer from "@/components/AudioPlayer";
import BotaoCopiar from "@/components/BotaoCopiar";
import TranscricaoFalantes from "@/components/TranscricaoFalantes";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import styles from "./page.module.css";

/**
 * Transcrição de uma gravação — e SÓ a transcrição.
 *
 * Antes esta tela acumulava transcrição, critérios, resumo executivo e chat: era
 * a ficha inteira dentro da fila de áudios. O julgamento migrou para
 * `/avaliacoes/ia/[id]` (critérios) e `/avaliacoes/ia/[id]/resumo` (leitura
 * executiva), porque avaliar é assunto de Avaliações, não de Transcrições.
 *
 * O que sobra aqui é o material bruto: o áudio e o que foi dito. A tela NÃO
 * oferece atalho para a avaliação — quem vai julgar entra por Avaliações, para
 * a fila de áudios não se confundir com a fila de monitoria.
 */

/** Análise antiga guardava a transcrição em texto com um cabeçalho fixo. */
function textoLegado(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/^ANALISE AUTOMATICA DA GRAVACAO \/ ARQUIVO\s*/i, "")
    .trim();
}

function ou(valor) {
  if (valor === null || valor === undefined) return "N/A";
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : "N/A";
}

function percentual(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return `${Math.round(numero > 1 ? numero : numero * 100)}%`;
}

export default function TranscricaoPage() {
  const params = useParams();
  const id = params?.id;
  const { dados, carregando, erro, recarregar } = useRecurso(
    id ? `/api/transcricoes/${encodeURIComponent(id)}` : null,
  );
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

  if (carregando && !gravacao) {
    return (
      <AppShell active="Transcrições" breadcrumb={`Transcrições > ${id || ""}`}>
        <div className={styles.esqueleto} aria-busy="true" aria-live="polite">
          <span className="sr-only">Carregando a transcrição.</span>
          <div className={`skeleton ${styles.esqueletoHero}`} />
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
            <h1>Não foi possível abrir a transcrição</h1>
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
  const audioUrl = gravacao.audioUrl || null;
  const temAvaliacao = Boolean(analise);

  return (
    <AppShell active="Transcrições" breadcrumb={`Transcrições > ${codigo}`}>
      <div className={styles.pagina}>
        <header className={styles.hero}>
          <div className={styles.heroTopo}>
            <span className={styles.heroIcone} aria-hidden="true">
              <Icon name="waveform" size={22} />
            </span>
            <div className={styles.heroIdent}>
              <p className={styles.heroSobre}>Transcrição da gravação</p>
              <h1>{ou(gravacao.arquivo)}</h1>
              <p className={styles.heroLinha}>
                <span className={styles.heroCodigo}>
                  {codigo}
                  <BotaoCopiar valor={String(codigo)} rotulo="código da gravação" />
                </span>
                <span aria-hidden="true">•</span>
                {ou(gravacao.cliente)}
                <span aria-hidden="true">•</span>
                {ou(gravacao.enviadaEm)}
                {duracao ? (
                  <>
                    <span aria-hidden="true">•</span>
                    {duracao}
                  </>
                ) : null}
                {percentual(confianca) ? (
                  <>
                    <span aria-hidden="true">•</span>
                    confiança da transcrição {percentual(confianca)}
                  </>
                ) : null}
              </p>
            </div>

            {/* Transcrição é material bruto e a tela para aqui: nenhum atalho
                para a avaliação. Quem quer o julgamento entra por Avaliações. */}
            <div className={styles.heroAcoes}>
              <Link className="btn" href="/transcricoes">
                <Icon name="chevronLeft" size={16} />
                Fila de transcrições
              </Link>
            </div>
          </div>
        </header>

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

        <TranscricaoFalantes
          texto={transcricao}
          vazioTexto="A transcrição desta gravação não foi salva no banco."
        />

        {/* Sem análise estruturada não há avaliação para abrir: o caminho de
            recuperação é gerar a análise a partir do arquivo já salvo. */}
        {!temAvaliacao ? (
          <section className="card pad">
            <div className="empty-state">
              <span className={`icon-badge ${gravacao.transcricao?.erro ? "danger" : "warning"}`}>
                <Icon name={gravacao.transcricao?.erro ? "error" : "info"} size={22} />
              </span>
              <h2>
                {gravacao.transcricao?.erro
                  ? "A IA não conseguiu processar este arquivo"
                  : "Esta gravação ainda não foi analisada"}
              </h2>
              <p>
                {gravacao.transcricao?.erro ||
                  "Não há transcrição nem análise salvas para esta gravação."}
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
                  {reprocessando ? "Gerando avaliação..." : "Gerar avaliação agora"}
                </button>
                <Link className="btn" href="/upload">
                  <Icon name="upload" size={16} />
                  Reenviar arquivo
                </Link>
              </div>
            </div>
          </section>
        ) : null}

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
