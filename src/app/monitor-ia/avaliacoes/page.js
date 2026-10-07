"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { formatarNumero } from "@/lib/formato";
import { FilterBar, ModuleKpis, MonitorIaPageShell, SimpleTable } from "../ModuleScaffold";

const TODOS = "todos";
const LIMITE_TABELA = 50;

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function ehAvaliacaoIa(item) {
  return (
    item.origem === "ia" ||
    String(item.id || "").startsWith("MIA-") ||
    normalizar(item.avaliador).includes("acordito") ||
    normalizar(item.formulario).includes("ia") ||
    normalizar(item.categoria).includes("monitoria ia")
  );
}

function opcoes(rotulo, itens, campo) {
  const valores = [...new Set(itens.map((item) => item[campo]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
    .map((valor) => ({ value: valor, label: valor }));

  return [{ value: TODOS, label: rotulo }, ...valores];
}

function formatarPercentual(valor) {
  if (valor == null || !Number.isFinite(Number(valor))) return "N/A";
  return `${Number(valor).toFixed(0)}%`;
}

export default function AvaliacoesMonitorIaPage() {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    busca: "",
    cliente: TODOS,
    campanha: TODOS,
    formulario: TODOS,
  });

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      try {
        const resposta = await fetch("/api/avaliacoes?limit=2000", { cache: "no-store" });
        const payload = await resposta.json().catch(() => null);
        if (!resposta.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar avaliações IA.");
        }

        if (ativo) {
          setAvaliacoes((payload.data?.avaliacoes || []).filter(ehAvaliacaoIa));
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setAvaliacoes([]);
          setErro(error.message);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const opcoesFiltro = useMemo(
    () => ({
      clientes: opcoes("Todos os clientes", avaliacoes, "cliente"),
      campanhas: opcoes("Todas as campanhas", avaliacoes, "campanha").filter(
        (campanha) =>
          filtros.cliente === TODOS ||
          campanha.value === TODOS ||
          avaliacoes.some((item) => item.cliente === filtros.cliente && item.campanha === campanha.value),
      ),
      formularios: opcoes("Todos os formulários", avaliacoes, "formulario"),
    }),
    [avaliacoes, filtros.cliente],
  );

  const filtradas = useMemo(() => {
    const busca = normalizar(filtros.busca);

    return avaliacoes.filter((item) => {
      if (filtros.cliente !== TODOS && item.cliente !== filtros.cliente) return false;
      if (filtros.campanha !== TODOS && item.campanha !== filtros.campanha) return false;
      if (filtros.formulario !== TODOS && item.formulario !== filtros.formulario) return false;
      if (
        busca &&
        ![item.id, item.codGravacao, item.formulario, item.cliente, item.campanha, item.avaliado].some((campo) =>
          normalizar(campo).includes(busca),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [avaliacoes, filtros]);

  const notas = filtradas
    .map((item) => item.scoreNumero)
    .filter((nota) => nota != null && Number.isFinite(Number(nota)))
    .map(Number);
  const confiancas = filtradas
    .map((item) => item.confianca)
    .filter((valor) => valor != null && Number.isFinite(Number(valor)))
    .map(Number);
  const notaMedia = notas.length ? notas.reduce((total, nota) => total + nota, 0) / notas.length : null;
  const confiancaMedia = confiancas.length
    ? confiancas.reduce((total, valor) => total + valor, 0) / confiancas.length
    : null;
  const criticas = filtradas.filter((item) => Number(item.scoreNumero ?? 100) === 0).length;
  const visiveis = filtradas.slice(0, LIMITE_TABELA);

  function alterar(chave, valor) {
    setFiltros((atual) => ({
      ...atual,
      [chave]: valor,
      ...(chave === "cliente" ? { campanha: TODOS } : {}),
    }));
  }

  return (
    <MonitorIaPageShell
      title="Avaliações IA"
      subtitle="Monitorias analisadas pelo Monitor IA, com os campos essenciais para revisão."
      actions={
        <>
          <Link className="btn" href="/api/avaliacoes/exportar">
            <Icon name="download" size={16} />
            Exportar
          </Link>
          <Link className="btn primary" href="/upload">
            <Icon name="upload" size={16} />
            Nova análise
          </Link>
        </>
      }
    >
      <ModuleKpis
        items={[
          { label: "Avaliações IA", value: carregando ? "..." : formatarNumero(filtradas.length), icon: "review" },
          { label: "Nota média", value: notaMedia == null ? "N/A" : notaMedia.toFixed(1), icon: "metrics" },
          { label: "Confiança média", value: formatarPercentual(confiancaMedia), icon: "target" },
          { label: "Críticas", value: carregando ? "..." : formatarNumero(criticas), icon: "alert" },
        ]}
      />

      <FilterBar>
        <input
          className="input"
          placeholder="Buscar por arquivo, ID, cliente ou operador..."
          value={filtros.busca}
          onChange={(evento) => alterar("busca", evento.target.value)}
        />
        <select className="select" value={filtros.cliente} onChange={(evento) => alterar("cliente", evento.target.value)}>
          {opcoesFiltro.clientes.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
        <select className="select" value={filtros.campanha} onChange={(evento) => alterar("campanha", evento.target.value)}>
          {opcoesFiltro.campanhas.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
        <select className="select" value={filtros.formulario} onChange={(evento) => alterar("formulario", evento.target.value)}>
          {opcoesFiltro.formularios.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
      </FilterBar>

      {erro ? (
        <p className="alert danger">
          <Icon name="alert" size={16} />
          {erro}
        </p>
      ) : null}

      <section className="card pad">
        <div className="section-head">
          <div>
            <h2>Avaliações IA</h2>
            <p>
              {carregando
                ? "Carregando análises..."
                : `${formatarNumero(filtradas.length)} análise(s) no recorte atual`}
            </p>
          </div>
          <Link className="btn ghost" href="/avaliacoes">
            Ver lista completa
            <Icon name="chevronRight" size={15} />
          </Link>
        </div>

        <SimpleTable
          columns={["Arquivo", "Cliente", "Campanha", "Formulário", "Nota", "Confiança", "Data", "Ações"]}
          rows={visiveis.map((item) => [
            <span key="arquivo">
              <strong>{item.codGravacao}</strong>
              <br />
              <span className="metric-note">{item.id}</span>
            </span>,
            item.cliente,
            item.campanha,
            item.formulario,
            item.score,
            item.confianca == null ? "N/A" : `${item.confianca}%`,
            item.dataFormatada,
            <Link key="ver" href={item.href || `/avaliacoes/${encodeURIComponent(item.id)}`}>
              Ver
            </Link>,
          ])}
        />
      </section>
    </MonitorIaPageShell>
  );
}
