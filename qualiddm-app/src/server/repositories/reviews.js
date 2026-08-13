import { notFound } from "../errors";
import { one, query, transaction } from "../db";

export async function listReviews({ limit = 25, offset = 0, walletId = null, status = null }) {
  const filters = [];
  const params = { limit, offset };
  if (walletId) {
    filters.push("r.wallet_id = :walletId");
    params.walletId = walletId;
  }
  if (status) {
    filters.push("r.status = :status");
    params.status = status;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  return query(
    `SELECT r.public_id, r.score, r.ai_confidence, r.duration_seconds, r.status, r.created_at,
            o.name AS operator_name, w.name AS wallet_name
       FROM reviews r
       JOIN operators o ON o.id = r.operator_id
       JOIN wallets w ON w.id = r.wallet_id
       ${where}
      ORDER BY r.created_at DESC
      LIMIT :limit OFFSET :offset`,
    params
  );
}

export async function getReview(publicId) {
  const review = await one(
    `SELECT r.id, r.public_id, r.score, r.ai_confidence, r.duration_seconds, r.status,
            r.summary, r.feedback_summary, r.created_at,
            o.name AS operator_name, o.external_code AS operator_code,
            w.id AS wallet_id, w.name AS wallet_name
       FROM reviews r
       JOIN operators o ON o.id = r.operator_id
       JOIN wallets w ON w.id = r.wallet_id
      WHERE r.public_id = :publicId
      LIMIT 1`,
    { publicId }
  );

  if (!review) throw notFound("Avaliação não encontrada.");

  const [checklist, transcript, insights, uploads] = await Promise.all([
    query(
      `SELECT item_label, result, evidence, weight
         FROM review_checklist_results
        WHERE review_id = :reviewId
        ORDER BY position ASC`,
      { reviewId: review.id }
    ),
    query(
      `SELECT speaker, message_text, started_at_seconds
         FROM transcript_messages
        WHERE review_id = :reviewId
        ORDER BY position ASC`,
      { reviewId: review.id }
    ),
    query(
      `SELECT insight_type, message_text, severity
         FROM ai_insights
        WHERE review_id = :reviewId
        ORDER BY id ASC`,
      { reviewId: review.id }
    ),
    query(
      `SELECT original_name, mime_type, size_bytes, storage_path, status
         FROM review_uploads
        WHERE review_id = :reviewId
        ORDER BY id ASC`,
      { reviewId: review.id }
    ),
  ]);

  return { ...review, checklist, transcript, insights, uploads };
}

export async function createReviewFromUpload({ files, userId }) {
  return transaction(async (connection) => {
    const publicId = `ql-${Date.now().toString(36)}`;
    const [operatorRows] = await connection.execute(
      "SELECT id FROM operators WHERE active = 1 ORDER BY id LIMIT 1"
    );
    const [walletRows] = await connection.execute(
      "SELECT id FROM wallets WHERE active = 1 ORDER BY id LIMIT 1"
    );

    const operatorId = operatorRows[0]?.id;
    const walletId = walletRows[0]?.id;

    if (!operatorId || !walletId) {
      throw new Error("Missing seed data for operators/wallets.");
    }

    const [reviewResult] = await connection.execute(
      `INSERT INTO reviews
        (public_id, wallet_id, operator_id, reviewer_id, score, ai_confidence, duration_seconds, status, summary)
       VALUES
        (:publicId, :walletId, :operatorId, :userId, 0, 0, 0, 'processing', 'Análise aguardando processamento.')`,
      { publicId, walletId, operatorId, userId }
    );

    const reviewId = reviewResult.insertId;
    for (const file of files) {
      await connection.execute(
        `INSERT INTO review_uploads
          (review_id, original_name, mime_type, size_bytes, storage_path, status)
         VALUES
          (:reviewId, :name, :type, :size, :path, 'received')`,
        {
          reviewId,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          path: `cpanel-pending/${publicId}/${file.name}`,
        }
      );
    }

    return { publicId, reviewId };
  });
}

export async function saveMockAnalysis(publicId) {
  return transaction(async (connection) => {
    const [reviewRows] = await connection.execute(
      "SELECT id FROM reviews WHERE public_id = :publicId LIMIT 1",
      { publicId }
    );
    const review = reviewRows[0];
    if (!review) throw notFound("Avaliação não encontrada.");

    await connection.execute(
      `UPDATE reviews
          SET score = 98,
              ai_confidence = 0.92,
              duration_seconds = 222,
              status = 'approved',
              summary = 'Chamada com boa condução, explicação clara e pontos de encerramento para reforçar.',
              feedback_summary = 'Reforçar protocolo, prazo e rastreabilidade no encerramento.'
        WHERE id = :reviewId`,
      { reviewId: review.id }
    );

    await connection.execute("DELETE FROM transcript_messages WHERE review_id = :reviewId", {
      reviewId: review.id,
    });
    await connection.execute("DELETE FROM review_checklist_results WHERE review_id = :reviewId", {
      reviewId: review.id,
    });
    await connection.execute("DELETE FROM ai_insights WHERE review_id = :reviewId", {
      reviewId: review.id,
    });

    const transcript = [
      ["agent", "Boa tarde, meu nome é Marina, falo da DDM. Posso confirmar seu CPF para localizar seu atendimento?"],
      ["client", "Pode sim. Eu quero entender por que recebi uma cobrança duplicada no aplicativo."],
      ["agent", "Localizei aqui. Houve uma tentativa de pagamento pendente, mas a segunda foi compensada. Vou explicar os prazos de baixa."],
      ["client", "Certo, só preciso ter certeza que não vou pagar duas vezes."],
    ];

    for (const [index, line] of transcript.entries()) {
      await connection.execute(
        `INSERT INTO transcript_messages (review_id, position, speaker, message_text, started_at_seconds)
         VALUES (:reviewId, :position, :speaker, :text, :seconds)`,
        {
          reviewId: review.id,
          position: index + 1,
          speaker: line[0],
          text: line[1],
          seconds: index * 34,
        }
      );
    }

    const checklist = [
      ["Saudação e identificação", "conforme", "Operadora se identificou e contextualizou o atendimento.", 1],
      ["Confirmação de dados sensíveis", "atencao", "Confirmação solicitada; revisar aderência da carteira.", 1],
      ["Clareza na negociação", "conforme", "Explicou causa e prazo de baixa.", 1],
      ["Registro correto no sistema", "conforme", "Registro indicado na fala da operadora.", 1],
      ["Encerramento com próximo passo", "atencao", "Faltou reforçar protocolo e prazo final.", 1],
    ];

    for (const [index, item] of checklist.entries()) {
      await connection.execute(
        `INSERT INTO review_checklist_results
          (review_id, position, item_label, result, evidence, weight)
         VALUES
          (:reviewId, :position, :label, :result, :evidence, :weight)`,
        {
          reviewId: review.id,
          position: index + 1,
          label: item[0],
          result: item[1],
          evidence: item[2],
          weight: item[3],
        }
      );
    }

    const insights = [
      ["positive", "Operadora manteve tom calmo e explicou o motivo da divergência sem interromper o cliente.", "low"],
      ["improvement", "Faltou reforçar o protocolo no encerramento, reduzindo rastreabilidade.", "medium"],
      ["recommendation", "Orientar com uma frase curta de confirmação do prazo e registrar o número do atendimento.", "medium"],
    ];

    for (const item of insights) {
      await connection.execute(
        `INSERT INTO ai_insights (review_id, insight_type, message_text, severity)
         VALUES (:reviewId, :type, :text, :severity)`,
        { reviewId: review.id, type: item[0], text: item[1], severity: item[2] }
      );
    }

    await connection.execute(
      "UPDATE review_uploads SET status = 'analyzed' WHERE review_id = :reviewId",
      { reviewId: review.id }
    );

    return { reviewId: publicId };
  });
}
