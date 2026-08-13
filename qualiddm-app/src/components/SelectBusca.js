"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import styles from "./SelectBusca.module.css";

/**
 * Combobox com busca interna, para os filtros de lista longa.
 *
 * Por que não um <select> nativo: "Avaliado" tem 104 opções e "Campanha" 26.
 * Num select o usuário rola a lista inteira procurando o nome; aqui ele digita
 * e a lista filtra. Nos filtros curtos (Operação, Avaliador, Categoria) o
 * nativo continua sendo a melhor escolha — menos código e melhor no celular.
 *
 * Segue o padrão ARIA de combobox com listbox: o foco NUNCA sai do campo de
 * texto, a opção sob o cursor do teclado é apontada por `aria-activedescendant`
 * e Esc devolve o campo ao valor selecionado.
 */
export default function SelectBusca({ label, value, options, onChange, id }) {
  const idGerado = useId();
  const base = id ?? idGerado;
  const campoId = `${base}-campo`;
  const listaId = `${base}-lista`;

  const [aberto, setAberto] = useState(false);
  // `null` = o usuário não está digitando, então o campo mostra a seleção atual.
  const [busca, setBusca] = useState(null);
  const [ativo, setAtivo] = useState(0);

  const raizRef = useRef(null);
  const campoRef = useRef(null);
  const listaRef = useRef(null);

  const selecionada = options.find((opcao) => opcao.value === value) ?? options[0];

  const visiveis = useMemo(() => {
    if (busca === null || busca.trim() === "") return options;
    const alvo = normalizar(busca);
    return options.filter((opcao) => normalizar(opcao.label).includes(alvo));
  }, [options, busca]);

  const fechar = useCallback(() => {
    setAberto(false);
    setBusca(null);
  }, []);

  const abrir = useCallback(() => {
    setAberto(true);
    const indice = options.findIndex((opcao) => opcao.value === value);
    setAtivo(indice > 0 ? indice : 0);
  }, [options, value]);

  // Clique fora fecha. `pointerdown` em vez de `click` para fechar antes de a
  // página processar o clique no que estiver embaixo.
  useEffect(() => {
    if (!aberto) return undefined;

    function aoApontarFora(evento) {
      if (!raizRef.current?.contains(evento.target)) fechar();
    }

    document.addEventListener("pointerdown", aoApontarFora);
    return () => document.removeEventListener("pointerdown", aoApontarFora);
  }, [aberto, fechar]);

  // Mantém a opção ativa visível quando a navegação é por teclado.
  useEffect(() => {
    if (!aberto) return;
    listaRef.current?.children[ativo]?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativo]);

  function selecionar(opcao) {
    onChange(opcao.value);
    fechar();
    campoRef.current?.focus();
  }

  function aoTeclar(evento) {
    const ultima = visiveis.length - 1;

    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!aberto) return abrir();
        return setAtivo((atual) => (atual >= ultima ? 0 : atual + 1));
      case "ArrowUp":
        evento.preventDefault();
        if (!aberto) return abrir();
        return setAtivo((atual) => (atual <= 0 ? ultima : atual - 1));
      case "Home":
        if (!aberto) return undefined;
        evento.preventDefault();
        return setAtivo(0);
      case "End":
        if (!aberto) return undefined;
        evento.preventDefault();
        return setAtivo(ultima);
      case "Enter":
        if (!aberto) return undefined;
        evento.preventDefault();
        if (visiveis[ativo]) selecionar(visiveis[ativo]);
        return undefined;
      case "Escape":
        if (!aberto) return undefined;
        evento.preventDefault();
        return fechar();
      case "Tab":
        if (aberto) fechar();
        return undefined;
      default:
        return undefined;
    }
  }

  const opcaoAtivaId = aberto && visiveis[ativo] ? `${base}-opcao-${ativo}` : undefined;

  return (
    <div className={styles.raiz} ref={raizRef}>
      <label className={styles.rotulo} htmlFor={campoId}>
        {label}
      </label>

      <div className={styles.campoWrap}>
        <input
          aria-activedescendant={opcaoAtivaId}
          aria-autocomplete="list"
          aria-controls={listaId}
          aria-expanded={aberto}
          autoComplete="off"
          className={`input ${styles.campo}`}
          id={campoId}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setAtivo(0);
            setAberto(true);
          }}
          // Só abre: clicar no campo já aberto é o gesto de posicionar o cursor
          // para editar a busca, não o de fechar a lista.
          onClick={() => {
            if (!aberto) abrir();
          }}
          onKeyDown={aoTeclar}
          ref={campoRef}
          role="combobox"
          type="text"
          value={busca === null ? (selecionada?.label ?? "") : busca}
        />

        {/* tabIndex -1: o campo já abre a lista pelo teclado (seta para baixo),
            e um segundo ponto de tabulação para a mesma ação só alongaria o
            caminho de quem navega pelo teclado. Continua clicável pelo mouse. */}
        <button
          aria-label={`Mostrar opções de ${label}`}
          className={styles.gatilho}
          onClick={() => {
            campoRef.current?.focus();
            if (aberto) fechar();
            else abrir();
          }}
          tabIndex={-1}
          type="button"
        >
          <Icon name={aberto ? "chevronUp" : "chevronDown"} size={16} />
        </button>
      </div>

      <ul
        aria-label={label}
        className={styles.lista}
        hidden={!aberto}
        id={listaId}
        ref={listaRef}
        role="listbox"
      >
        {visiveis.map((opcao, indice) => (
          <li
            aria-selected={opcao.value === value}
            className={styles.opcao}
            data-ativo={indice === ativo ? "true" : undefined}
            id={`${base}-opcao-${indice}`}
            key={opcao.value}
            // mousedown selecionaria antes do blur roubar o clique.
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => selecionar(opcao)}
            onMouseEnter={() => setAtivo(indice)}
            role="option"
          >
            <span className={styles.opcaoTexto}>{opcao.label}</span>
            {opcao.value === value ? <Icon name="check" size={14} /> : null}
          </li>
        ))}

        {visiveis.length === 0 ? (
          <li className={styles.vazio} role="presentation">
            Nenhuma opção corresponde ao que foi digitado.
          </li>
        ) : null}
      </ul>

      <span aria-live="polite" className="sr-only">
        {aberto ? `${visiveis.length} opções disponíveis para ${label}.` : ""}
      </span>
    </div>
  );
}

/** Busca sem acento e sem caixa — "gonçalves" acha "Gonçalves" e "goncalves". */
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
