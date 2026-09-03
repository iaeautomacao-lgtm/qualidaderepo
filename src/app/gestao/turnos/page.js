"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EsqueletoTabela from "@/components/EsqueletoTabela";
import { Icon } from "@/components/icons";
import useDebounce from "@/hooks/useDebounce";
import useRecurso from "@/hooks/useRecurso";
import { comFiltros, enviarApi } from "@/lib/api";
import { formatarNumero } from "@/lib/formato";
import styles from "./page.module.css";

const VAZIO = { codigo: "", descricao: "", horaInicio: "09:00", horaFim: "17:12", ativo: true };

export default function TurnosPage() {
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [erroAcao, setErroAcao] = useState("");
  const buscaAtrasada = useDebounce(busca);
  const url = comFiltros("/api/turnos", { busca: buscaAtrasada });
  const { dados, carregando, erro, definir, recarregar } = useRecurso(url);

  const itens = dados?.itens ?? [];
  const contadores = dados?.contadores ?? { total: 0, ativos: 0, inativos: 0 };

  async function salvar(form) {
    setErroAcao("");
    try {
      const resposta = form.id
        ? await enviarApi(`/api/turnos/${encodeURIComponent(form.id)}`, form, { metodo: "PATCH" })
        : await enviarApi("/api/turnos", form);
      definir(resposta);
      setModal(null);
    } catch (causa) {
      setErroAcao(causa.message);
    }
  }

  async function remover(item) {
    setErroAcao("");
    try {
      definir(await enviarApi(`/api/turnos/${encodeURIComponent(item.id)}`, {}, { metodo: "DELETE" }));
    } catch (causa) {
      setErroAcao(causa.message);
    }
  }

  return (
    <AppShell active="Gestão" breadcrumb="Administração > Turnos">
      <section className="page-header">
        <div className={styles.titulo}>
          <Link className="btn" href="/gestao">
            <Icon name="chevronLeft" size={16} />
            Administração
          </Link>
          <span className="icon-badge">
            <Icon name="clock" size={20} />
          </span>
          <div>
            <h1>Turnos</h1>
            <p>Cadastro de turnos de trabalho para operadores e supervisores</p>
          </div>
        </div>
        <button className="btn primary" type="button" onClick={() => setModal(VAZIO)}>
          <Icon name="plus" size={16} />
          Novo Turno
        </button>
      </section>

      {erroAcao ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível concluir</strong>
            <span>{erroAcao}</span>
          </span>
        </p>
      ) : null}

      <section className="card pad">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            className="input"
            type="search"
            placeholder="Buscar turnos..."
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </section>

      <section className="card pad">
        <div className="section-head">
          <div>
            <h2>Turnos Cadastrados ({formatarNumero(contadores.total)})</h2>
            <p>
              {formatarNumero(contadores.ativos)} ativo(s) · {formatarNumero(contadores.inativos)} inativo(s)
            </p>
          </div>
          <button className="btn" type="button" disabled={carregando} onClick={recarregar}>
            <Icon name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
        </div>

        {erro ? (
          <div className="empty-state">
            <span className="icon-badge danger">
              <Icon name="error" size={22} />
            </span>
            <h3>Não foi possível carregar turnos</h3>
            <p>{erro}</p>
          </div>
        ) : carregando && !dados ? (
          <EsqueletoTabela colunas={5} linhas={4} />
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <span className="icon-badge">
              <Icon name="clock" size={22} />
            </span>
            <h3>Nenhum turno cadastrado</h3>
            <p>Cadastre os turnos para vincular operadores importados da planilha.</p>
          </div>
        ) : (
          <div className="table-block">
            <table className={`data-table branded ${styles.tabela}`}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Hora Início</th>
                  <th>Hora Fim</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.codigo}</td>
                    <td>{item.descricao}</td>
                    <td>{item.horaInicio}</td>
                    <td>{item.horaFim}</td>
                    <td>
                      <span className={`chip ${item.ativo ? "success" : "danger"}`}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.acoes}>
                        <button className="btn ghost" type="button" onClick={() => setModal(item)}>
                          <Icon name="edit" size={15} />
                          Editar
                        </button>
                        <button className="btn ghost danger" type="button" onClick={() => remover(item)}>
                          <Icon name="trash" size={15} />
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal ? <TurnoModal inicial={modal} onClose={() => setModal(null)} onSalvar={salvar} /> : null}
    </AppShell>
  );
}

function TurnoModal({ inicial, onClose, onSalvar }) {
  const [form, setForm] = useState(inicial);
  const editando = Boolean(inicial.id);
  const podeSalvar = form.codigo.trim() && form.descricao.trim() && form.horaInicio && form.horaFim;
  const titulo = useMemo(() => (editando ? "Editar Turno" : "Novo Turno"), [editando]);

  const setCampo = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  return (
    <div className={styles.backdrop} role="presentation">
      <form
        className={`card pad ${styles.modal}`}
        onSubmit={(evento) => {
          evento.preventDefault();
          onSalvar(form);
        }}
      >
        <div className="section-head">
          <div>
            <h2>{titulo}</h2>
            <p>Defina o código e o intervalo usado no cadastro dos operadores.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className={styles.form}>
          <label className="field">
            <span>Código</span>
            <input className="input" value={form.codigo} onChange={(evento) => setCampo("codigo", evento.target.value)} />
          </label>
          <label className="field">
            <span>Descrição</span>
            <input className="input" value={form.descricao} onChange={(evento) => setCampo("descricao", evento.target.value)} />
          </label>
          <label className="field">
            <span>Hora Início</span>
            <input className="input" type="time" value={form.horaInicio} onChange={(evento) => setCampo("horaInicio", evento.target.value)} />
          </label>
          <label className="field">
            <span>Hora Fim</span>
            <input className="input" type="time" value={form.horaFim} onChange={(evento) => setCampo("horaFim", evento.target.value)} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={form.ativo} onChange={(evento) => setCampo("ativo", evento.target.checked)} />
            Ativo
          </label>
        </div>

        <div className="btn-row">
          <button className="btn" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit" disabled={!podeSalvar}>
            <Icon name="check" size={16} />
            Salvar Turno
          </button>
        </div>
      </form>
    </div>
  );
}
