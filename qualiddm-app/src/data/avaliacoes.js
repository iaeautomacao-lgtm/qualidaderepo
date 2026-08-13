/**
 * Avaliações da tela `/avaliacoes`.
 *
 * Contém APENAS a QA-26-000541, única avaliação que aparece nos prints de
 * referência com todos os campos legíveis. Nenhum registro é inventado: uma
 * lista com avaliações fictícias faria a tela parecer populada e levaria a
 * conclusões sobre uma operação que não existe.
 *
 * O resto chega quando o MySQL entrar.
 */

import { avaliacao } from "./seed";

const FORMULARIO = avaliacao.formulario;
const CLIENTE = avaliacao.cliente;
const SUPERVISOR = avaliacao.supervisor;

/**
 * 425 é o total que o print do sistema de referência mostrava no contador da
 * tela de avaliações. É número real, mas de OUTRO sistema — por isso não vale
 * como total desta base, que tem uma avaliação só.
 */
export const totalAvaliacoesPeriodo = null;

export const STATUS_PENDENTE = "Feedback Pendente";
export const STATUS_APLICADO = "Aplicado";

/**
 * Registros da amostra. `data` fica em ISO porque é o formato que o
 * `<input type="date">` devolve — comparar string ISO já ordena corretamente e
 * evita converter datas a cada tecla digitada no filtro de período.
 */
const registros = [
  {
    id: "QA-26-000541",
    avaliado: avaliacao.avaliado.nome,
    avaliador: avaliacao.avaliador.nome,
    campanha: "Telefone Ativo",
    categoria: "Padrão",
    score: "88.00",
    data: "2026-08-07",
    hora: "09:46",
    dataContato: "2026-08-03",
    horaContato: "09:40",
    duracao: "5:44",
    duracaoAudio: "2:21",
    codGravacao: "04201062600",
    statusFeedback: STATUS_PENDENTE,
  },
];

/** "2026-08-07" + "09:46" -> "07/08/2026, 09:46" */
export function formatarDataHora(iso, hora) {
  const [ano, mes, dia] = iso.split("-");
  return hora ? `${dia}/${mes}/${ano}, ${hora}` : `${dia}/${mes}/${ano}`;
}

/**
 * Faixa de cor da nota. É reforço visual: o número em si já é a informação, e
 * cada uso acompanha rótulo em texto (WCAG 1.4.1).
 */
export function tomDoScore(score) {
  const valor = Number(score);
  if (valor >= 85) return "success";
  if (valor >= 70) return "warning";
  return "danger";
}

export const avaliacoes = registros.map((registro) => ({
  ...registro,
  formulario: FORMULARIO,
  cliente: CLIENTE,
  dataFormatada: formatarDataHora(registro.data),
}));

/**
 * Monta a ficha completa de um registro da amostra.
 *
 * Para a QA-26-000541 devolve exatamente o objeto do seed. Para as demais,
 * reaproveita o que é constante no formulário (prazos, supervisor) e troca o
 * que varia por avaliação.
 */
export function getAvaliacao(id) {
  if (id === avaliacao.id) return avaliacao;

  const registro = avaliacoes.find((item) => item.id === id);
  if (!registro) return null;

  return {
    id: registro.id,
    formulario: registro.formulario,
    cliente: registro.cliente,
    campanha: registro.campanha,
    codGravacao: registro.codGravacao,
    score: registro.score,
    duracao: registro.duracao,
    duracaoAudio: registro.duracaoAudio,
    categoria: registro.categoria,
    statusFeedback: registro.statusFeedback,
    dataAvaliacao: formatarDataHora(registro.data, registro.hora),
    dataContato: formatarDataHora(registro.dataContato, registro.horaContato),
    prazoFeedback: avaliacao.prazoFeedback,
    prazoContestacao: avaliacao.prazoContestacao,
    // Pessoas vêm do seed com o e-mail REAL lido do print. Antes havia um
    // gerador que montava endereço a partir do nome — produzia
    // "camilly.s@..." no lugar do "camilly.v@..." verdadeiro.
    avaliado: avaliacao.avaliado,
    avaliador: avaliacao.avaliador,
    supervisor: SUPERVISOR,
    resumo: avaliacao.resumo,
  };
}
