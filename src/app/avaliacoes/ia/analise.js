import { normalizarCriterio } from "@/components/CriterioCard";
import { faixaDaNota } from "@/lib/faixas";

/**
 * Leitura da análise IA — o que as duas telas de avaliação calculam a partir do
 * mesmo payload de `GET /api/transcricoes/[id]`.
 *
 * Mora fora das páginas porque a ficha (`/avaliacoes/ia/[id]`) e o resumo
 * executivo (`.../resumo`) precisam chegar aos MESMOS números. Duas cópias da
 * conta divergiriam na primeira mudança, e aí a mesma avaliação apareceria com
 * criticidade diferente em duas telas do mesmo produto.
 *
 * NADA AQUI INVENTA REGRA. Peso, status e marcação de eliminatório vêm do
 * formulário aplicado; o que estas funções fazem é somar e ordenar. Onde há
 * julgamento de tela (severidade, criticidade, impacto), o retorno carrega o
 * campo `base` dizendo de onde saiu — a tela mostra isso ao usuário para
 * ninguém tomar leitura da ferramenta por regra do POP.
 */

export function nota(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2) : "N/A";
}

export function ou(valor, vazio = "N/A") {
  if (valor === null || valor === undefined) return vazio;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : vazio;
}

export function percentual(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return `${Math.round(numero > 1 ? numero : numero * 100)}%`;
}

export function listaTexto(valor) {
  return Array.isArray(valor)
    ? valor.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)
    : [];
}

/** Seções da análise já com os critérios no formato do `CriterioCard`. */
export function normalizarSecoes(analise) {
  const lista = Array.isArray(analise?.secoes) ? analise.secoes : [];

  return lista.map((secao, indice) => {
    const criterios = (Array.isArray(secao?.criterios) ? secao.criterios : []).map(
      (criterio, posicao) => normalizarCriterio(criterio, `${indice}-${posicao}`),
    );

    return {
      ancora: `secao-ia-${indice}`,
      nome: secao?.nome || `Seção ${indice + 1}`,
      descricao: secao?.descricao || null,
      criterios,
      naoConformes: criterios.filter((item) => item.statusChave === "nao_conforme").length,
    };
  });
}

/**
 * Peso perdido, no total e por seção.
 *
 * Mesma regra do backend (`normalizarAnaliseEstruturada` em
 * services/avaliacao-ia.js): eliminatório e não aplicável saem da base de
 * pontos, porque eliminatório zera a nota em vez de descontar peso e não
 * aplicável não é acerto nem erro.
 */
export function impactoDaNota(secoes) {
  let total = 0;
  let obtido = 0;
  const porSecao = [];

  for (const secao of secoes) {
    let secaoTotal = 0;
    let secaoPerdido = 0;

    for (const criterio of secao.criterios || []) {
      if (criterio.eliminatoria || criterio.statusChave === "nao_aplicavel") continue;
      const peso = Math.max(0, Number(criterio.peso) || 0);
      secaoTotal += peso;
      total += peso;
      if (criterio.statusChave === "conforme") obtido += peso;
      else secaoPerdido += peso;
    }

    porSecao.push({
      nome: secao.nome,
      ancora: secao.ancora,
      total: secaoTotal,
      perdido: secaoPerdido,
      percentual: secaoTotal > 0 ? Math.round((secaoPerdido / secaoTotal) * 100) : 0,
    });
  }

  return {
    total,
    obtido,
    perdido: total - obtido,
    percentualPerdido: total > 0 ? Math.round(((total - obtido) / total) * 100) : 0,
    ofensoras: porSecao.filter((item) => item.perdido > 0).sort((a, b) => b.perdido - a.perdido),
  };
}

export function contarConformidade(analise, secoes) {
  const resumo = analise?.resumoConformidade || {};
  const criterios = secoes.flatMap((secao) => secao.criterios || []);
  const contar = (chave) => criterios.filter((item) => item.statusChave === chave).length;

  const numeroOu = (valor, calculado) => (valor != null ? Number(valor) || 0 : calculado);

  return {
    conformes: numeroOu(resumo.conformes, contar("conforme")),
    naoConformes: numeroOu(resumo.naoConformes, contar("nao_conforme")),
    naoAplicaveis: numeroOu(resumo.naoAplicaveis, contar("nao_aplicavel")),
    total: numeroOu(resumo.total, criterios.length),
  };
}

export function nivelConfianca(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return { rotulo: "Não medida", tom: "neutro" };
  if (numero >= 0.85) return { rotulo: "Alta", tom: "success" };
  if (numero >= 0.7) return { rotulo: "Média", tom: "warning" };
  return { rotulo: "Baixa", tom: "danger" };
}

/**
 * Problemas ordenados pela ordem em que devem ser tratados.
 *
 * Eliminatório primeiro — ele zera a avaliação, então nenhum critério de peso
 * alto passa na frente. Depois, peso decrescente: é o que mais custou nota.
 *
 * `severidade` compara o peso do critério com a MÉDIA DE PESO DA PRÓPRIA FICHA,
 * em vez de um número fixo. Ficha de 84 pontos e ficha de 100 pontos têm escalas
 * diferentes, e um corte fixo classificaria a mesma falha de formas diferentes
 * só porque o formulário mudou.
 */
