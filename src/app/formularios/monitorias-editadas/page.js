"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "../page.module.css";

function formatarData(valor) {
  if (!valor) return "N/A";
  const [data, hora = ""] = String(valor).split(/[ T]/);
  const [ano, mes, dia] = data.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}, ${hora.slice(0, 5)}` : String(valor);
}

export default function MonitoriasEditadasPage() {
  const [registros, setRegistros] = useState([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/formularios/monitorias-editadas", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message || "Não foi possível carregar edições.");
        if (ativo) setRegistros(payload.data.monitorias);
      })
      .catch((error) => {
        if (ativo) setErro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Monitorias editadas">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Monitorias editadas</h1>
            <p>Trilha de edições de monitorias já submetidas.</p>
          </div>
        </div>
      </section>

      <section className="card pad">
        {erro ? (
          <div className="empty-state">
            <Icon name="error" size={38} />
            <h3>Não foi possível carregar edições</h3>
            <p>{erro}</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="empty-state">
            <Icon name="history" size={38} />
            <h3>Nenhuma monitoria editada</h3>
            <p>A tabela de auditoria não possui edições registradas para exibir.</p>
          </div>
        ) : (
          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>ID</th>
                  <th>Editado por</th>
                  <th>Quando</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((item) => (
                  <tr key={`${item.created_at}-${item.acao}-${item.entidade_id}`}>
                    <td>{item.acao}</td>
                    <td>{item.entidade}</td>
                    <td>{item.entidade_id}</td>
                    <td>{item.usuario || "Sistema"}</td>
                    <td>{formatarData(item.created_at)}</td>
                    <td>{item.detalhe || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
