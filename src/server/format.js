// Formatação de saída das listagens.
//
// O pool abre com `dateStrings: true`, então data e hora chegam do MySQL como
// texto ("2026-08-14 10:26:00") e não como Date. Estas funções trabalham em
// cima desse texto de propósito: converter para Date e voltar introduziria o
// fuso do servidor no meio do caminho, e a operação lê os horários no fuso em
// que foram gravados.

export function formatarDataHora(valor) {
  if (!valor) return "N/A";
  const texto = String(valor);
  const [data, hora = ""] = texto.split(/[ T]/);
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return texto;
  const hhmm = hora.slice(0, 5);
  return hhmm ? `${dia}/${mes}/${ano}, ${hhmm}` : `${dia}/${mes}/${ano}`;
}

export function formatarDataIso(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10);
}

export function formatarHora(valor) {
  if (!valor) return "";
  return String(valor).slice(11, 16);
}

export function formatarDuracao(segundos) {
  const total = Number(segundos ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "N/A";
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

export function formatarCategoria(categoria) {
  if (categoria === "diagnostico") return "Diagnóstico";
  return "Padrão";
}

export function formatarScore(score) {
  const numero = Number(score ?? 0);
  return numero.toFixed(2);
}

// Identificador humano de uma análise de IA: MIA-AAAAMMDD-NNNN.
//
// Derivado da data e do id da gravação, não sorteado: o mesmo registro tem
// sempre o mesmo código, então o número que a tela mostra continua valendo se a
// análise for lida de novo ou reprocessada.
export function codigoAnaliseIa(sequencia, dataReferencia) {
  const data = String(dataReferencia || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  const numero = String(sequencia ?? 0).replace(/\D/g, "") || "0";
  return `MIA-${data || "00000000"}-${numero.padStart(4, "0").slice(-4)}`;
}

// Tamanho de anexo do jeito que a tela mostra. Base 1024 com rótulo KB/MB,
// que é a convenção que o usuário do Windows vê no explorador de arquivos.
export function formatarBytes(bytes) {
  const total = Number(bytes ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "N/A";
  if (total < 1024) return `${total} B`;
  const kb = total / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function inteiro(valor, padrao = 0) {
  const numero = Number(valor ?? padrao);
  return Number.isFinite(numero) ? numero : padrao;
}
