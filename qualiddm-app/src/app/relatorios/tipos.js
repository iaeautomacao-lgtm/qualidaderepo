export const tiposRelatorioIA = [
  {
    id: "ia-resumo-executivo",
    nome: "Resumo executivo com IA",
    favorito: true,
    ia: true,
    tipoNaApi: "resumo-executivo",
  },
  {
    id: "ia-analise-ofensores",
    nome: "Análise de ofensores",
    favorito: false,
    ia: true,
    tipoNaApi: "ofensores",
  },
  {
    id: "ia-plano-coaching",
    nome: "Plano de coaching",
    favorito: false,
    ia: true,
    tipoNaApi: "coaching",
  },
  {
    id: "ia-risco-ncg",
    nome: "Risco de NCG",
    favorito: false,
    ia: true,
    tipoNaApi: "risco-ncg",
  },
];

export const tiposRelatorioSistema = [
  { id: "base-avaliacoes", nome: "Base de avaliações", favorito: true, ia: false },
  { id: "base-monitoria-ia", nome: "Base de Monitoria IA", favorito: false, ia: false },
  { id: "feedbacks", nome: "Feedbacks", favorito: false, ia: false },
  { id: "contestacoes", nome: "Contestações", favorito: false, ia: false },
  { id: "formularios", nome: "Formulários", favorito: false, ia: false },
];

export const GRUPOS_TIPOS = [
  { id: "ia", titulo: "Análises com IA", itens: tiposRelatorioIA },
  { id: "sistema", titulo: "Relatórios do sistema", itens: tiposRelatorioSistema },
];

export const TODOS_OS_TIPOS = [...tiposRelatorioIA, ...tiposRelatorioSistema];
