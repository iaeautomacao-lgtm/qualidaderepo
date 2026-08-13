"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "./icons";
import { usuarioAtual, versao } from "@/data/seed";

/**
 * Menu espelhado do QualiTalk de referência, na mesma ordem.
 *
 * Itens com `filhos` abrem em acordeão — só um por vez. Isso não é enfeite: a
 * sidebar não pode rolar, então a altura precisa ter teto. 11 itens fechados
 * cabem sempre; dois submenus abertos ao mesmo tempo não caberiam.
 */
const menu = [
  {
    label: "Dashboard",
    href: "/",
    icon: "dashboard",
    filhos: [
      { label: "Visão geral", href: "/" },
      { label: "Avaliações", href: "/avaliacoes" },
    ],
  },
  // Não existe no menu do QualiTalk de referência, mas é por onde o áudio
  // entra no QualiDDM — sem este item a tela de upload fica inalcançável.
  { label: "Upload", href: "/upload", icon: "upload" },
  { label: "Clientes", href: "/clientes", icon: "wallet" },
  {
    label: "Formulários",
    href: "/formularios",
    icon: "checklist",
    filhos: [
      { label: "Cadastro de Formulários", href: "/formularios/novo" },
      { label: "Iniciar avaliação", href: "/avaliacoes/nova" },
      { label: "Visualizar avaliações", href: "/avaliacoes" },
      { label: "Visualizar justificativas", href: "/avaliacoes?filtro=justificativas" },
    ],
  },
  { label: "Quizzes", href: "/quizzes", icon: "target", filhos: [] },
  { label: "Monitor IA", href: "/monitor-ia", icon: "sparkles" },
  { label: "Feedback", href: "/feedback", icon: "feedback" },
  { label: "Contestações", href: "/contestacoes", icon: "alert", filhos: [] },
  { label: "Sala de Calibração", href: "/calibracao", icon: "users" },
  { label: "Calendário", href: "/calendario", icon: "calendar" },
  { label: "Relatórios", href: "/relatorios", icon: "metrics" },
  { label: "Administração", href: "/administracao", icon: "settings", filhos: [] },
];

export default function Sidebar({ active = "Dashboard", open = false, onNavigate }) {
  const [aberto, setAberto] = useState(null);

  function alternar(label) {
    setAberto((atual) => (atual === label ? null : label));
  }

  return (
    <aside className="sidebar" id="navegacao-principal" data-open={open ? "true" : "false"}>
      {/* A logo é 640x317 (proporção 2,02:1). As medidas abaixo são as REAIS do
          arquivo — quem define o tamanho exibido é o CSS, com altura
          automática. Passar width e height iguais espremia a marca.

          Sem texto acompanhando: a arte já traz o nome e a assinatura
          "Qualidade que transforma resultados". */}
      <Link href="/" className="brand" onClick={onNavigate}>
        <Image src="/logo-qualiddm-v2.png" alt="QualiDDM" width={640} height={317} priority />
      </Link>

      <div className="sidebar-user">
        <div className="avatar" aria-hidden="true">
          {usuarioAtual.iniciais}
        </div>
        <div className="user-meta">
          <strong>{usuarioAtual.nome}</strong>
          <span>{usuarioAtual.perfil}</span>
        </div>
      </div>

      <nav aria-label="Navegação principal">
        <ul className="nav-items">
          {menu.map((item) => {
            const temFilhos = Array.isArray(item.filhos) && item.filhos.length > 0;
            const expandido = aberto === item.label;
            const atual = active === item.label;
            const listaId = `submenu-${item.href.replace(/\W+/g, "-")}`;

            return (
              <li key={item.label}>
                <div className="nav-row">
                  <Link
                    className="nav-item"
                    href={item.href}
                    aria-current={atual ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <span className="nav-icon">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>

                  {temFilhos ? (
                    <button
                      className="nav-toggle"
                      type="button"
                      aria-expanded={expandido}
                      aria-controls={listaId}
                      onClick={() => alternar(item.label)}
                    >
                      <Icon name={expandido ? "chevronUp" : "chevronDown"} size={14} />
                      <span className="sr-only">
                        {expandido ? "Recolher" : "Expandir"} {item.label}
                      </span>
                    </button>
                  ) : null}
                </div>

                {temFilhos ? (
                  <ul className="nav-sub" id={listaId} hidden={!expandido}>
                    {item.filhos.map((filho) => (
                      <li key={filho.label}>
                        <Link className="nav-subitem" href={filho.href} onClick={onNavigate}>
                          {filho.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <Link className="btn danger" href="/login">
          <Icon name="logout" size={16} />
          Sair
        </Link>
        <span className="version-row">
          <span className="chip warning">{versao.ambiente}</span>
          <span>{versao.numero}</span>
        </span>
      </div>
    </aside>
  );
}
