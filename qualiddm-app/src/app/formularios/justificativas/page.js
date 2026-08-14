"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "../page.module.css";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function JustificativasPage() {
  const [registros, setRegistros] = useState([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/formularios/justificativas", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar justificativas.");
        if (ativo) setRegistros(payload.data.justificativas);
      })
      .catch((error) => {
        if (ativo) setErro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return registros;
    return registros.filter((item) =>
      [item.avaliacao, item.avaliado, item.avaliador, item.formulario, item.criterio, item.justificativa]
        .some((campo) => normalizar(campo).includes(termo)),
    );
  }, [registros, busca]);

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Justificativas">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Visualizar Justificativas</h1>
            <p>Justificativas de avaliação lançadas.</p>
          </div>
        </div>
      </section>

      <section className="card pad">
        <div className="section-head">
          <h2>Filtros</h2>
          <span className="chip neutral">{filtrados.length} registros</span>
        </div>
        <div className={`search-field ${styles.buscaLonga}`}>
          <Icon name="search" size={18} />
          <input
            className="input"
            placeholder="Operador, e-mail, critério ou comentário"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </section>

      <section className="card pad">
        {erro ? (
          <div className="empty-state">
            <Icon name="error" size={38} />
            <h3>Não foi possível carregar justificativas</h3>
            <p>{erro}</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <Icon name="review" size={38} />
            <h3>Nenhuma justificativa encontrada</h3>
            <p>Ajuste os filtros ou lance uma justificativa em uma avaliação.</p>
          </div>
        ) : (
          <ul className={styles.formList}>
            {filtrados.map((item) => (
              <li className={styles.justificativaItem} key={`${item.avaliacao}-${item.criterio}`}>
                <strong>{item.criterio}</strong>
                <span>
                  {item.avaliacao} · {item.avaliado} · {item.formulario}
                </span>
                <p>{item.justificativa}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
