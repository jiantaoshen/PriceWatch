/** Soft-exclude an accepted suspicious quote using an existing SQLite status. */
import { refreshBest } from "./best-price";
import { one, transaction, withDb } from "./db";

export function excludeSuspiciousPrice(itemId: string, priceId: number) {
  if (!itemId || !Number.isSafeInteger(priceId) || priceId <= 0) {
    throw new Error("Invalid price history entry.");
  }

  withDb((db) =>
    transaction(db, () => {
      const price = one(
        db,
        `SELECT p.id,p.scrape_result_id
         FROM price_history p
         JOIN scrape_results r ON r.id=p.scrape_result_id
         WHERE p.id=? AND p.item_id=?
           AND r.result_status='Suspicious'
           AND r.review_status!='Rejected'`,
        priceId,
        itemId,
      );

      if (!price) {
        throw new Error("Active suspicious price not found.");
      }

      const now = new Date().toISOString();
      const updated = db.prepare(
        `UPDATE scrape_results
         SET review_status='Rejected',reviewed_at=?
         WHERE id=? AND review_status!='Rejected'`,
      ).run(now, price.scrape_result_id);

      if (!updated.changes) {
        throw new Error("Price was already excluded.");
      }

      // Reuse the legacy Rejected status (no database schema migration).
      // Keep price_history and price_alert_events intact. Recompute from
      // unexcluded offers without sending any Windows notification.
      refreshBest(db, itemId, now, "PriceExcluded");

      // The old previous-price fields may describe the excluded observation.
      // Clear that comparison rather than showing a false drop/increase.
      const latestValid = one(
        db,
        `SELECT MAX(p.recorded_at) AS observed_at
         FROM price_history p
         JOIN item_sources s ON s.id=p.source_id
         LEFT JOIN scrape_results r ON r.id=p.scrape_result_id
         WHERE p.item_id=? AND s.archived_at IS NULL
           AND COALESCE(r.review_status,'')!='Rejected'`,
        itemId,
      );

      db.prepare(
        `UPDATE tracked_items
         SET previous_price=NULL,previous_quantity=NULL,previous_unit_price=NULL,
           last_price_changed_at=NULL,last_successful_price_at=?,updated_at=?
         WHERE id=?`,
      ).run(latestValid?.observed_at ?? null, now, itemId);
    }),
  );
}
