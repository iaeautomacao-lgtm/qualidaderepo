"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import { Icon } from "./icons";

/**
 * Casca do app: sidebar + topbar + área de trabalho.
 *
 * Abaixo de 1024px a sidebar vira gaveta. O estado dela mora aqui porque
 * tanto o botão da topbar quanto o scrim precisam mexer nele.
 */
export default function AppShell({ active, breadcrumb, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Devolve o foco ao gatilho: quem abriu pelo teclado não pode ficar perdido.
    menuButtonRef.current?.focus();
  }, []);

  // Esc fecha a gaveta (WCAG 2.2 — nada preso sem saída pelo teclado).
  useEffect(() => {
    if (!drawerOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") closeDrawer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  // Trava a rolagem do fundo enquanto a gaveta cobre a tela.
  useEffect(() => {
    if (!drawerOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const trail = String(breadcrumb ?? "")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="app-shell">
      <div className="desktop-frame">
        <Sidebar active={active} open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />

        {drawerOpen ? (
          <button
            className="scrim"
            type="button"
            aria-label="Fechar menu de navegação"
            onClick={closeDrawer}
          />
        ) : null}

        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <button
                className="btn ghost icon-only menu-btn"
                type="button"
                ref={menuButtonRef}
                aria-expanded={drawerOpen}
                aria-controls="navegacao-principal"
                onClick={() => setDrawerOpen((open) => !open)}
              >
                <Icon name={drawerOpen ? "close" : "menu"} size={22} />
                <span className="sr-only">
                  {drawerOpen ? "Fechar menu" : "Abrir menu"}
                </span>
              </button>

              {trail.length > 0 ? (
                <nav className="breadcrumb" aria-label="Trilha de navegação">
                  <ol>
                    {trail.map((part, index) => {
                      const last = index === trail.length - 1;
                      return (
                        <li key={part}>
                          {index > 0 ? <Icon name="chevronRight" size={14} /> : null}
                          <span aria-current={last ? "page" : undefined}>{part}</span>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              ) : null}

              <span className="live-chip">
                <Icon name="sparkles" size={12} />
                Mock IA ativo
              </span>
            </div>

            {/* Campo de busca real: antes era um <span> decorativo com
                role="search", inalcançável pelo teclado. */}
            <form className="search-field" role="search" onSubmit={(e) => e.preventDefault()}>
              <Icon name="search" size={18} />
              <label className="sr-only" htmlFor="busca-global">
                Buscar chamada, operador ou carteira
              </label>
              <input
                className="input"
                id="busca-global"
                name="q"
                type="search"
                placeholder="Buscar chamada, operador ou carteira..."
              />
            </form>
          </div>

          <div className="workspace" id="conteudo">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
