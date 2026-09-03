/**
 * Formatação de exibição compartilhada pelas telas.
 *
 * Tudo aqui tolera `null` e devolve "—", que significa "não informado". Zero é
 * uma medição; travessão é a ausência dela.
 */

export const SEM_VALOR = "—";

/** Remove acento e caixa — base das buscas por texto livre. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function paraData(valor) {
  if (!valor) return null;
  // Trocar " " por "T" faz "2026-08-14 10:26:00" (formato do MySQL) ser lido
  // como hora local. Sem isso o navegador interpreta como UTC e troca o dia.
  const data = valor instanceof Date ? valor : new Date(String(valor).replace(" ", "T"));
  return Number.isNaN(data.getTime()) ? null : data;
}

/** dd/mm/aaaa */
export function formatarData(valor) {
  const data = paraData(valor);
  return data ? data.toLocaleDateString("pt-BR") : SEM_VALOR;
}

/** dd/mm/aaaa, hh:mm — o formato das listagens de monitoria. */
export function formatarDataHora(valor) {
  const data = paraData(valor);
  if (!data) return SEM_VALOR;
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data.toLocaleDateString("pt-BR")}, ${hora}`;
}

/** aaaa-mm-dd no fuso local — `toISOString()` jogaria para UTC e trocaria o dia. */
export function paraIso(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Segundos -> "12:04". Duração de gravação. */
export function formatarDuracao(segundos) {
  const total = Number(segundos);
  if (!Number.isFinite(total) || total < 0) return SEM_VALOR;
  const minutos = Math.floor(total / 60);
  return `${String(minutos).padStart(2, "0")}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

/** Milhar com ponto. */
export function formatarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR") : SEM_VALOR;
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" — a lista de atividade recente. */
export function tempoRelativo(valor) {
  const data = paraData(valor);
  if (!data) return SEM_VALOR;

  const segundos = Math.round((Date.now() - data.getTime()) / 1000);
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;
  if (segundos < 2592000) return `há ${Math.floor(segundos / 86400)} d`;
  return formatarData(data);
}

/**
 * Gera e baixa um arquivo no navegador. Usada pelas exportações CSV/JSON: os
 * dados já estão na tela, então uma segunda ida ao servidor só somaria espera.
 */
export function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

/** Escapa uma linha de CSV — vírgula, aspas e quebra de linha dentro do campo. */
export function linhaCsv(valores) {
  return valores.map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`).join(",");
}
