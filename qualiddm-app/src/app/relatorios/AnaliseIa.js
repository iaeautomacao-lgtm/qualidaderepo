"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

/**
 * Painel de resultado das análises com IA.
 *
 * Fica ao lado da página (e não em /components) porque só a tela de Relatórios
 * usa — e assim reaproveita o mesmo page.module.css, sem inventar uma segunda
 * folha de estilo para a mesma tela.
 *
 * Só apresenta: quem chama a IA é a página. Aqui não há fetch nem mock.
 */

const ABAS = [
  { id: "resumo", rotulo: "Resumo executivo" },
  { id: "achados", rotulo: "Principais achados" },
  { id: "recomendacoes", rotulo: "Recomendações" },
];

// Severidade nunca aparece só como cor: cada tom carrega um ícone e o texto.
const ICONE_SEVERIDADE = { danger: "error", warning: "alert", info: "info" };

const formatarNumero = new Intl.NumberFormat("pt-BR");

export default function AnaliseIa({
  nomeRelatorio,
  analise,
  gerando,
  erro,
  desatualizada,
  onGerar,
  onIrParaFiltros,
}) {
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const abasRef = useRef([]);

  /* Teclado do padrão de abas (WAI-ARIA): setas andam, Home/End vão às pontas.
     Sem isso o usuário de teclado teria de tabular por todas as abas. */
  function navegarAbas(evento, indice) {
    const teclas = {
      ArrowRight: (indice + 1) % ABAS.length,
      ArrowLeft: (indice - 1 + ABAS.length) % ABAS.length,
      Home: 0,
      End: ABAS.length - 1,
    };

    const destino = teclas[evento.key];
    if (destino === undefined) return;

    evento.preventDefault();
    setAbaAtiva(ABAS[destino].id);
    abasRef.current[destino]?.focus();
  }

  if (gerando) {
    return (
      <div className={styles.iaCarregando} role="status">
        <span className="sr-only">Gerando análise. Isso leva alguns segundos.</span>
        <p className={styles.iaCarregandoTexto} aria-hidden="true">
          <Icon className="spinning" name="spinner" size={16} />
          Analisando o recorte selecionado...
        </p>
        {/* Esqueleto no formato do conteúdo que vem: a tela não salta quando o
            texto chega. */}
        <div className={styles.iaSkeleton} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className={styles.vazio}>
        <p className="alert danger">
          <Icon name="error" size={16} />
          <span className="alert-body">{erro}</span>
        </p>
        <div className="btn-row">
          <button className={`btn primary ${styles.btnCompacto}`} type="button" onClick={onGerar}>
            <Icon name="refresh" size={15} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Convite inicial: nada é processado antes de o usuário pedir.
  if (!analise) {
    return (
      <div className={styles.vazio}>
        <span className="chip accent">ANÁLISE SOB DEMANDA</span>
        <h3>Gere a análise de {nomeRelatorio}</h3>
        <p>
          A IA lê as avaliações do recorte filtrado e devolve um resumo executivo, os
          principais achados e recomendações acionáveis. Aplique os filtros que definem o
          recorte e clique em Gerar análise.
        </p>

        <div className="btn-row">
          <button className={`btn primary ${styles.btnCompacto}`} type="button" onClick={onGerar}>
            <Icon name="sparkles" size={15} />
            Gerar análise
          </button>
          <button className={`btn ${styles.btnCompacto}`} type="button" onClick={onIrParaFiltros}>
            Ir para filtros
          </button>
        </div>

        <ul className={styles.beneficios}>
          <li className={styles.beneficio}>
            <strong>
              <Icon name="review" size={14} />
              Resumo executivo
            </strong>
            <span>O que mudou no período e por quê, em linguagem direta.</span>
          </li>
          <li className={styles.beneficio}>
            <strong>
              <Icon name="alert" size={14} />
              Principais achados
            </strong>
            <span>Cada ponto com a evidência que o sustenta e a severidade.</span>
          </li>
          <li className={styles.beneficio}>
            <strong>
              <Icon name="target" size={14} />
              Recomendações
            </strong>
            <span>Ações priorizadas, com o responsável sugerido por ação.</span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.iaPainel}>
      <div className={styles.iaTopo}>
        <div className={styles.iaContexto}>
          <h3>
            Análise da IA
            <span className="chip accent">
              <Icon name="sparkles" size={12} />
              IA
            </span>
          </h3>
          <p>
            Período analisado {analise.periodo} ·{" "}
            {formatarNumero.format(analise.avaliacoesConsideradas)} avaliações consideradas ·{" "}
            {analise.recorte === 1 ? "1 filtro aplicado" : `${analise.recorte} filtros aplicados`}
          </p>
        </div>

        {/* Confiança em três camadas: número, barra e palavra. Quem não
            enxerga a barra lê "87% — alta" do mesmo jeito. */}
        <div className={styles.confianca}>
          <span className={styles.confiancaRotulo}>
            Confiança <strong>{analise.confianca.valor}%</strong> — {analise.confianca.rotulo}
          </span>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Confiança da análise"
            aria-valuenow={analise.confianca.valor}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${analise.confianca.valor} por cento, confiança ${analise.confianca.rotulo}`}
          >
            <div className="progress-bar" style={{ "--w": `${analise.confianca.valor}%` }} />
          </div>
        </div>
      </div>

      {desatualizada ? (
        <p className={`alert warning ${styles.iaAlerta}`}>
          <Icon name="alert" size={16} />
          <span className="alert-body">
            Os filtros mudaram depois desta análise. Gere novamente para refletir o recorte
            atual.
          </span>
        </p>
      ) : null}

      <div className={styles.abas} role="tablist" aria-label="Seções da análise">
        {ABAS.map((aba, indice) => (
          <button
            className={styles.aba}
            key={aba.id}
            id={`aba-${aba.id}`}
            type="button"
            role="tab"
            ref={(elemento) => {
              abasRef.current[indice] = elemento;
            }}
            aria-selected={abaAtiva === aba.id}
            aria-controls={`painel-${aba.id}`}
            tabIndex={abaAtiva === aba.id ? 0 : -1}
            onClick={() => setAbaAtiva(aba.id)}
            onKeyDown={(evento) => navegarAbas(evento, indice)}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {/* tabIndex=0 no painel: sem ele, o conteúdo de um painel sem foco
          próprio fica inalcançável pelo teclado. */}
      <div
        className={styles.abaPainel}
        id={`painel-${abaAtiva}`}
        role="tabpanel"
        aria-labelledby={`aba-${abaAtiva}`}
        tabIndex={0}
      >
        {abaAtiva === "resumo" ? (
          <div className={styles.iaResumo}>
            {analise.resumo.map((paragrafo, indice) => (
              // Lista estática e sem reordenação: o índice é chave estável aqui.
              <p key={indice}>{paragrafo}</p>
            ))}
          </div>
        ) : null}

        {abaAtiva === "achados" ? (
          <ul className={styles.achados}>
            {analise.achados.map((achado) => (
              <li className={styles.achado} key={achado.id}>
                <div className={styles.achadoTopo}>
                  <strong>{achado.titulo}</strong>
                  <span className={`chip ${achado.tom}`}>
                    <Icon name={ICONE_SEVERIDADE[achado.tom]} size={12} />
                    {achado.severidade}
                  </span>
                </div>
                {/* A evidência vem pronta em texto da API, que a monta a partir
                    do SQL. `avaliacoes` só existe quando a contagem vem
                    separada — hoje não vem, e inventar um número aqui seria
                    exatamente o que o produto não pode fazer. */}
                <p className={styles.achadoEvidencia}>
                  {achado.avaliacoes != null
                    ? `${formatarNumero.format(achado.avaliacoes)} avaliações · ${achado.percentual}`
                    : achado.percentual}
                </p>
                <p className={styles.achadoDetalhe}>{achado.detalhe}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {abaAtiva === "recomendacoes" ? (
          <ol className={styles.recomendacoes}>
            {analise.recomendacoes.map((recomendacao, indice) => (
              <li className={styles.recomendacao} key={recomendacao.id}>
                <span className="step-num" aria-hidden="true">
                  {indice + 1}
                </span>
                <div>
                  <p className={styles.recomendacaoAcao}>{recomendacao.acao}</p>
                  <p className={styles.recomendacaoMeta}>
                    Responsável sugerido: <strong>{recomendacao.responsavel}</strong> · Impacto:{" "}
                    <strong>{recomendacao.impacto}</strong>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className={styles.iaRodape}>
        <p>
          <Icon name="info" size={14} />
          Análise gerada por IA a partir dos dados filtrados. Revise antes de decidir.
        </p>
        <p className="subtle-text">Gerada em {analise.geradoEm}</p>
      </div>
    </div>
  );
}
