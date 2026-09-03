import { isMissingSchemaError, one, paraLike, query } from "../db";
import { badRequest, notFound } from "../errors";
import { inteiro } from "../format";

const VAZIO = {
  itens: [],
  contadores: { total: 0, ativos: 0, inativos: 0 },
};

function texto(valor) {
  const resultado = String(valor ?? "").trim();
  return resultado || null;
}

function hora(valor, campo) {
  const resultado = texto(valor);
  if (!resultado || !/^\d{2}:\d{2}$/.test(resultado)) {
    throw badRequest(`Campo ${campo} deve estar no formato HH:MM.`);
  }
  return resultado;
}

function normalizar(row) {
  return {
    id: String(row.id),
    codigo: row.nome,
    descricao: row.nome,
    horaInicio: String(row.hora_inicio || "").slice(0, 5),
    horaFim: String(row.hora_fim || "").slice(0, 5),
    ativo: inteiro(row.ativo, 1) === 1,
  };
}

export async function listarTurnos({ busca = null } = {}) {
  try {
    const params = {};
    const where = busca ? "WHERE nome LIKE :busca" : "";
    if (busca) params.busca = paraLike(busca);

    const rows = await query(
      `SELECT id, nome, hora_inicio, hora_fim, ativo
         FROM turnos
         ${where}
        ORDER BY ativo DESC, nome`,
      params,
    );

    const itens = rows.map(normalizar);
    return {
      itens,
      contadores: {
        total: itens.length,
        ativos: itens.filter((item) => item.ativo).length,
        inativos: itens.filter((item) => !item.ativo).length,
      },
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return VAZIO;
    throw error;
  }
}

export async function criarTurno({ codigo, descricao, horaInicio, horaFim, ativo = true }) {
  const codigoFinal = texto(codigo);
  const descricaoFinal = texto(descricao) || codigoFinal;
  if (!codigoFinal) throw badRequest("Informe o codigo do turno.");

  await query(
    `INSERT INTO turnos (nome, hora_inicio, hora_fim, dias_semana, ativo)
     VALUES (:nome, :horaInicio, :horaFim, 'seg,ter,qua,qui,sex', :ativo)`,
    {
      nome: descricaoFinal,
      horaInicio: hora(horaInicio, "horaInicio"),
      horaFim: hora(horaFim, "horaFim"),
      ativo: ativo ? 1 : 0,
    },
  );

  return listarTurnos();
}

export async function atualizarTurno(turnoId, { codigo, descricao, horaInicio, horaFim, ativo }) {
  const atual = await one("SELECT id FROM turnos WHERE id = :id LIMIT 1", { id: turnoId });
  if (!atual) throw notFound("Turno nao encontrado.");

  const campos = [];
  const params = { id: turnoId };

  if (codigo !== undefined || descricao !== undefined) {
    campos.push("nome = :nome");
    params.nome = texto(descricao) || texto(codigo);
  }
  if (horaInicio !== undefined) {
    campos.push("hora_inicio = :horaInicio");
    params.horaInicio = hora(horaInicio, "horaInicio");
  }
  if (horaFim !== undefined) {
    campos.push("hora_fim = :horaFim");
    params.horaFim = hora(horaFim, "horaFim");
  }
  if (ativo !== undefined) {
    campos.push("ativo = :ativo");
    params.ativo = ativo ? 1 : 0;
  }

  if (campos.length === 0) throw badRequest("Envie ao menos um campo para alterar.");
  await query(`UPDATE turnos SET ${campos.join(", ")} WHERE id = :id`, params);
  return listarTurnos();
}

export async function excluirTurno(turnoId) {
  const atual = await one("SELECT id, nome FROM turnos WHERE id = :id LIMIT 1", { id: turnoId });
  if (!atual) throw notFound("Turno nao encontrado.");

  const vinculos = await one("SELECT COUNT(*) AS total FROM users WHERE turno_id = :id", { id: turnoId }).catch(() => ({ total: 0 }));
  if (inteiro(vinculos?.total, 0) > 0) {
    await query("UPDATE turnos SET ativo = 0 WHERE id = :id", { id: turnoId });
    return { ...(await listarTurnos()), desativado: true };
  }

  await query("DELETE FROM turnos WHERE id = :id", { id: turnoId });
  return { ...(await listarTurnos()), removido: true };
}
