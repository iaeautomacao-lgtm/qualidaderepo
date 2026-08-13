import { query } from "../db";

export function listWallets() {
  return query(
    `SELECT id, name, description, active, created_at
       FROM wallets
      ORDER BY name`
  );
}

export function listOperators() {
  return query(
    `SELECT o.id, o.name, o.external_code, o.active, w.name AS wallet_name
       FROM operators o
       LEFT JOIN wallets w ON w.id = o.wallet_id
      ORDER BY o.name`
  );
}

export function listChecklists() {
  return query(
    `SELECT t.id, t.name, t.version, t.active, w.name AS wallet_name,
            COUNT(i.id) AS items_count
       FROM checklist_templates t
       JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN checklist_items i ON i.template_id = t.id
      GROUP BY t.id, t.name, t.version, t.active, w.name
      ORDER BY w.name, t.name`
  );
}
