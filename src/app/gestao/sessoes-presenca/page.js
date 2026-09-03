"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "./page.module.css";

const LIMITE = 100;

function dispositivoCurto(texto) {
  if (!texto) return "Não informado";
  if (texto.includes("Edg/")) return "Microsoft Edge";
  if (texto.includes("Chrome/")) return "Chrome";
  if (texto.includes("Firefox/")) return "Firefox";
  if (texto.includes("Safari/")) return "Safari";
  return texto;
}

export default function SessoesPresencaPage() {
  const [apenasAtivas, setApenasAtivas] = useState(true);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [revogando, setRevogando] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(
        `/api/administracao/sessoes?limit=${LIMITE}&apenasAtivas=${apenasAtivas ? "1" : "0"}`,
        { cache: "no-store" },
      );
      const payload = await resposta.json().catch(() => null);
      if (!resposta.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível carregar sessões.");
      }
      setDados(payload.data);
    } catch (error) {
      setDados(null);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => carregar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apenasAtivas]);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const total = dados?.paginacao?.total ?? itens.length;
  const administradores = useMemo(
    () => itens.filter((item) => item.papel === "administrador").length,
    [itens],
  );

  async function encerrar(sessao) {
    setRevogando(sessao.id);
    setErro("");
    try {
      const resposta = await fetch(`/api/administracao/sessoes/${encodeURIComponent(sessao.id)}`, {
        method: "DELETE",
      });
      const payload = await resposta.json().catch(() => null);
      if (!resposta.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível encerrar a sessão.");
      }
      setDados((atual) =>
        atual
          ? {
              ...atual,
              itens: atual.itens.filter((item) => item.id !== sessao.id),
              paginacao: {
                ...atual.paginacao,
                total: Math.max(0, Number(atual.paginacao?.total || 0) - 1),
              },
            }
          : atual,
      );
    } catch (error) {
      setErro(error.message);
    } finally {
      setRevogando(null);
    }
  }

  return (
    <AppShell active="Gestão" breadcrumb="Gestão > Sessões e Presença">
      <section className={styles.cabecalho}>
        <div className={styles.titulo}>
          <Link className="btn ghost icon-only" href="/gestao">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <span className="icon-badge success" aria-hidden="true">
            <Icon name="activity" size={20} />
          </span>
          <div>
            <h1>Sessões e Presença</h1>
            <p>Usuários conectados, origem da sessão e último sinal de atividade.</p>
          </div>
        </div>

        <div className={styles.acoes}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={apenasAtivas}
              onChange={(evento) => setApenasAtivas(evento.target.checked)}
            />
            Apenas ativas
          </label>
          <button className="btn" type="button" onClick={carregar} disabled={carregando}>
            <Icon className={carregando ? "spinning" : undefined} name={carregando ? "spinner" : "refresh"} size={16} />
            Atualizar
          </button>
        </div>
      </section>

      {erro ? (
        <p className="alert danger">
          <Icon name="error" size={18} />
          <span className="alert-body">
            <strong>Falha ao carregar sessões</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      <section className={styles.kpis} aria-label="Resumo das sessões">
        <article className={styles.kpi}>
          <span>Total no recorte</span>
          <strong>{carregando && !dados ? "..." : total}</strong>
        </article>
        <article className={styles.kpi}>
          <span>Administradores</span>
          <strong>{carregando && !dados ? "..." : administradores}</strong>
        </article>
        <article className={styles.kpi}>
          <span>Modo</span>
          <strong>{apenasAtivas ? "Ativas" : "Todas"}</strong>
        </article>
      </section>

      <section className="card" aria-labelledby="sessoes-titulo">
        <div className={`section-head ${styles.tabelaHead}`}>
          <div>
            <h2 id="sessoes-titulo">Sessões recentes</h2>
            <p>IP e dispositivo aparecem quando a sessão foi criada após esta melhoria.</p>
          </div>
        </div>

        {carregando && !dados ? (
          <div className="empty-state">
            <Icon name="spinner" className="spinning" size={30} />
            <h3>Carregando sessões</h3>
          </div>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <Icon name="activity" size={34} />
            <h3>Nenhuma sessão encontrada</h3>
            <p>Altere o filtro ou aguarde novos acessos.</p>
          </div>
        ) : (
          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Papel</th>
                  <th>IP</th>
                  <th>Dispositivo</th>
                  <th>Visto em</th>
                  <th>Expira em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nome}</strong>
                      <span>{item.email}</span>
                    </td>
                    <td>
                      <span className="chip">{item.cargo || item.papel}</span>
                    </td>
                    <td>{item.ip || "Não informado"}</td>
                    <td>{dispositivoCurto(item.dispositivo)}</td>
                    <td>{item.vistoEm}</td>
                    <td>{item.expiraEm}</td>
                    <td>
                      <button
                        className="btn ghost danger"
                        type="button"
                        disabled={revogando === item.id}
                        onClick={() => encerrar(item)}
                      >
                        <Icon name={revogando === item.id ? "spinner" : "close"} size={14} />
                        {revogando === item.id ? "Encerrando..." : "Encerrar"}
                      </button>
                    </td>
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
