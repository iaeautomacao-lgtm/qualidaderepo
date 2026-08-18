"use client";

import { useRef } from "react";
import { Icon } from "./icons";

/**
 * Barra de abas no padrão WAI-ARIA Tabs, compartilhada pelas telas longas.
 *
 * Existe porque a ficha de monitoria e a ficha IA empilhavam de 8 a 10 cartões
 * numa página só: para ver os critérios era preciso rolar por áudio,
 * transcrição, observações e resumo. Com abas, cada bloco é um destino — e a
 * barra gruda embaixo da topbar (`.tab-bar` em globals.css), então trocar de
 * bloco não exige voltar ao topo.
 *
 * Regras do padrão que este componente garante, e que são fáceis de perder
 * quando cada tela escreve o seu:
 * - tabindex móvel: Tab entra e sai do grupo com um toque; as SETAS trocam de
 *   aba (senão o teclado precisaria de um Tab por aba para atravessar);
 * - o foco acompanha a seleção nas setas, para quem navega pelo teclado não
 *   ficar com o foco na aba anterior;
 * - o painel escondido usa o atributo `hidden` (não `display:none` no CSS),
 *   que é o que tira o conteúdo da árvore de acessibilidade.
 *
 * O painel fica com o chamador: `PainelAba` só devolve a casca com os atributos
 * ligados por id, e `hidden` quando não é a aba atual.
 */

function idAba(prefixo, id) {
  return `${prefixo}-aba-${id}`;
}

function idPainel(prefixo, id) {
  return `${prefixo}-painel-${id}`;
}

export default function Abas({
  abas,
  atual,
  onTrocar,
  rotulo,
  prefixo = "abas",
  acoes = null,
}) {
  const tablistRef = useRef(null);
  const lista = Array.isArray(abas) ? abas.filter(Boolean) : [];

  function navegar(evento) {
    const indice = lista.findIndex((item) => item.id === atual);
    let destino = null;

    if (evento.key === "ArrowRight") destino = (indice + 1) % lista.length;
    else if (evento.key === "ArrowLeft") destino = (indice - 1 + lista.length) % lista.length;
    else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = lista.length - 1;
    else return;

    evento.preventDefault();
    const proxima = lista[destino];
    onTrocar(proxima.id);
    tablistRef.current?.querySelector(`#${idAba(prefixo, proxima.id)}`)?.focus();
  }

  return (
    <div className="tab-bar">
      <div
        className="tabs"
        ref={tablistRef}
        role="tablist"
        aria-label={rotulo}
        onKeyDown={navegar}
      >
        {lista.map((item) => {
          const selecionada = atual === item.id;
          // Zero não vira pastilha: "Não conformes 0" com selo aceso lê como
          // alerta onde não há nenhum.
          const contagem = Number.isFinite(Number(item.contagem)) ? Number(item.contagem) : null;

          return (
            <button
              className="tab"
              id={idAba(prefixo, item.id)}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={idPainel(prefixo, item.id)}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => onTrocar(item.id)}
            >
              {item.icone ? <Icon name={item.icone} size={15} /> : null}
              {item.rotulo}
              {contagem !== null && contagem > 0 ? (
                <span className={`tab-count${item.alerta ? " danger" : ""}`}>
                  {contagem}
                  {/* O número sozinho não diz do quê para quem usa leitor de
                      tela — o rótulo da aba está no botão, mas a unidade não. */}
                  <span className="sr-only"> {item.unidade || "itens"}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {acoes ? <div className="tab-bar-actions">{acoes}</div> : null}
    </div>
  );
}

/**
 * Casca de um painel de aba.
 *
 * O conteúdo fica MONTADO mesmo com a aba fechada, de propósito: o chat da IA
 * perderia a conversa a cada troca de aba, a transcrição perderia a posição de
 * rolagem, e a impressão sairia com só um quarto da ficha (o `@media print` de
 * globals.css reabre os painéis escondidos, e não há o que reabrir se o React
 * tirou o conteúdo do DOM). O atributo `hidden` já tira a aba fechada da árvore
 * de acessibilidade e da ordem de tabulação.
 */
export function PainelAba({ id, atual, prefixo = "abas", className, children }) {
  return (
    <div
      className={className}
      id={idPainel(prefixo, id)}
      role="tabpanel"
      aria-labelledby={idAba(prefixo, id)}
      /* Focável para o teclado sair da barra direto no conteúdo do painel. */
      tabIndex={0}
      hidden={id !== atual}
    >
      {children}
    </div>
  );
}
