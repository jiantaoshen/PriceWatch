/** Parameterized read-only queries against the existing SQLite tables. */
import { all, one, withDb } from "./db";

export function listItems() {
  return withDb((db) =>
    all(
      db,
      `SELECT i.id,i.name,i.currency,i.unit,i.current_price,i.current_unit_price,
        i.previous_unit_price,i.target_price,i.target_unit_price,i.tracking_enabled,i.archived_at,
        (SELECT COUNT(*) FROM item_sources s WHERE s.item_id=i.id AND s.archived_at IS NULL) AS sources,
        (SELECT GROUP_CONCAT(s.store, ', ') FROM item_sources s
         JOIN price_history p ON p.id=(SELECT h.id FROM price_history h
           LEFT JOIN scrape_results r ON r.id=h.scrape_result_id
           WHERE h.source_id=s.id AND COALESCE(r.review_status,'')!='Rejected'
           ORDER BY h.recorded_at DESC,h.id DESC LIMIT 1)
         WHERE s.item_id=i.id AND s.archived_at IS NULL
           AND CAST(p.unit_price AS REAL)=CAST(i.current_unit_price AS REAL)) AS current_stores
      FROM tracked_items i ORDER BY i.name`,
    ),
  );
}

export function itemDetails(id: string) {
  return withDb((db) => ({
    item: one(db, "SELECT * FROM tracked_items WHERE id=?", id),
    sources: all(
      db,
      `SELECT s.*, (SELECT p.price FROM price_history p
          LEFT JOIN scrape_results r ON r.id=p.scrape_result_id
          WHERE p.source_id=s.id AND COALESCE(r.review_status,'')!='Rejected'
          ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1) AS last_price,
          (SELECT p.recorded_at FROM price_history p
          LEFT JOIN scrape_results r ON r.id=p.scrape_result_id
          WHERE p.source_id=s.id AND COALESCE(r.review_status,'')!='Rejected'
          ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1) AS price_at
        FROM item_sources s
        WHERE s.item_id=? AND s.archived_at IS NULL
        ORDER BY s.store`,
      id,
    ),
    archivedSources: all(
      db,
      `SELECT id,store,url,archived_at,scraping_enabled
       FROM item_sources
       WHERE item_id=? AND archived_at IS NOT NULL
       ORDER BY archived_at DESC,id DESC`,
      id,
    ),
    bestHistory: all(
      db,
      `SELECT b.unit_price,b.recorded_at FROM best_price_states b
       WHERE b.item_id=? AND EXISTS (
         SELECT 1 FROM best_price_state_sources bs
         JOIN price_history h ON h.id=(
           SELECT h2.id FROM price_history h2
           LEFT JOIN scrape_results r2 ON r2.id=h2.scrape_result_id
           WHERE h2.source_id=bs.source_id
             AND h2.recorded_at<=b.recorded_at
             AND COALESCE(r2.review_status,'')!='Rejected'
           ORDER BY h2.recorded_at DESC,h2.id DESC LIMIT 1
         )
         WHERE bs.best_price_state_id=b.id
           AND ABS(CAST(h.unit_price AS REAL)-CAST(b.unit_price AS REAL))<0.000001
       )
       ORDER BY b.recorded_at DESC,b.id DESC LIMIT 80`,
      id,
    ).reverse(),
    history: all(
      db,
      `SELECT p.id,p.price,p.quantity,p.unit_price,p.origin,p.recorded_at,s.store,
          r.result_status,r.suspicious_reason,
          CASE WHEN r.review_status='Rejected' THEN 1 ELSE 0 END AS excluded,
          r.reviewed_at AS excluded_at
        FROM price_history p JOIN item_sources s ON s.id=p.source_id
        LEFT JOIN scrape_results r ON r.id=p.scrape_result_id
        WHERE p.item_id=? ORDER BY p.recorded_at DESC,p.id DESC LIMIT 50`,
      id,
    ),
  }));
}

export function recentRuns() {
  return withDb((db) =>
    all(
      db,
      `SELECT id,started_at,finished_at,status,total_items,successful,failed,suspicious
        FROM scrape_runs ORDER BY started_at DESC LIMIT 40`,
    ),
  );
}

export function resultsForRun(id: string) {
  return withDb((db) =>
    all(
      db,
      `SELECT r.result_status,r.scraped_price,r.error,r.suspicious_reason,
          r.observed_at,i.name,s.store
        FROM scrape_results r JOIN tracked_items i ON i.id=r.item_id
        LEFT JOIN item_sources s ON s.id=r.source_id
        WHERE r.run_id=? ORDER BY i.name`,
      id,
    ),
  );
}
