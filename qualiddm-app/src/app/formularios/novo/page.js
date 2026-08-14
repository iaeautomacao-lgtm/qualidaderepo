"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "../page.module.css";

export default function NovoFormularioPage() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ nome: "", clienteId: "", categoria: "padrao", status: "rascunho" });
  const [status, setStatus] = useState("idle");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/clientes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (ativo && payload?.ok) setClientes(payload.data.clientes);
      })
      .catch(() => {
        if (ativo) setMensagem("Não foi possível carregar clientes.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setStatus("saving");
    setMensagem("");

    try {
      const resposta = await fetch("/api/formularios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await resposta.json().catch(() => null);
      if (!resposta.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível salvar o formulário.");
      }
      setStatus("done");
      setMensagem("Formulário cadastrado.");
      setForm({ nome: "", clienteId: "", categoria: "padrao", status: "rascunho" });
    } catch (error) {
      setStatus("error");
      setMensagem(error.message);
    }
  }

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Cadastro">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Cadastro de Formulários</h1>
            <p>Crie a ficha base para uma operação.</p>
          </div>
        </div>
      </section>

      <form className={`card pad ${styles.formPanel}`} onSubmit={salvar}>
        <div className="field">
          <label htmlFor="nome">Nome do formulário</label>
          <input
            className="input"
            id="nome"
            value={form.nome}
            onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
            placeholder="Ex: Formulário Educacional | Cruzeiro"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cliente">Cliente</label>
          <select
            className="select"
            id="cliente"
            value={form.clienteId}
            onChange={(evento) => setForm((atual) => ({ ...atual, clienteId: evento.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="categoria">Categoria</label>
          <select
            className="select"
            id="categoria"
            value={form.categoria}
            onChange={(evento) => setForm((atual) => ({ ...atual, categoria: evento.target.value }))}
          >
            <option value="padrao">Padrão</option>
            <option value="diagnostico">Diagnóstico</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            className="select"
            id="status"
            value={form.status}
            onChange={(evento) => setForm((atual) => ({ ...atual, status: evento.target.value }))}
          >
            <option value="rascunho">Rascunho</option>
            <option value="desenvolvimento">Desenvolvimento</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="btn-row">
          <button className="btn primary" disabled={status === "saving"} type="submit">
            <Icon name={status === "saving" ? "spinner" : "check"} size={16} />
            {status === "saving" ? "Salvando..." : "Salvar formulário"}
          </button>
          <Link className="btn" href="/formularios">
            Cancelar
          </Link>
        </div>

        {mensagem ? (
          <p className={`alert ${status === "error" ? "danger" : "success"}`}>
            <Icon name={status === "error" ? "error" : "checkCircle"} size={18} />
            <span>{mensagem}</span>
          </p>
        ) : null}
      </form>
    </AppShell>
  );
}
