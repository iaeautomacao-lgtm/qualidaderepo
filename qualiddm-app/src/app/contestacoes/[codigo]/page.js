"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import BotaoCopiar from "@/components/BotaoCopiar";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { enviarApi } from "@/lib/api";
import { faixaDaNota } from "@/lib/faixas";
import { SEM_VALOR } from "@/lib/formato";
import styles from "./page.module.css";

const APARENCIA_PEDIDO = {
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

export default function AbrirContestacaoPage({ params }) {
  const { codigo } = use(params);
  const id = decodeURIComponent(codigo);

  const itens = useRecurso(`/api/contestacoes/${encodeURIComponent(id)}/itens`);
  const pedidos = useRecurso(`/api/contestacoes/${encodeURIComponent(id)}`);

  // `null` = ninguém mexeu ainda, e nesse caso todas as seções ficam abertas
  // (é como o print mostra). Depois disso o mapa manda.
  const [secoesFechadas, setSecoesFechadas] = useState({});
  const [marcados, setMarcados] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const dados = itens.dados;
  const avaliacao = dados?.avaliacao ?? null;
  const secoes = dados?.secoes ?? [];
  const motivos = dados?.motivos ?? [];
  const minimo = dados?.minCaracteres ?? 20;

  const marcadosIds = useMemo(() => Object.keys(marcados), [marcados]);
  const faixa = avaliacao?.score == null ? null : faixaDaNota(avaliacao.score);

  // Um item marcado só está pronto com motivo escolhido e justificativa no
  // tamanho mínimo. O botão espelha a regra do servidor em vez de tentar enviar
  // e voltar com erro.
  const pendencias = marcadosIds.filter((chave) => {
    const item = marcados[chave];
    return !item.motivo || item.justificativa.trim().length < minimo;
  });
  const podeEnviar = marcadosIds.length > 0 && pendencias.length === 0 && !enviando;

  function alternarItem(respostaId) {
    setMarcados((atual) => {
      if (atual[respostaId]) {
        const proximo = { ...atual };
        delete proximo[respostaId];
        return proximo;
      }
      return { ...atual, [respostaId]: { motivo: "", justificativa: "" } };
    });
    setSucesso("");
  }

  function alterarItem(respostaId, campo, valor) {
    setMarcados((atual) => ({
      ...atual,
      [respostaId]: { ...atual[respostaId], [campo]: valor },
    }));
  }

  function alternarTodas(fechar) {
    const proximo = {};
    if (fechar) for (const secao of secoes) proximo[secao.id] = true;
    setSecoesFechadas(proximo);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setEnviando(true);

    try {
      const resposta = await enviarApi(`/api/contestacoes/${encodeURIComponent(id)}`, {
        itens: marcadosIds.map((respostaId) => ({
          respostaId,
          motivo: marcados[respostaId].motivo,
          justificativa: marcados[respostaId].justificativa.trim(),
        })),
      });

      // A rota devolve as contestações da ficha: o pedido novo aparece sem um
      // segundo GET, e a lista de itens é recarregada porque os contestados
      // saem da marcação disponível.
      pedidos.definir({
        avaliacao: resposta.avaliacao,
        contestacoes: resposta.contestacoes,
      });
      itens.recarregar();
      setMarcados({});
      setSucesso(
        `Contestação aberta com ${resposta.itens} item(ns). O ADM tem ${resposta.prazoDias} dia(s) para julgar.`,
      );
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppShell active="Contestações" breadcrumb="Qualidade > Contestações > Contestar monitoria">
      {itens.erro ? (
        <div className="empty-state">
          <span className="icon-badge danger">
            <Icon name="error" size={22} />
          </span>
          <h3>Não foi possível abrir a monitoria</h3>
          <p>{itens.erro}</p>
          <div className="btn-row">
            <button className="btn primary" type="button" onClick={itens.recarregar}>
              <Icon name="refresh" size={16} />
              Tentar novamente
            </button>
            <Link className="btn" href="/contestacoes/avaliacoes-candidatas">
              <Icon name="chevronLeft" size={16} />
              Voltar para as candidatas
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
              <span className="icon-tile" data-tom="orange">
                <Icon name="alert" size={20} />
              </span>
              <div>
                <h1>{ou(avaliacao.formulario)}</h1>
                <p className={styles.linhaId}>
                  Contestação por item
                  <span aria-hidden="true">·</span>
                  <span className="cell-id">
                    {avaliacao.id}
                    <BotaoCopiar valor={avaliacao.id} />
                  </span>
                </p>
              </div>
            </div>

            <div className={styles.cabecalhoAcoes}>
              <span className={`chip ${avaliacao.contestavel ? "info" : ""}`}>
                <Icon name="info" size={13} />
                {avaliacao.statusLabel}
              </span>
              <Link
                className="btn"
                href={`/avaliacoes/${encodeURIComponent(avaliacao.id)}?voltar=feedback`}
              >
                <Icon name="review" size={15} />
                Ver avaliação inteira
              </Link>
              <Link className="btn" href="/contestacoes/avaliacoes-candidatas">
                <Icon name="chevronLeft" size={15} />
                Fechar
              </Link>
            </div>
          </header>

          {/* --- identificação em cartões, como no print ------------------- */}
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
              <dt>Score</dt>
              <dd data-tom={faixa?.tom ?? ""} className={styles.numero}>
                {avaliacao.score == null ? SEM_VALOR : avaliacao.score.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Cód. gravação</dt>
              <dd className={styles.numero}>{ou(avaliacao.codGravacao)}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{ou(avaliacao.data)}</dd>
            </div>
          </dl>

          {sucesso ? (
            <p className="alert success">
              <Icon name="checkCircle" size={16} />
              <span className="alert-body">
                <strong>Contestação registrada</strong>
                <span>{sucesso}</span>
              </span>
            </p>
          ) : null}

          {/* --- pedidos já abertos --------------------------------------- */}
          {pedidos.dados?.contestacoes?.length ? (
            <section className="card pad" aria-labelledby="pedidos-abertos">
              <div className="section-head">
                <div>
                  <h2 id="pedidos-abertos">Contestações desta monitoria</h2>
                  <p>{pedidos.dados.contestacoes.length} pedido(s) registrado(s)</p>
                </div>
              </div>

              <ul className={styles.pedidos}>
                {pedidos.dados.contestacoes.map((pedido) => {
                  const aparencia = APARENCIA_PEDIDO[pedido.status] ?? { tom: "", icone: "info" };
                  const resultado = pedido.resultado
                    ? APARENCIA_RESULTADO[pedido.resultado]
                    : null;

                  return (
                    <li key={pedido.id}>
                      <div className={styles.pedidoTopo}>
                        <span className={`chip ${aparencia.tom}`}>
                          <Icon name={aparencia.icone} size={13} />
                          {pedido.statusLabel}
                        </span>
                        {resultado ? (
                          <span className={`chip ${resultado.tom}`}>{resultado.rotulo}</span>
                        ) : null}
                        <span className={styles.pedidoMeta}>
                          {pedido.itens.length} item(ns) · aberta por {pedido.abertaPor} em{" "}
                          {pedido.abertaEm}
                          {pedido.prazo ? ` · prazo ${pedido.prazo}` : ""}
                        </span>
                      </div>

                      <ul className={styles.pedidoItens}>
                        {pedido.itens.map((item) => (
                          <li key={item.id}>
                            <strong>{item.criterio}</strong>
                            <p>{item.argumento}</p>
                            {item.parecer ? (
                              <p className={styles.parecer}>
                                <Icon name="quote" size={13} />
                                {item.parecer}
                                {item.julgadaPor ? ` — ${item.julgadaPor}` : ""}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      {pedido.scoreFinal != null && pedido.scoreAnterior != null ? (
                        <p className={styles.notaMudou}>
                          Nota da monitoria: {pedido.scoreAnterior.toFixed(2)} →{" "}
                          <strong>{pedido.scoreFinal.toFixed(2)}</strong>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* --- itens contestáveis --------------------------------------- */}
          <form className="card pad" onSubmit={enviar}>
            <div className="section-head">
              <div>
                <h2>Itens não conformes para contestação</h2>
                <p>
                  {dados.total === 0
                    ? "Nenhum critério não conforme nesta monitoria."
                    : `${dados.total} item(ns) não conforme(s) · ${dados.disponiveis} disponível(is) para contestar`}
                </p>
              </div>

              {secoes.length > 1 ? (
                <div className="btn-row">
                  <button className="btn ghost" type="button" onClick={() => alternarTodas(false)}>
                    <Icon name="chevronDown" size={15} />
                    Expandir tudo
                  </button>
                  <button className="btn ghost" type="button" onClick={() => alternarTodas(true)}>
                    <Icon name="chevronUp" size={15} />
                    Recolher tudo
                  </button>
                </div>
              ) : null}
            </div>

            {!avaliacao.contestavel ? (
              <p className="alert warning">
                <Icon name="alert" size={16} />
                <span className="alert-body">
                  <strong>Esta monitoria não aceita mais contestação</strong>
                  <span>
                    O feedback está como “{avaliacao.statusLabel}”. Contestação só é aberta enquanto
                    o ciclo de feedback está em andamento — peça a reabertura ao administrador.
                  </span>
                </span>
              </p>
            ) : null}

            {dados.total === 0 ? (
              <div className="empty-state">
                <span className="icon-badge success">
                  <Icon name="checkCircle" size={22} />
                </span>
                <h3>Nada a contestar</h3>
                <p>
                  Todos os critérios desta monitoria foram avaliados como conformes ou não
                  aplicáveis.
                </p>
              </div>
            ) : (
              <div className={styles.secoes}>
                {secoes.map((secao) => {
                  const fechada = Boolean(secoesFechadas[secao.id]);

                  return (
                    <section className={styles.secao} key={secao.id}>
                      <div className={styles.secaoTopo}>
                        <h3>
                          {secao.nome}
                          <span className="count-badge">{secao.itens.length}</span>
                        </h3>
                        <button
                          className="btn ghost"
                          type="button"
                          aria-expanded={!fechada}
                          aria-controls={`itens-${secao.id}`}
                          onClick={() =>
                            setSecoesFechadas((atual) => ({ ...atual, [secao.id]: !fechada }))
                          }
                        >
                          <Icon name={fechada ? "chevronDown" : "chevronUp"} size={15} />
                          {fechada ? "Expandir" : "Recolher"}
                        </button>
                      </div>

                      <ul className={styles.itens} id={`itens-${secao.id}`} hidden={fechada}>
                        {secao.itens.map((item) => {
                          const marcado = Boolean(marcados[item.respostaId]);
                          const bloqueado = Boolean(item.contestadoStatus);
                          const valor = marcados[item.respostaId] ?? {
                            motivo: "",
                            justificativa: "",
                          };
                          const curta = valor.justificativa.trim().length < minimo;

                          return (
                            <li className={styles.item} key={item.respostaId} data-marcado={marcado}>
                              <div className={styles.itemTopo}>
                                <div className={styles.itemIdent}>
                                  <strong>{item.criterio}</strong>
                                  <div className={styles.itemChips}>
                                    <span className="chip danger">
                                      <Icon name="error" size={12} />
                                      Não conforme
                                    </span>
                                    {item.eliminatoria ? (
                                      <span className="chip danger">Eliminatório</span>
                                    ) : (
                                      <span className="chip">
                                        Peso: {item.peso == null ? SEM_VALOR : item.peso}
                                      </span>
                                    )}
                                    <span className="chip">
                                      Pontuação: {item.pontuacaoObtida}/
                                      {item.pontuacaoTotal == null
                                        ? SEM_VALOR
                                        : item.pontuacaoTotal}
                                    </span>
                                  </div>
                                </div>

                                {bloqueado ? (
                                  <span className="chip info">
                                    <Icon name="review" size={12} />
                                    Já contestado ({item.contestadoLabel})
                                  </span>
                                ) : (
                                  <label className={styles.marcar}>
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      disabled={!avaliacao.contestavel}
                                      onChange={() => alternarItem(item.respostaId)}
                                    />
                                    Contestar
                                  </label>
                                )}
                              </div>

                              {item.enunciado ? (
                                <p className={styles.enunciado}>{item.enunciado}</p>
                              ) : null}

                              {item.observacao ? (
                                <p className={styles.observacao}>
                                  <Icon name="quote" size={14} />
                                  <span>
                                    <strong>Observação do monitor:</strong> {item.observacao}
                                  </span>
                                </p>
                              ) : null}

                              {marcado ? (
                                <div className={styles.itemForm}>
                                  <div className="field">
                                    <label htmlFor={`motivo-${item.respostaId}`}>
                                      Motivo da contestação
                                    </label>
                                    <select
                                      className="select"
                                      id={`motivo-${item.respostaId}`}
                                      value={valor.motivo}
                                      onChange={(evento) =>
                                        alterarItem(item.respostaId, "motivo", evento.target.value)
                                      }
                                    >
                                      <option value="">Selecione o motivo</option>
                                      {motivos.map((motivo) => (
                                        <option key={motivo} value={motivo}>
                                          {motivo}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="field">
                                    <label htmlFor={`justificativa-${item.respostaId}`}>
                                      Justificativa
                                    </label>
                                    <textarea
                                      className={`input ${styles.area}`}
                                      id={`justificativa-${item.respostaId}`}
                                      rows={3}
                                      placeholder="Explique o porquê da contestação para este item"
                                      value={valor.justificativa}
                                      onChange={(evento) =>
                                        alterarItem(
                                          item.respostaId,
                                          "justificativa",
                                          evento.target.value,
                                        )
                                      }
                                      aria-describedby={`contador-${item.respostaId}`}
                                    />
                                    <span
                                      className="field-hint"
                                      id={`contador-${item.respostaId}`}
                                      data-curta={curta ? "true" : "false"}
                                    >
                                      {valor.justificativa.trim().length} / {minimo} caracteres
                                      mínimos
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}

            {erro ? (
              <p className="alert danger">
                <Icon name="alert" size={16} />
                <span className="alert-body">
                  <strong>Não foi possível abrir a contestação</strong>
                  <span>{erro}</span>
                </span>
              </p>
            ) : null}

            {dados.total > 0 ? (
              <div className={styles.rodape}>
                <p className={styles.rodapeResumo}>
                  {marcadosIds.length === 0
                    ? "Marque os itens que você quer contestar."
                    : pendencias.length > 0
                      ? `${marcadosIds.length} item(ns) marcado(s) · ${pendencias.length} sem motivo ou justificativa completa.`
                      : `${marcadosIds.length} item(ns) prontos para envio.`}
                </p>
                <div className="btn-row">
                  <Link className="btn" href="/contestacoes/avaliacoes-candidatas">
                    Fechar
                  </Link>
                  <button className="btn primary" type="submit" disabled={!podeEnviar}>
                    <Icon name={enviando ? "spinner" : "send"} size={16} />
                    {enviando ? "Enviando..." : "Enviar contestação"}
                  </button>
                </div>
              </div>
            ) : null}
          </form>
        </>
      )}
    </AppShell>
  );
}
