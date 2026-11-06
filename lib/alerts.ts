/** Read the existing price-alert ledger (no schema change). */
import { all, withDb } from "./db";

export function recentAlerts() {
  return withDb((db) =>
    all(
      db,
      `SELECT e.id,e.unit_price,e.target_unit_price,
          e.status,e.error,e.created_at,e.sent_at,i.name,i.currency
        FROM price_alert_events e
        LEFT JOIN tracked_items i ON i.id=e.item_id
        ORDER BY e.created_at DESC,e.id DESC LIMIT 50`,
    ),
  );
}
