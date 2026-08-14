"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/**
 * Copia um ID de monitoria para a área de transferência.
 *
 * Duas exigências de acessibilidade que o botão resolve:
 *
 * - o rótulo cita o valor ("Copiar ID QA-26-000629"). Numa tabela de 200
 *   linhas, 200 botões chamados "Copiar" são inúteis em leitor de tela;
 * - a confirmação é anunciada por uma região viva com texto, e não só pela
 *   troca do ícone de prancheta para tique — cor e forma sozinhas não avisam
 *   quem não vê (WCAG 1.4.1).
 *
 * `navigator.clipboard` não existe em contexto sem HTTPS. Nesse caso o botão
 * informa a falha em vez de fingir que copiou.
 */
export default function BotaoCopiar({ valor, rotulo = "ID" }) {
  const [estado, setEstado] = useState("idle");
  const timerRef = useRef(null);

  // Um clique novo antes de o aviso expirar não pode deixar o timer anterior
  // solto: ele apagaria a confirmação da cópia mais recente.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function copiar() {
    clearTimeout(timerRef.current);

    try {
      await navigator.clipboard.writeText(valor);
      setEstado("copiado");
    } catch {
      setEstado("erro");
    }

    timerRef.current = setTimeout(() => setEstado("idle"), 2400);
  }

  return (
    <>
      <button className="copy-id" type="button" onClick={copiar}>
        <Icon
          name={estado === "copiado" ? "check" : "copy"}
          size={14}
          label={`Copiar ${rotulo} ${valor}`}
        />
      </button>

      <span className="sr-only" role="status">
        {estado === "copiado"
          ? `${rotulo} ${valor} copiado.`
          : estado === "erro"
            ? `Não foi possível copiar o ${rotulo}. Selecione o texto e copie manualmente.`
            : ""}
      </span>
    </>
  );
}
