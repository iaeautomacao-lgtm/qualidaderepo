import { query } from "../db";

export async function getDashboardOverview({ period }) {
  const periodDays = period === "weekly" ? 7 : 31;

  const [kpis] = await query(
    `SELECT
        COUNT(*) AS reviews,
        ROUND(COALESCE(AVG(score), 0), 1) AS average_score,
        ROUND(COALESCE(AVG(ai_confidence), 0) * 100, 1) AS confidence,
        SUM(CASE WHEN status IN ('needs_review', 'rejected') THEN 1 ELSE 0 END) AS alerts
       FROM reviews
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)`,
    { periodDays }
  );

  const qualityByDay = await query(
    `SELECT DATE(created_at) AS day, ROUND(AVG(score), 1) AS score
       FROM reviews
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
      GROUP BY DATE(created_at)
      ORDER BY day`,
    { periodDays }
  );

  const wallets = await query(
    `SELECT w.id, w.name, COUNT(r.id) AS reviews, ROUND(COALESCE(AVG(r.score), 0), 1) AS score
       FROM wallets w
       LEFT JOIN reviews r ON r.wallet_id = w.id
        AND r.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL :periodDays DAY)
      GROUP BY w.id, w.name
      ORDER BY score DESC, reviews DESC`,
    { periodDays }
  );

  const recentReviews = await query(
    `SELECT r.public_id, r.score, r.status, r.created_at,
            o.name AS operator_name, w.name AS wallet_name
       FROM reviews r
       JOIN operators o ON o.id = r.operator_id
       JOIN wallets w ON w.id = r.wallet_id
      ORDER BY r.created_at DESC
      LIMIT 8`
  );

  const priorities = await query(
    `SELECT r.public_id, r.score, r.ai_confidence, r.status,
            o.name AS operator_name, w.name AS wallet_name
       FROM reviews r
       JOIN operators o ON o.id = r.operator_id
       JOIN wallets w ON w.id = r.wallet_id
      WHERE r.status IN ('needs_review', 'rejected')
         OR r.ai_confidence < 0.85
      ORDER BY r.ai_confidence ASC, r.score ASC
      LIMIT 6`
  );

  return {
    period,
    kpis: {
      averageScore: Number(kpis?.average_score || 0),
      reviews: Number(kpis?.reviews || 0),
      confidence: Number(kpis?.confidence || 0),
      alerts: Number(kpis?.alerts || 0),
    },
    qualityByDay,
    wallets,
    recentReviews,
    priorities,
  };
}
