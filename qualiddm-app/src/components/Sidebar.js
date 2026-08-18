"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

const usuarioAtual = {
  iniciais: "GO",
  nome: "Gisele Oliveira",
  perfil: "Administrador",
};

const versao = { numero: "v1.5.0", ambiente: "PROD" };

/**
 * Menu espelhado do QualiTalk de referência, na mesma ordem.
 *
 * Itens com `filhos` abrem em acordeão — só um por vez. Isso não é enfeite: a
 * sidebar tem teto de altura (100dvh), então dois submenus abertos ao mesmo
 * tempo empurrariam os últimos itens para fora da área visível.
 *
 * A própria <nav> tem rolagem em globals.css. Antes o excesso era CLIPADO pelo
 * `overflow: hidden` da sidebar — item de menu invisível e, pior, inalcançável
 * pelo teclado. Com um submenu aberto em tela baixa isso já acontecia.
 */
const menu = [
  {
    label: "Dashboard",
    href: "/",
    icon: "dashboard",
  },
  // Não existe no menu do QualiTalk de referência, mas é por onde o áudio
  // entra no QualiDDM — sem este item a tela de upload fica inalcançável.
  { label: "Upload", href: "/upload", icon: "upload" },
  { label: "Clientes", href: "/clientes", icon: "wallet" },
  { label: "Avaliações", href: "/avaliacoes", icon: "review" },
  {
    label: "Formulários",
    href: "/formularios",
    icon: "checklist",
    filhos: [
      { label: "Painel", href: "/formularios" },
      { label: "Justificativas", href: "/formularios/justificativas" },
      { label: "Monitorias editadas", href: "/formularios/monitorias-editadas" },
    ],
  },
  // Monitor IA e Transcrições ficam como entradas próprias, no padrão da tela
  // de referência: primeiro a gestão das personas, depois a entrada dos áudios.
  { label: "Monitor IA", href: "/monitor-ia", icon: "sparkles" },
  { label: "Transcrições", href: "/transcricoes", icon: "waveform" },
  { label: "Feedback", href: "/feedback", icon: "feedback" },
  { label: "Administração", href: "/administracao", icon: "settings", filhos: [] },
];

export default function Sidebar({ active = "Dashboard", open = false, onNavigate }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(null);

  const grupoDaRota = useMemo(
    () =>
      menu.find(
        (item) =>
          Array.isArray(item.filhos) &&
          item.filhos.length > 0 &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`) || item.filhos.some((filho) => pathname === filho.href)),
      )?.label ?? null,
    [pathname],
  );

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
            const expandido = (grupoDaRota || aberto) === item.label;
            const atual = active === item.label || pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                        <Link
                          className="nav-subitem"
                          href={filho.href}
                          aria-current={pathname === filho.href ? "page" : undefined}
                          onClick={onNavigate}
                        >
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
