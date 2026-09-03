"use client";

import Link from "next/link";
import { use, useState } from "react";
import AppShell from "@/components/AppShell";
import BotaoCopiar from "@/components/BotaoCopiar";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import { SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const MINIMO_PARECER = 20;

const APARENCIA_STATUS = {
  pendente: { tom: "warning", icone: "clock" },
  em_analise: { tom: "info", icone: "review" },
  julgada: { tom: "success", icone: "checkCircle" },
  cancelada: { tom: "", icone: "close" },
};

const APARENCIA_RESULTADO = {
  deferida: { tom: "success", rotulo: "Procedente" },
  parcial: { tom: "warning", rotulo: "Parcialmente procedente" },
  indeferida: { tom: "danger", rotulo: "Improcedente" },
};

function ou(valor) {
  if (valor === null || valor === undefined) return SEM_VALOR;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : SEM_VALOR;
}

export default function JulgarContestacaoPage({ params }) {
  const { codigo } = use(params);
  const id = decodeURIComponent(codigo);

  const { dados, carregando, erro, recarregar, definir } = useRecurso(
    `/api/contestacoes/${encodeURIComponent(id)}`,
  );

  const avaliacao = dados?.avaliacao ?? null;
  const pedidos = dados?.contestacoes ?? [];
  const faixa = avaliacao?.score == null ? null : faixaDaNota(avaliacao.score);

  return (
    <AppShell active="Contestações" breadcrumb="Qualidade > Contestações > Gestão ADM > Julgar">
      {erro ? (
        <div className="empty-state">
          <span className="icon-badge danger">
            <Icon name="error" size={22} />
          </span>
          <h3>Não foi possível abrir a contestação</h3>
          <p>{erro}</p>
          <div className="btn-row">
            <button className="btn primary" type="button" onClick={recarregar}>
              <Icon name="refresh" size={16} />
              Tentar novamente
            </button>
            <Link className="btn" href="/contestacoes/gestao-adm">
              <Icon name="chevronLeft" size={16} />
              Voltar para a fila
            </Link>
          </div>
        </div>
      ) : !avaliacao ? (
        <div className={styles.esqueleto} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : (
        <>
          <header className={`card ${styles.cabecalho}`}>
            <div className={styles.identidade}>
              <span className="icon-tile" data-tom="purple">
                <Icon name="shield" size={20} />
              </span>
              <div>
                <h1>{ou(avaliacao.formulario)}</h1>
                <p className={styles.linhaId}>
                  Julgamento da contestação
                  <span aria-hidden="true">·</span>
                  <span className="cell-id">
                    {avaliacao.id}
                    <BotaoCopiar valor={avaliacao.id} />
                  </span>
                </p>
              </div>
            </div>

            <div className={styles.cabecalhoAcoes}>
              <Link
                className="btn"
                href={`/avaliacoes/${encodeURIComponent(avaliacao.id)}?voltar=feedback`}
              >
                <Icon name="review" size={15} />
                Ver avaliação inteira
              </Link>
              <Link className="btn" href="/contestacoes/gestao-adm">
                <Icon name="chevronLeft" size={15} />
                Voltar para a fila
              </Link>
            </div>
          </header>

          <dl className={styles.fichas}>
            <div>
              <dt>Avaliado</dt>
              <dd>{ou(avaliacao.avaliado)}</dd>
            </div>
            <div>
              <dt>Monitor</dt>
              <dd>{ou(avaliacao.avaliador)}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{ou(avaliacao.cliente)}</dd>
            </div>
            <div>
              <dt>Campanha</dt>
              <dd>{ou(avaliacao.campanha)}</dd>
            </div>
            <div>
              <dt>Nota atual</dt>
              <dd data-tom={faixa?.tom ?? ""} className={styles.numero}>
                {avaliacao.score == null ? SEM_VALOR : avaliacao.score.toFixed(2)}
              </dd>
            </div>
          </dl>

          {/* Aviso de consequência antes de qualquer decisão: deferir MEXE na
              nota da monitoria, e quem julga precisa saber disso de antemão. */}
          <p className="alert info">
            <Icon name="info" size={16} />
            <span className="alert-body">
              <strong>Deferir devolve o peso do critério e recalcula a nota</strong>
              <span>
                O item volta a “conforme” com o peso cadastrado no formulário, e a nota da monitoria
                é recalculada pela mesma regra do lançamento. Indeferir mantém tudo como está — em
                qualquer dos dois casos, o parecer fica registrado.
              </span>
            </span>
          </p>

          {pedidos.length === 0 ? (
            <div className="empty-state">
              <span className="icon-badge">
                <Icon name="alert" size={22} />
              </span>
              <h3>Esta monitoria não tem contestação</h3>
              <p>Nenhum pedido foi aberto para os critérios desta avaliação.</p>
              <div className="btn-row">
                <Link className="btn" href="/contestacoes/gestao-adm">
                  Voltar para a fila
                </Link>
              </div>
            </div>
          ) : (
            pedidos.map((pedido) => (
              <Pedido
                key={pedido.id}
                codigo={avaliacao.id}
                pedido={pedido}
                carregando={carregando}
                onJulgado={(resposta) =>
                  definir({ avaliacao: resposta.avaliacao, contestacoes: resposta.contestacoes })
                }
              />
            ))
          )}
        </>
      )}
    </AppShell>
  );
}

/* ==========================================================================
   Um pedido de contestação, com seus itens
   ========================================================================== */

function Pedido({ codigo, pedido, carregando, onJulgado }) {
  const [decisoes, setDecisoes] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const aparencia = APARENCIA_STATUS[pedido.status] ?? { tom: "", icone: "info" };
  const resultado = pedido.resultado ? APARENCIA_RESULTADO[pedido.resultado] : null;
  const fechado = pedido.status === "julgada" || pedido.status === "cancelada";

  const pendentes = pedido.itens.filter((item) => !item.resultado);
  const marcados = Object.keys(decisoes);
  const incompletos = marcados.filter((chave) => {
    const decisao = decisoes[chave];
    return !decisao.resultado || decisao.parecer.trim().length < MINIMO_PARECER;
  });
  const podeEnviar = marcados.length > 0 && incompletos.length === 0 && !enviando;

  function alterar(itemId, campo, valor) {
    setDecisoes((atual) => ({
      ...atual,
      [itemId]: { resultado: "", parecer: "", ...atual[itemId], [campo]: valor },
    }));
  }

  async function julgar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      const resposta = await enviarApi(`/api/contestacoes/${encodeURIComponent(codigo)}/julgar`, {
        contestacaoId: pedido.id,
        decisoes: marcados.map((itemId) => ({
          itemId,
          resultado: decisoes[itemId].resultado,
          parecer: decisoes[itemId].parecer.trim(),
        })),
      });

      onJulgado(resposta);
      setDecisoes({});
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card pad" onSubmit={julgar}>
      <div className={`section-head ${styles.pedidoHead}`}>
        <div>
          <h2>Contestação #{pedido.id}</h2>
          <p>
            Aberta por {pedido.abertaPor} em {pedido.abertaEm}
            {pedido.prazo ? ` · prazo de julgamento ${pedido.prazo}` : ""}
          </p>
        </div>

        <div className={styles.pedidoChips}>
          <span className={`chip ${aparencia.tom}`}>
            <Icon name={aparencia.icone} size={13} />
            {pedido.statusLabel}
          </span>
          {resultado ? <span className={`chip ${resultado.tom}`}>{resultado.rotulo}</span> : null}
        </div>
      </div>

      {pedido.scoreAnterior != null && pedido.scoreFinal != null ? (
        <p className={styles.notaMudou}>
          Nota antes do julgamento: <strong>{pedido.scoreAnterior.toFixed(2)}</strong> · depois:{" "}
          <strong>{pedido.scoreFinal.toFixed(2)}</strong>
        </p>
      ) : null}

      <ul className={styles.itens}>
        {pedido.itens.map((item) => {
          const julgado = Boolean(item.resultado);
          const decisao = decisoes[item.id] ?? { resultado: "", parecer: "" };
          const curto = decisao.parecer.trim().length < MINIMO_PARECER;

          return (
            <li className={styles.item} key={item.id} data-julgado={julgado}>
              <div className={styles.itemTopo}>
                <div className={styles.itemIdent}>
                  <span className={styles.secao}>{item.secao}</span>
                  <strong>{item.criterio}</strong>
                  <div className={styles.itemChips}>
                    <span className="chip danger">{item.statusOriginal}</span>
                    {item.eliminatoria ? (
                      <span className="chip danger">Eliminatório</span>
                    ) : (
                      <span className="chip">Peso: {item.peso == null ? SEM_VALOR : item.peso}</span>
                    )}
                    {item.motivo ? <span className="chip info">{item.motivo}</span> : null}
                  </div>
                </div>

                {julgado ? (
                  <span
                    className={`chip ${item.resultado === "deferido" ? "success" : "danger"}`}
                  >
                    <Icon
                      name={item.resultado === "deferido" ? "checkCircle" : "close"}
                      size={12}
                    />
                    {item.resultado === "deferido" ? "Deferido" : "Indeferido"}
                  </span>
                ) : null}
              </div>

              {item.enunciado ? <p className={styles.enunciado}>{item.enunciado}</p> : null}

              <p className={styles.argumento}>
                <Icon name="quote" size={14} />
                <span>
                  <strong>Argumento da supervisão:</strong> {item.argumento}
                </span>
              </p>

              {julgado ? (
                <p className={styles.parecerRegistrado}>
                  <strong>Parecer:</strong> {item.parecer || SEM_VALOR}
                  {item.julgadaPor ? ` — ${item.julgadaPor}` : ""}
                  {item.julgadaEm ? ` · ${item.julgadaEm}` : ""}
                </p>
              ) : fechado ? (
                <p className={styles.parecerRegistrado}>
                  Item sem decisão registrada neste pedido.
                </p>
              ) : (
                <div className={styles.decisao}>
                  <fieldset className="field">
                    <legend>Decisão</legend>
                    <div className={styles.opcoes}>
                      <label>
                        <input
                          type="radio"
                          name={`resultado-${item.id}`}
                          value="deferido"
                          checked={decisao.resultado === "deferido"}
                          onChange={() => alterar(item.id, "resultado", "deferido")}
                        />
                        Deferir (procedente)
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`resultado-${item.id}`}
                          value="indeferido"
                          checked={decisao.resultado === "indeferido"}
                          onChange={() => alterar(item.id, "resultado", "indeferido")}
                        />
                        Indeferir (improcedente)
                      </label>
                    </div>
                  </fieldset>

                  <div className="field">
                    <label htmlFor={`parecer-${item.id}`}>Parecer</label>
                    <textarea
                      className={`input ${styles.area}`}
                      id={`parecer-${item.id}`}
                      rows={3}
                      placeholder="Fundamente a decisão com a regra da campanha ou a evidência da gravação"
                      value={decisao.parecer}
                      onChange={(evento) => alterar(item.id, "parecer", evento.target.value)}
                      aria-describedby={`contador-parecer-${item.id}`}
                    />
                    <span
                      className="field-hint"
                      id={`contador-parecer-${item.id}`}
                      data-curto={curto && decisao.parecer.length > 0 ? "true" : "false"}
                    >
                      {decisao.parecer.trim().length} / {MINIMO_PARECER} caracteres mínimos
                    </span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível registrar o julgamento</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      {!fechado ? (
        <div className={styles.rodape}>
          <p className={styles.rodapeResumo}>
            {pendentes.length} item(ns) sem decisão.{" "}
            {marcados.length === 0
              ? "Escolha o resultado e escreva o parecer para julgar."
              : incompletos.length > 0
                ? `${incompletos.length} decisão(ões) sem resultado ou parecer completo.`
                : `${marcados.length} decisão(ões) pronta(s).`}
            {/* O pedido só fecha quando todos os itens têm decisão: julgar parte
                agora e o resto depois é permitido, e a fila mostra o que falta. */}
          </p>
          <button className="btn primary" type="submit" disabled={podeEnviar === false || carregando}>
            <Icon name={enviando ? "spinner" : "shield"} size={16} />
            {enviando ? "Registrando..." : "Registrar julgamento"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
