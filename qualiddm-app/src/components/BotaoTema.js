"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

/**
 * Alterna entre tema claro e escuro.
 *
 * O tema mora num atributo `data-theme` no <html>, e não num estado do React,
 * porque o CSS já é escrito assim (`:root[data-theme="escuro"]`) e porque o
 * atributo existe antes de qualquer componente montar — é o que permite o
 * script anti-piscada do layout aplicar a escolha antes da primeira pintura.
 *
 * Guarda em `localStorage` e não em cookie: é preferência de aparência, não
 * viaja para o servidor e não muda o HTML renderizado. Mandar no cookie faria
 * cada requisição carregar um dado que só o navegador usa.
 */
const CHAVE = "qualiddm-tema";

/* `useSyncExternalStore` e não `useState` + `useEffect`.
 *
 * A fonte da verdade é o DOM, que o servidor não enxerga. Ler no estado
 * inicial faria o HTML do servidor divergir do primeiro render do cliente e
 * quebraria a hidratação; ler dentro de um efeito resolveria isso ao custo de
 * um render em cascata. Este hook existe exatamente para o caso de estado que
 * vive fora do React: o servidor recebe `snapshotServidor`, o cliente lê o
 * atributo, e a troca é anunciada pelo observador abaixo.
 */
function assinar(aoMudar) {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observador.disconnect();
}

function snapshot() {
  return document.documentElement.getAttribute("data-theme") === "escuro" ? "escuro" : "claro";
}

function snapshotServidor() {
  return "claro";
}

export default function BotaoTema() {
  const tema = useSyncExternalStore(assinar, snapshot, snapshotServidor);
  const escuro = tema === "escuro";

  function alternar() {
    const proximo = escuro ? "claro" : "escuro";
    document.documentElement.setAttribute("data-theme", proximo);
    try {
      window.localStorage.setItem(CHAVE, proximo);
    } catch {
      // Navegador com armazenamento bloqueado (aba anônima, política de
      // privacidade): o tema vale para esta sessão e não persiste. Derrubar a
      // troca inteira por causa disso seria pior do que esquecer a escolha.
    }
  }

  return (
    <button
      className="btn ghost theme-toggle"
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={escuro}
      title={escuro ? "Tema claro" : "Tema escuro"}
    >
      <Icon name={escuro ? "sun" : "moon"} size={16} />
      <span>{escuro ? "Claro" : "Escuro"}</span>
    </button>
  );
}
