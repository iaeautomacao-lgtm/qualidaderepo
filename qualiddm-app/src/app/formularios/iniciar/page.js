"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "../page.module.css";

export default function IniciarAvaliacaoPage() {
  const [formularios, setFormularios] = useState([]);
  const [formularioId, setFormularioId] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/formularios", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar formulários.");
        if (ativo) setFormularios(payload.data.recentes);
      })
      .catch((error) => {
        if (ativo) setErro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Iniciar avaliação">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Iniciar avaliação</h1>
            <p>Escolha a ficha e envie o atendimento para análise.</p>
          </div>
        </div>
      </section>

      <section className={`card pad ${styles.formPanel}`}>
        <div className="field">
          <label htmlFor="formulario">Formulário</label>
          <select
            className="select"
            id="formulario"
            value={formularioId}
            onChange={(evento) => setFormularioId(evento.target.value)}
          >
            <option value="">Selecione</option>
            {formularios.map((formulario) => (
              <option key={formulario.id} value={formulario.id}>
                {formulario.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="btn-row">
          <Link className={`btn primary ${!formularioId ? "disabled" : ""}`} href="/upload">
            <Icon name="upload" size={16} />
            Enviar arquivo
          </Link>
        </div>

        {erro ? (
          <p className="alert danger">
            <Icon name="error" size={18} />
            <span>{erro}</span>
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
