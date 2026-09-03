"use client";

import { useEffect, useState } from "react";

/**
 * Atrasa a propagação de um valor até ele parar de mudar.
 *
 * As buscas por texto destas telas filtram no BANCO (`?busca=`), não no
 * cliente: a tabela é paginada no servidor, e filtrar só as 50 linhas
 * carregadas devolveria "nada encontrado" para um termo que existe na página
 * seguinte.
 *
 * Sem esperar, cada tecla digitada viraria uma requisição — "Fernanda" são oito
 * consultas, sete delas descartadas. 350ms é o intervalo em que a digitação
 * ainda parece contínua e o servidor recebe uma consulta por palavra.
 *
 * O campo continua controlado pelo valor imediato: quem digita vê a letra na
 * hora. É só a busca que espera.
 */
export default function useDebounce(valor, espera = 350) {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setAtrasado(valor), espera);
    return () => clearTimeout(timer);
  }, [valor, espera]);

  return atrasado;
}
