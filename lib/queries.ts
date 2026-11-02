// All UI reads are parameterized and query the existing eight SQLite tables.
import { all, one, withDb } from "./db";

export function listItems() {
  return withDb(db => all(db, `
    SELECT i.id,i.name,i.item_type,i.currency,i.unit,i.current_price,i.current_unit_price,
      i.previous_unit_price,i.target_price,i.target_unit_price,i.tracking_enabled,i.archived_at,
      (SELECT COUNT(*) FROM item_sources s WHERE s.item_id=i.id AND s.archived_at IS NULL) AS sources,
      (SELECT GROUP_CONCAT(s.store, ', ') FROM item_sources s
       JOIN price_history p ON p.id=(SELECT h.id FROM price_history h WHERE h.source_id=s.id
         ORDER BY h.recorded_at DESC,h.id DESC LIMIT 1)
       WHERE s.item_id=i.id AND s.archived_at IS NULL
         AND CAST(p.unit_price AS REAL)=CAST(i.current_unit_price AS REAL)) AS current_stores
    FROM tracked_items i ORDER BY i.name`));
}

export function itemDetails(id: string) {
  return withDb(db => ({
    item: one(db, "SELECT * FROM tracked_items WHERE id=?", id),
    sources: all(db, `
      SELECT s.*, (SELECT p.price FROM price_history p WHERE p.source_id=s.id
        ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1) AS last_price,
        (SELECT p.recorded_at FROM price_history p WHERE p.source_id=s.id
        ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1) AS price_at
      FROM item_sources s WHERE s.item_id=? AND s.archived_at IS NULL ORDER BY s.store`, id),
    bestHistory: all(db, `SELECT unit_price,recorded_at FROM best_price_states
      WHERE item_id=? ORDER BY recorded_at DESC,id DESC LIMIT 80`,id).reverse(),
    history: all(db, `
      SELECT p.id,p.price,p.quantity,p.unit_price,p.origin,p.recorded_at,s.store
      FROM price_history p JOIN item_sources s ON s.id=p.source_id
      WHERE p.item_id=? ORDER BY p.recorded_at DESC,p.id DESC LIMIT 50`, id),
  }));
}

export function recentRuns() {
  return withDb(db => all(db, `
    SELECT id,started_at,finished_at,status,total_items,successful,failed,suspicious
    FROM scrape_runs ORDER BY started_at DESC LIMIT 40`));
}

export function resultsForRun(id: string) {
  return withDb(db => all(db, `
    SELECT r.result_status,r.scraped_price,r.error,r.suspicious_reason,
           r.observed_at,i.name,s.store
    FROM scrape_results r JOIN tracked_items i ON i.id=r.item_id
    LEFT JOIN item_sources s ON s.id=r.source_id
    WHERE r.run_id=? ORDER BY i.name`, id));
}
