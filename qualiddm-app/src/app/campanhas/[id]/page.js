"use client";

import Link from "next/link";
import { use, useState } from "react";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import { formatarNumero, SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const ICONE_CANAL = { telefone: "mic", chat: "feedback" };

export default function GerenciarCampanhaPage({ params }) {
  const { id } = use(params);

  const { dados, carregando, erro, recarregar, definir } = useRecurso(
    `/api/campanhas/${encodeURIComponent(id)}`,
  );

  const campanha = dados?.campanha ?? null;
  const pessoas = dados?.pessoas ?? null;
  const conjuntos = dados?.conjuntosFaixa ?? [];
  const metaSuportada = dados?.metaSuportada !== false;

  return (
    <AppShell active="Campanhas" breadcrumb="Qualidade > Campanhas > Gerenciar">
      {erro ? (
        <div className="empty-state">
          <span className="icon-badge danger">
            <Icon name="error" size={22} />
          </span>
          <h3>Não foi possível abrir a campanha</h3>
          <p>{erro}</p>
          <div className="btn-row">
            <button className="btn primary" type="button" onClick={recarregar}>
              <Icon name="refresh" size={16} />
              Tentar novamente
            </button>
            <Link className="btn" href="/campanhas">
              <Icon name="chevronLeft" size={16} />
              Voltar para campanhas
            </Link>
          </div>
        </div>
      ) : !campanha ? (
        <div className={styles.esqueleto} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : (
        <>
          <section className="page-header">
            <div>
              <h1>Gerenciar — {campanha.nome}</h1>
              <p>
                {campanha.cliente} · {campanha.canalRotulo}
                {campanha.ativa ? "" : " · campanha inativa"}
              </p>
            </div>

            <div className="actions">
              <Link
                className="btn"
                href={
                  campanha.clienteId ? `/operacoes/${campanha.clienteId}` : "/campanhas"
                }
              >
                <Icon name="chevronLeft" size={16} />
                Voltar
              </Link>
            </div>
          </section>

          {/* --- identidade --------------------------------------------- */}
          <header className={`card ${styles.identidade}`}>
            <span className="icon-tile" data-tom={campanha.canal === "chat" ? "teal" : "accent"}>
              <Icon name={ICONE_CANAL[campanha.canal] ?? "target"} size={22} />
            </span>
            <div>
              <h2>{campanha.nome}</h2>
              <p>{campanha.cliente}</p>
            </div>
            <span className={`chip ${campanha.ativa ? "success" : ""}`}>
              <Icon name={campanha.ativa ? "checkCircle" : "close"} size={13} />
              {campanha.ativa ? "Ativa" : "Inativa"}
            </span>
          </header>

          {/* --- configurações gerais ----------------------------------- */}
          <section className="card pad" aria-labelledby="configuracoes-gerais">
            <div className="section-head">
              <div>
                <h2 id="configuracoes-gerais">Configurações gerais</h2>
                <p>Cadastro da campanha no período de {dados.periodoDias} dias</p>
              </div>
            </div>

            <dl className={styles.cadastro}>
              <div>
                <dt>Canal</dt>
                <dd>{campanha.canalRotulo}</dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{campanha.criadaEm}</dd>
              </div>
              <div>
                <dt>Monitorias</dt>
                <dd>{formatarNumero(campanha.monitorias)}</dd>
              </div>
              <div>
                <dt>Nota do período</dt>
                <dd data-tom={campanha.score == null ? "" : faixaDaNota(campanha.score).tom}>
                  {campanha.score == null ? SEM_VALOR : campanha.score}
                </dd>
              </div>
              <div>
                <dt>Não conformidades</dt>
                <dd data-tom={campanha.naoConformes > 0 ? "warning" : ""}>
                  {formatarNumero(campanha.naoConformes)}
                </dd>
              </div>
              <div>
                <dt>Críticas</dt>
                <dd data-tom={campanha.criticas > 0 ? "danger" : ""}>
                  {formatarNumero(campanha.criticas)}
                </dd>
              </div>
            </dl>

            {campanha.insight ? (
              <p className={styles.insight}>
                <Icon name="sparkles" size={16} />
                <span>{campanha.insight}</span>
              </p>
            ) : null}
          </section>

          {/* --- faixas e metas ----------------------------------------- */}
          <BlocoFaixasEMetas
            campanha={campanha}
            conjuntos={conjuntos}
            metaSuportada={metaSuportada}
            carregando={carregando}
            onSalvo={definir}
          />

          {/* --- pessoas ------------------------------------------------- */}
          <section aria-labelledby="pessoas-campanha">
            <h2 className="sr-only" id="pessoas-campanha">
              Pessoas avaliadas nesta campanha
            </h2>

            <ul className={styles.kpis}>
              <li className={`card ${styles.kpi}`}>
                <span className={styles.kpiTopo}>
                  <span className="icon-tile sm" data-tom="blue">
                    <Icon name="users" size={15} />
                  </span>
                  <span data-tom="blue">Total</span>
                </span>
                <strong>{formatarNumero(pessoas.total)}</strong>
                <span className={styles.kpiRotulo}>Pessoas avaliadas</span>
              </li>

              <li className={`card ${styles.kpi}`}>
                <span className={styles.kpiTopo}>
                  <span className="icon-tile sm" data-tom="green">
                    <Icon name="checkCircle" size={15} />
                  </span>
                  <span data-tom="green">Ativos</span>
                </span>
                <strong>{formatarNumero(pessoas.ativas)}</strong>
                <span className={styles.kpiRotulo}>Pessoas ativas</span>
              </li>

              <li className={`card ${styles.kpi}`}>
                <span className={styles.kpiTopo}>
                  <span className="icon-tile sm" data-tom="orange">
                    <Icon name="trendUp" size={15} />
                  </span>
                  <span data-tom="orange">Performance</span>
                </span>
                <strong>
                  {pessoas.eficiencia == null ? SEM_VALOR : `${pessoas.eficiencia}%`}
                </strong>
                <span className={styles.kpiRotulo}>
                  {pessoas.eficiencia == null
                    ? "Sem meta de nota cadastrada"
                    : `${formatarNumero(pessoas.naMeta)} de ${formatarNumero(pessoas.medidas)} na meta`}
                </span>
              </li>
            </ul>

            {/* Contagem por AVALIAÇÃO, não por lotação: dizer isso evita a
                leitura de que o card mostra o efetivo da carteira. */}
            <p className={styles.notaPessoas}>
              <Icon name="info" size={14} />
              <span>
                Conta quem foi avaliado nesta campanha nos últimos {dados.periodoDias} dias. Quem
                está lotado na carteira mas não teve monitoria no período não entra —
                {" "}
                {pessoas.eficiencia == null
                  ? "e a eficiência só aparece depois de cadastrar a meta de nota abaixo."
                  : "e a eficiência considera só quem tem nota no período."}
              </span>
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}

/* ==========================================================================
   Faixa de Performance e Metas
   ========================================================================== */

function BlocoFaixasEMetas({ campanha, conjuntos, metaSuportada, carregando, onSalvo }) {
  const [conjuntoId, setConjuntoId] = useState(campanha.faixaConjuntoId ?? "");
  const [meta, setMeta] = useState(campanha.metaScore == null ? "" : String(campanha.metaScore));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function salvar(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);

    try {
      const corpo = { configuracao: true, faixaConjuntoId: conjuntoId || null };
      // Só manda a meta quando o banco suporta: sem a 009 o servidor recusaria o
      // salvamento inteiro, inclusive a troca do conjunto de faixas.
      if (metaSuportada) corpo.metaScore = meta.trim() === "" ? null : meta.trim();

      onSalvo(await enviarApi(`/api/campanhas/${encodeURIComponent(campanha.id)}`, corpo, {
        metodo: "PATCH",
      }));
      setSucesso("Configurações salvas.");
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="card pad" onSubmit={salvar}>
      <div className="section-head">
        <div>
          <h2>Faixa de performance e metas</h2>
          <p>Régua com que esta campanha é lida em relatórios e painéis</p>
        </div>
      </div>

      {!metaSuportada ? (
        <p className="alert warning">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Meta de nota indisponível neste banco</strong>
            <span>
              Rode a migration <code>009_campanha_meta_score.sql</code> para habilitar o campo. O
              conjunto de faixas já pode ser salvo.
            </span>
          </span>
        </p>
      ) : null}

      <div className={styles.formGrade}>
        <div className="field">
          <label htmlFor="conjunto-faixas">Conjunto de faixas</label>
          <select
            className="select"
            id="conjunto-faixas"
            value={conjuntoId}
            onChange={(evento) => setConjuntoId(evento.target.value)}
          >
            <option value="">Usar o conjunto padrão</option>
            {conjuntos.map((conjunto) => (
              <option key={conjunto.id} value={conjunto.id}>
                {conjunto.nome}
                {conjunto.padrao ? " (padrão)" : ""}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Ao associar, os prazos de feedback, contestação e revisão passam a seguir as divisões
            desse conjunto.
          </span>
        </div>

        <div className="field">
          <label htmlFor="meta-nota">Meta de nota (0–100)</label>
          <input
            className="input"
            id="meta-nota"
            type="number"
            min="0"
            max="100"
            step="0.5"
            placeholder="Sem meta cadastrada"
            value={meta}
            disabled={!metaSuportada}
            onChange={(evento) => setMeta(evento.target.value)}
          />
          <span className="field-hint">
            Usada em relatórios e painéis para medir atingimento. Em branco significa sem meta — e a
            tela mostra “—” em vez de supor um número.
          </span>
        </div>
      </div>

      {erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível salvar</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {sucesso ? (
        <p className="alert success">
          <Icon name="checkCircle" size={16} />
          <span className="alert-body">
            <strong>Pronto</strong>
            <span>{sucesso}</span>
          </span>
        </p>
      ) : null}

      <div className={styles.formAcoes}>
        <button className="btn primary" type="submit" disabled={salvando || carregando}>
          <Icon name={salvando ? "spinner" : "check"} size={16} />
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
