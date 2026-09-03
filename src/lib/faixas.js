/**
 * Faixas de performance — FONTE ÚNICA, compartilhada por servidor e telas.
 *
 * Este arquivo mora em `lib/` (e não em `server/`) porque a mesma tabela é
 * usada pelo agregado do dashboard, que roda no servidor, e pelas telas de
 * avaliação, que rodam no navegador. Antes o corte de cada faixa estava escrito
 * em três lugares — no CASE do SQL, no repositório do dashboard e na tela de
 * resultado IA — e a mesma nota podia cair em faixa diferente dependendo de
 * onde fosse lida.
 *
 * ATENÇÃO — DIVERGÊNCIA CONHECIDA: o POP de Monitoria de Qualidade define Q3 a
 * partir de 65, não de 70. A decisão está com a Qualidade. Quando a tabela
 * `faixas_performance` (migration 003) passar a ser lida por campanha, estes
 * valores viram só o fallback de quem não tem conjunto configurado.
 */
export const FAIXAS_PERFORMANCE = [
  { minimo: 90, rotulo: "Excelência", tom: "success" },
  { minimo: 80, rotulo: "Bom", tom: "success" },
  { minimo: 70, rotulo: "Atenção", tom: "warning" },
  { minimo: 0, rotulo: "Crítico", tom: "danger" },
];

/** Faixa completa de uma nota. Nota inválida cai na faixa mais baixa. */
export function faixaDaNota(score) {
  const numero = Number(score);
  if (!Number.isFinite(numero)) return FAIXAS_PERFORMANCE.at(-1);
  return FAIXAS_PERFORMANCE.find((faixa) => numero >= faixa.minimo) ?? FAIXAS_PERFORMANCE.at(-1);
}

export function nomeQuadrante(score) {
  return faixaDaNota(score).rotulo;
}
