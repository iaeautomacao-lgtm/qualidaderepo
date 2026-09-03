"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { buscarApi, enviarApi } from "@/lib/api";
import styles from "../../page.module.css";

const STATUS = [
  { value: "conforme", label: "Conforme" },
  { value: "nao_conforme", label: "Nao conforme" },
  { value: "nao_aplicavel", label: "Nao aplicavel" },
];

function respostasIniciais(formulario) {
  const respostas = {};
  for (const secao of formulario?.secoes ?? []) {
    for (const criterio of secao.criterios ?? []) {
      respostas[criterio.id] = { status: "nao_aplicavel", observacao: "" };
    }
  }
  return respostas;
}

function calcularResumo(formulario, respostas) {
  let totalPeso = 0;
  let obtido = 0;
  let zerada = false;
  let respondidos = 0;

  for (const secao of formulario?.secoes ?? []) {
    for (const criterio of secao.criterios ?? []) {
      const status = respostas[criterio.id]?.status || "nao_aplicavel";
      if (status !== "nao_aplicavel") respondidos += 1;
      if (criterio.eliminatoria) {
        if (status === "nao_conforme") zerada = true;
        continue;
      }
      if (status === "nao_aplicavel") continue;
      const peso = Number(criterio.peso ?? 0);
      totalPeso += peso;
      if (status === "conforme") obtido += peso;
    }
  }

  return {
    respondidos,
    total: (formulario?.secoes ?? []).reduce((soma, secao) => soma + (secao.criterios?.length ?? 0), 0),
    nota: zerada ? 0 : totalPeso > 0 ? Number(((obtido / totalPeso) * 100).toFixed(2)) : null,
    zerada,
  };
}

function MonitoriaManualContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formularioId = searchParams.get("formularioId") || "";
  const campanhaInicialId = searchParams.get("campanhaId") || "";
  const avaliadoInicialId = searchParams.get("avaliadoId") || "";
  const superiorInicialId = searchParams.get("superiorId") || "";
  const [formulario, setFormulario] = useState(null);
  const [opcoes, setOpcoes] = useState({ avaliados: [] });
  const [campanhaId, setCampanhaId] = useState(campanhaInicialId);
  const [avaliadoId, setAvaliadoId] = useState(avaliadoInicialId);
  const [superiorId] = useState(superiorInicialId);
  const [codGravacao, setCodGravacao] = useState("");
  const [dataContato, setDataContato] = useState("");
  const [respostas, setRespostas] = useState({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        if (!formularioId) throw new Error("Selecione um formulario antes de iniciar a monitoria.");
        const [dadosFormulario, dadosOpcoes] = await Promise.all([
          buscarApi(`/api/formularios/${encodeURIComponent(formularioId)}`),
          buscarApi("/api/relatorios/opcoes"),
        ]);
        if (!ativo) return;
        setFormulario(dadosFormulario.formulario);
        setOpcoes({ avaliados: dadosOpcoes.avaliados ?? [] });
        setCampanhaId(campanhaInicialId || dadosFormulario.formulario.campanhas?.[0]?.id || "");
        setRespostas(respostasIniciais(dadosFormulario.formulario));
        setErro("");
      } catch (error) {
        if (ativo) setErro(error.message);
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [campanhaInicialId, formularioId]);

  const resumo = useMemo(() => calcularResumo(formulario, respostas), [formulario, respostas]);

  function alterarResposta(criterioId, campo, valor) {
    setRespostas((atual) => ({
      ...atual,
      [criterioId]: { ...(atual[criterioId] ?? {}), [campo]: valor },
    }));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErro("");
    setSalvando(true);

    try {
      if (!avaliadoId) throw new Error("Selecione o operador avaliado.");
      const payload = await enviarApi("/api/avaliacoes/manual", {
        formularioId,
        campanhaId,
        avaliadoId,
        superiorId,
        codGravacao,
        dataContato,
        respostas: Object.entries(respostas).map(([criterioId, resposta]) => ({
          criterioId,
          status: resposta.status,
          observacao: resposta.observacao,
        })),
      });
      router.push(`/avaliacoes/${encodeURIComponent(payload.avaliacao.id)}`);
    } catch (error) {
      setErro(error.message);
      setSalvando(false);
    }
  }

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Monitoria manual">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios/iniciar">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Monitoria manual</h1>
            <p>{formulario ? `${formulario.cliente} - ${formulario.nome}` : "Carregando ficha..."}</p>
          </div>
        </div>
      </section>

      {erro ? (
        <p className="alert danger">
          <Icon name="error" size={18} />
          <span>{erro}</span>
        </p>
      ) : null}

      {formulario ? (
        <form className={styles.aplicacaoManual} onSubmit={salvar}>
          <section className={`card pad ${styles.formPanel}`}>
            <div className="field">
              <label htmlFor="manual-campanha">Campanha</label>
              <select className="select" id="manual-campanha" value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)}>
                <option value="">Sem campanha especifica</option>
                {formulario.campanhas.map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="manual-operador">Operador avaliado *</label>
              <select className="select" id="manual-operador" value={avaliadoId} onChange={(e) => setAvaliadoId(e.target.value)}>
                <option value="">Selecione o operador</option>
                {opcoes.avaliados.map((avaliado) => (
                  <option key={avaliado.id} value={avaliado.id}>{avaliado.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="manual-codigo">Cod. gravacao</label>
              <input className="input" id="manual-codigo" maxLength={60} value={codGravacao} onChange={(e) => setCodGravacao(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="manual-data">Data do contato</label>
              <input className="input" id="manual-data" type="datetime-local" value={dataContato} onChange={(e) => setDataContato(e.target.value)} />
            </div>
          </section>

          <section className={`card pad ${styles.resumoManual}`} aria-label="Resumo da monitoria">
            <span className="chip neutral">{resumo.respondidos} de {resumo.total} respondidos</span>
            <strong>Nota prevista: {resumo.nota == null ? "N/A" : resumo.nota.toFixed(2)}</strong>
            {resumo.zerada ? <span className="chip danger">Eliminatoria reprovada</span> : null}
          </section>

          {formulario.secoes.map((secao) => (
            <section className={`card pad ${styles.secaoAplicacao}`} key={secao.id}>
              <div className="section-head">
                <div>
                  <h2>{secao.nome}</h2>
                  {secao.descricao ? <p>{secao.descricao}</p> : null}
                </div>
              </div>

              <div className={styles.criteriosAplicacao}>
                {secao.criterios.map((criterio) => (
                  <article className={styles.criterioAplicacao} key={criterio.id}>
                    <div>
                      <strong>{criterio.nome}</strong>
                      <p>{criterio.enunciado}</p>
                      <span className="metric-note">
                        {criterio.eliminatoria ? "Eliminatoria" : `Peso ${criterio.peso ?? 0}`}
                      </span>
                    </div>
                    <div className="field">
                      <label htmlFor={`status-${criterio.id}`}>Resposta</label>
                      <select
                        className="select"
                        id={`status-${criterio.id}`}
                        value={respostas[criterio.id]?.status ?? "nao_aplicavel"}
                        onChange={(e) => alterarResposta(criterio.id, "status", e.target.value)}
                      >
                        {STATUS.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`field ${styles.observacaoManual}`}>
                      <label htmlFor={`obs-${criterio.id}`}>Observacao</label>
                      <textarea
                        className="input"
                        id={`obs-${criterio.id}`}
                        rows={3}
                        value={respostas[criterio.id]?.observacao ?? ""}
                        onChange={(e) => alterarResposta(criterio.id, "observacao", e.target.value)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <div className="btn-row">
            <button className="btn primary" type="submit" disabled={salvando}>
              <Icon className={salvando ? "spinning" : undefined} name={salvando ? "spinner" : "check"} size={16} />
              {salvando ? "Salvando..." : "Salvar monitoria"}
            </button>
            <Link className="btn ghost" href="/formularios/iniciar">Cancelar</Link>
          </div>
        </form>
      ) : null}
    </AppShell>
  );
}

export default function MonitoriaManualPage() {
  return (
    <Suspense fallback={null}>
      <MonitoriaManualContent />
    </Suspense>
  );
}
