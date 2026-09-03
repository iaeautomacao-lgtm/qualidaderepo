"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import SelectBusca from "@/components/SelectBusca";
import { Icon } from "@/components/icons";
import { buscarApi, enviarApi } from "@/lib/api";
import styles from "../page.module.css";

function opcaoVazia(texto) {
  return { value: "", label: texto };
}

function pessoaLabel(item) {
  return [item.nome, item.email, item.login ? `Login ${item.login}` : null].filter(Boolean).join(" - ");
}

function formularioLabel(item) {
  return [item.nome, item.descricao].filter(Boolean).join(" - ");
}

function competenciaAtual() {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
}

export default function IniciarAvaliacaoPage() {
  const router = useRouter();
  const [opcoes, setOpcoes] = useState({
    clientes: [],
    campanhas: [],
    superiores: [],
    avaliados: [],
    formularios: [],
    motivos: [],
  });
  const [selecionado, setSelecionado] = useState({
    clienteId: "",
    campanhaId: "",
    superiorId: "",
    avaliadoId: "",
    formularioId: "",
  });
  const [modalAusencia, setModalAusencia] = useState(false);
  const [motivoId, setMotivoId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvandoAusencia, setSalvandoAusencia] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarApi("/api/formularios/iniciar/opcoes")
      .then((dados) => {
        if (!ativo) return;
        setOpcoes(dados);
        setErro("");
      })
      .catch((error) => {
        if (ativo) setErro(error.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const campanhas = useMemo(
    () => opcoes.campanhas.filter((item) => !selecionado.clienteId || item.clienteId === selecionado.clienteId),
    [opcoes.campanhas, selecionado.clienteId],
  );
  const superiores = useMemo(
    () => opcoes.superiores.filter((item) => item.campanhaId === selecionado.campanhaId),
    [opcoes.superiores, selecionado.campanhaId],
  );
  const avaliados = useMemo(
    () =>
      opcoes.avaliados.filter(
        (item) =>
          item.clienteId === selecionado.clienteId &&
          item.campanhaId === selecionado.campanhaId &&
          (!selecionado.superiorId || item.superiorId === selecionado.superiorId),
      ),
    [opcoes.avaliados, selecionado.campanhaId, selecionado.clienteId, selecionado.superiorId],
  );
  const formularios = useMemo(
    () =>
      opcoes.formularios.filter(
        (item) => item.clienteId === selecionado.clienteId && item.campanhaId === selecionado.campanhaId,
      ),
    [opcoes.formularios, selecionado.campanhaId, selecionado.clienteId],
  );

  function selecionar(campo, valor) {
    setAviso("");
    setErro("");
    setSelecionado((atual) => {
      const proximo = { ...atual, [campo]: valor };
      if (campo === "clienteId") {
        proximo.campanhaId = "";
        proximo.superiorId = "";
        proximo.avaliadoId = "";
        proximo.formularioId = "";
      }
      if (campo === "campanhaId") {
        proximo.superiorId = "";
        proximo.avaliadoId = "";
        proximo.formularioId = "";
      }
      if (campo === "superiorId") proximo.avaliadoId = "";
      return proximo;
    });
  }

  function limpar() {
    setSelecionado({ clienteId: "", campanhaId: "", superiorId: "", avaliadoId: "", formularioId: "" });
    setMotivoId("");
    setObservacoes("");
    setErro("");
    setAviso("");
  }

  function iniciar() {
    const params = new URLSearchParams({
      formularioId: selecionado.formularioId,
      campanhaId: selecionado.campanhaId,
      avaliadoId: selecionado.avaliadoId,
      superiorId: selecionado.superiorId,
    });
    router.push(`/formularios/iniciar/manual?${params.toString()}`);
  }

  async function registrarAusencia(evento) {
    evento.preventDefault();
    setErro("");
    setAviso("");
    setSalvandoAusencia(true);
    try {
      await enviarApi("/api/formularios/iniciar/ausencia", {
        clienteId: selecionado.clienteId,
        campanhaId: selecionado.campanhaId,
        avaliadoId: selecionado.avaliadoId,
        motivoId,
        texto: observacoes,
      });
      setModalAusencia(false);
      setMotivoId("");
      setObservacoes("");
      setAviso("Justificativa de ausencia registrada.");
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvandoAusencia(false);
    }
  }

  const cliente = opcoes.clientes.find((item) => item.id === selecionado.clienteId);
  const campanha = opcoes.campanhas.find((item) => item.id === selecionado.campanhaId);
  const avaliado = opcoes.avaliados.find((item) => item.id === selecionado.avaliadoId);
  const motivoSelecionado = opcoes.motivos.find((item) => item.id === motivoId);
  const podeJustificar = Boolean(selecionado.clienteId && selecionado.campanhaId && selecionado.superiorId && selecionado.avaliadoId);
  const podeIniciar = Boolean(podeJustificar && selecionado.formularioId);
  const ausenciaValida = Boolean(motivoId && (!motivoSelecionado?.exigeTexto || observacoes.trim()));

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Iniciar avaliação">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Iniciar Avaliação</h1>
            <p>Inicie uma nova avaliação de monitoria.</p>
          </div>
        </div>
      </section>

      <section className={`card pad ${styles.hierarquiaPanel}`}>
        <div className="section-head">
          <div className={styles.tituloComIcone}>
            <span className={styles.formIcone}>
              <Icon name="target" size={18} />
            </span>
            <h2>Localizar por hierarquia</h2>
          </div>
        </div>

        <div className={styles.hierarquiaCampos}>
          <SelectBusca
            id="inicio-operacao"
            label="Operações"
            value={selecionado.clienteId}
            options={[
              opcaoVazia(carregando ? "Carregando..." : "Selecione uma operação"),
              ...opcoes.clientes.map((item) => ({ value: item.id, label: item.nome })),
            ]}
            onChange={(valor) => selecionar("clienteId", valor)}
          />

          <SelectBusca
            id="inicio-campanha"
            label="Campanhas"
            value={selecionado.campanhaId}
            options={[
              opcaoVazia(selecionado.clienteId ? "Selecione uma campanha" : "Selecione uma operação primeiro"),
              ...campanhas.map((item) => ({ value: item.id, label: item.nome })),
            ]}
            onChange={(valor) => selecionar("campanhaId", valor)}
          />

          <SelectBusca
            id="inicio-superior"
            label="Superior"
            value={selecionado.superiorId}
            options={[
              opcaoVazia(selecionado.campanhaId ? "Selecione um superior" : "Selecione uma campanha primeiro"),
              ...superiores.map((item) => ({ value: item.id, label: pessoaLabel(item) })),
            ]}
            onChange={(valor) => selecionar("superiorId", valor)}
          />

          <SelectBusca
            id="inicio-avaliado"
            label="Avaliado"
            value={selecionado.avaliadoId}
            options={[
              opcaoVazia(selecionado.superiorId ? "Selecione um operador" : "Selecione um superior primeiro"),
              ...avaliados.map((item) => ({ value: item.id, label: pessoaLabel(item) })),
            ]}
            onChange={(valor) => selecionar("avaliadoId", valor)}
          />

          <SelectBusca
            id="inicio-formulario"
            label="Formulário"
            value={selecionado.formularioId}
            options={[
              opcaoVazia(selecionado.campanhaId ? "Selecione um formulário" : "Selecione uma campanha primeiro"),
              ...formularios.map((item) => ({ value: item.id, label: formularioLabel(item) })),
            ]}
            onChange={(valor) => selecionar("formularioId", valor)}
          />
        </div>

        <div className="btn-row">
          <button className="btn danger" type="button" onClick={limpar}>
            <Icon name="close" size={16} />
            Limpar
          </button>
          <button className="btn" type="button" disabled={!podeJustificar || opcoes.motivos.length === 0} onClick={() => setModalAusencia(true)}>
            <Icon name="shield" size={16} />
            Justificar Ausência
          </button>
          <button className="btn primary" type="button" disabled={!podeIniciar} onClick={iniciar}>
            <Icon name="check" size={16} />
            Iniciar Avaliação
          </button>
        </div>

        {opcoes.motivos.length === 0 && !carregando ? (
          <p className="alert warning">
            <Icon name="alert" size={18} />
            <span>Nenhum motivo de ausência cadastrado.</span>
          </p>
        ) : null}
        {aviso ? (
          <p className="alert success">
            <Icon name="checkCircle" size={18} />
            <span>{aviso}</span>
          </p>
        ) : null}
        {erro ? (
          <p className="alert danger">
            <Icon name="error" size={18} />
            <span>{erro}</span>
          </p>
        ) : null}
      </section>

      {modalAusencia ? (
        <div className={styles.modalFundo}>
          <form className={`card pad ${styles.modalAusencia}`} onSubmit={registrarAusencia}>
            <header className={styles.modalTopo}>
              <div>
                <h2>Justificar Ausência</h2>
                <p>{competenciaAtual()}</p>
              </div>
              <button className="btn ghost icon-only" type="button" onClick={() => setModalAusencia(false)}>
                <Icon name="close" size={16} label="Fechar" />
              </button>
            </header>

            <div className="field">
              <label>Operador</label>
              <input className="input" readOnly value={avaliado ? pessoaLabel(avaliado) : ""} />
            </div>
            <div className="field">
              <label>Campanha</label>
              <input className="input" readOnly value={[cliente?.nome, campanha?.nome].filter(Boolean).join(" - ")} />
            </div>
            <div className="field">
              <label>Período</label>
              <input className="input" readOnly value={competenciaAtual()} />
            </div>
            <div className="field">
              <label htmlFor="motivo-ausencia">Motivo *</label>
              <select className="select" id="motivo-ausencia" value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
                <option value="">Selecione</option>
                {opcoes.motivos.map((motivo) => (
                  <option key={motivo.id} value={motivo.id}>
                    {motivo.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="obs-ausencia">Observações</label>
              <textarea
                className="input"
                id="obs-ausencia"
                rows={4}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="btn-row">
              <button className="btn ghost" type="button" onClick={() => setModalAusencia(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={!ausenciaValida || salvandoAusencia}>
                <Icon className={salvandoAusencia ? "spinning" : undefined} name={salvandoAusencia ? "spinner" : "check"} size={16} />
                {salvandoAusencia ? "Registrando..." : "Registrar Justificativa"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