export function problemasOrdenados(secoes) {
  const naoConformes = secoes.flatMap((secao) =>
    (secao.criterios || [])
      .filter((criterio) => criterio.statusChave === "nao_conforme")
      .map((criterio) => ({ ...criterio, secao: secao.nome, ancora: secao.ancora })),
  );

  const pesosAplicaveis = secoes
    .flatMap((secao) => secao.criterios || [])
    .filter((criterio) => !criterio.eliminatoria && criterio.statusChave !== "nao_aplicavel")
    .map((criterio) => Math.max(0, Number(criterio.peso) || 0));

  const media =
    pesosAplicaveis.length > 0
      ? pesosAplicaveis.reduce((soma, peso) => soma + peso, 0) / pesosAplicaveis.length
      : 0;

  return naoConformes
    .map((criterio) => {
      const peso = Math.max(0, Number(criterio.peso) || 0);
      const severidade = criterio.eliminatoria ? "critico" : peso >= media ? "alto" : "medio";
      return {
        ...criterio,
        severidade,
        base: criterio.eliminatoria
          ? "critério marcado como eliminatório no formulário"
          : `peso ${peso} pts contra média de ${media.toFixed(1).replace(".", ",")} pts da ficha`,
      };
    })
    .sort((a, b) => {
      if (a.eliminatoria !== b.eliminatoria) return a.eliminatoria ? -1 : 1;
      return (Number(b.peso) || 0) - (Number(a.peso) || 0);
    });
}

/**
 * Criticidade da avaliação — o quarto número do cabeçalho executivo.
 *
 * Derivada, e o motivo acompanha: é o que o gestor usa para decidir se trata
 * hoje ou na revisão semanal, então ele precisa saber por que está Alta.
 */
export function criticidadeDaAvaliacao({ analise, secoes, impacto, resumo }) {
  const motivos = [];
  const temEliminatoria = secoes
    .flatMap((secao) => secao.criterios || [])
    .some((criterio) => criterio.eliminatoria && criterio.statusChave === "nao_conforme");

  if (analise?.zerada || temEliminatoria) motivos.push("critério eliminatório não conforme");
  if (Number(analise?.nota) === 0) motivos.push("nota zerada");
  if (impacto.percentualPerdido >= 30) motivos.push(`${impacto.percentualPerdido}% do peso perdido`);
  if (resumo.naoConformes >= 3) motivos.push(`${resumo.naoConformes} critérios não conformes`);

  const faixa = faixaDaNota(analise?.nota);

  if (analise?.zerada || temEliminatoria || Number(analise?.nota) === 0) {
    return { rotulo: "Alta", tom: "danger", prioridade: "Alta", motivos };
  }
  if (faixa.rotulo === "Crítico" || faixa.rotulo === "Atenção" || resumo.naoConformes >= 3) {
    if (motivos.length === 0) motivos.push(`nota em faixa ${faixa.rotulo}`);
    return { rotulo: "Média", tom: "warning", prioridade: "Média", motivos };
  }
  return {
    rotulo: "Baixa",
    tom: "success",
    prioridade: "Baixa",
    motivos: motivos.length > 0 ? motivos : [`nota em faixa ${faixa.rotulo}`],
  };
}

/**
 * Impacto operacional em três dimensões.
 *
 * Só entram dimensões que o dado sustenta. "Impacto no cliente" ficou de fora
 * de propósito: não há pesquisa de satisfação nem tabulação ligada à análise, e
 * inventar um nível a partir do tom da conversa seria exatamente o que o
 * mapeamento proíbe. O que a IA observou sobre o cliente aparece como texto, na
 * lista de riscos.
 */
export function impactoOperacional({ analise, secoes, impacto, resumo }) {
  const eliminatoriaNaoConforme = secoes
    .flatMap((secao) => secao.criterios || [])
    .filter((criterio) => criterio.eliminatoria && criterio.statusChave === "nao_conforme");

  const faixa = faixaDaNota(analise?.nota);
  const nivelQualidade =
    faixa.rotulo === "Crítico" ? "alto" : faixa.rotulo === "Atenção" ? "medio" : "baixo";
  const nivelOperacao =
    impacto.percentualPerdido >= 30 ? "alto" : impacto.percentualPerdido >= 15 ? "medio" : "baixo";

  return [
    {
      dimensao: "Conformidade",
      nivel: eliminatoriaNaoConforme.length > 0 ? "alto" : "baixo",
      base:
        eliminatoriaNaoConforme.length > 0
          ? `${eliminatoriaNaoConforme.length} critério(s) eliminatório(s) não conforme(s): ${eliminatoriaNaoConforme
              .map((criterio) => criterio.nome)
              .join(", ")}`
          : "nenhum critério eliminatório não conforme",
    },
    {
      dimensao: "Qualidade",
      nivel: nivelQualidade,
      base: `nota ${nota(analise?.nota)} em faixa ${faixa.rotulo}`,
    },
    {
      dimensao: "Operação",
      nivel: nivelOperacao,
      base:
        impacto.total > 0
          ? `${impacto.perdido} de ${impacto.total} pontos perdidos (${impacto.percentualPerdido}%) em ${resumo.naoConformes} critério(s)`
          : "sem pontos aplicáveis na ficha",
    },
  ];
}

export const ROTULO_NIVEL = { alto: "Alto", medio: "Médio", baixo: "Baixo" };
export const TOM_NIVEL = { alto: "danger", medio: "warning", baixo: "success" };
export const ROTULO_SEVERIDADE = { critico: "Crítico", alto: "Alto", medio: "Médio" };
export const TOM_SEVERIDADE = { critico: "danger", alto: "warning", medio: "info" };
