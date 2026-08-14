"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buscarApi } from "@/lib/api";

/**
 * Leitura de uma rota de API com os três estados que toda tela precisa tratar:
 * carregando, erro e dados.
 *
 * Duas decisões que valem para as seis telas que usam este hook:
 *
 * 1. `dados` NÃO é limpo ao recarregar. Trocar um filtro mantém a tabela
 *    anterior no lugar com `carregando: true` — a tela decide se mostra
 *    esqueleto (primeira carga, `dados` ainda nulo) ou apenas sinaliza a
 *    atualização. Limpar aqui faria a página pular de altura a cada filtro.
 *
 * 2. Requisição em voo é abortada quando a URL muda. Sem isso, mudar de filtro
 *    rápido deixa a resposta lenta da consulta ANTERIOR chegar por último e
 *    sobrescrever a atual.
 *
 * `url` nulo não busca nada — serve para dependências que ainda não existem.
 */
export default function useRecurso(url, inicial = null) {
  // Ref, não estado: `inicial` costuma ser um literal recriado a cada render, e
  // como dependência de efeito criaria um laço infinito.
  const inicialRef = useRef(inicial);
  const [dados, setDados] = useState(() => inicial);
  const [carregando, setCarregando] = useState(Boolean(url));
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setCarregando(false));
      return undefined;
    }

    const controlador = new AbortController();
    queueMicrotask(() => setCarregando(true));

    buscarApi(url, { signal: controlador.signal })
      .then((resposta) => {
        setDados(resposta);
        setErro("");
        setCarregando(false);
      })
      .catch((causa) => {
        // Abortada por troca de filtro: quem cancelou já disparou a próxima
        // busca, então não há erro para mostrar nem carregamento para encerrar.
        if (causa.name === "AbortError") return;
        setDados(inicialRef.current);
        setErro(causa.message);
        setCarregando(false);
      });

    return () => controlador.abort();
  }, [url, tentativa]);

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), []);

  return { dados, carregando, erro, recarregar };
}
