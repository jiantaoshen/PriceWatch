/**
 * The lowest latest unit price from non-archived sources controls each item.
 * Precision tolerance and snapshot rules are intentionally unchanged.
 */
import type { DatabaseSync } from "node:sqlite";
import { all, one } from "./db";

export function refreshBest(
  db: DatabaseSync,
  itemId: string,
  now: string,
  cause: string,
) {
  const item = one(db, "SELECT * FROM tracked_items WHERE id=?", itemId);
  if (!item) throw new Error("Unknown item.");

  const offers = all(
    db,
    `SELECT s.id, p.price, p.quantity, p.unit_price
      FROM item_sources s JOIN price_history p ON p.id=(
        SELECT h.id FROM price_history h
        LEFT JOIN scrape_results r ON r.id=h.scrape_result_id
        WHERE h.source_id=s.id
          AND COALESCE(r.review_status, '') != 'Rejected'
        ORDER BY h.recorded_at DESC,h.id DESC LIMIT 1)
      WHERE s.item_id=? AND s.archived_at IS NULL`,
    itemId,
  );

  const sorted = offers
    .filter((offer) => Number.isFinite(Number(offer.unit_price)))
    .sort(
      (a, b) => Number(a.unit_price) - Number(b.unit_price),
    );

  if (sorted.length === 0) {
    db.prepare(
      `UPDATE tracked_items SET current_price=NULL,current_quantity=NULL,
        current_unit_price=NULL,updated_at=? WHERE id=?`,
    ).run(now, itemId);
    return;
  }

  const best = sorted[0];
  const oldUnit =
    item.current_unit_price === null ? null : Number(item.current_unit_price);
  const bestUnit = Number(best.unit_price);

  if (oldUnit !== null && Math.abs(oldUnit - bestUnit) > 1e-6) {
    db.prepare(
      `UPDATE tracked_items SET previous_price=?,previous_quantity=?,
        previous_unit_price=?,last_price_changed_at=? WHERE id=?`,
    ).run(
      item.current_price,
      item.current_quantity,
      item.current_unit_price,
      now,
      itemId,
    );
  }

  db.prepare(
    `UPDATE tracked_items SET current_price=?,current_quantity=?,
      current_unit_price=?,
      last_successful_price_at=CASE WHEN ?='PriceExcluded'
        THEN last_successful_price_at ELSE ? END,
      updated_at=? WHERE id=?`,
  ).run(best.price, best.quantity, best.unit_price, cause, now, now, itemId);

  const previous = one(
    db,
    `SELECT id,unit_price FROM best_price_states
      WHERE item_id=? ORDER BY recorded_at DESC,id DESC LIMIT 1`,
    itemId,
  );

  const bestIds = sorted
    .filter((offer) => Math.abs(Number(offer.unit_price) - bestUnit) < 1e-6)
    .map((offer) => Number(offer.id))
    .sort((a, b) => a - b);

  const priorIds = previous
    ? all(
        db,
        `SELECT source_id FROM best_price_state_sources
          WHERE best_price_state_id=? ORDER BY source_id`,
        Number(previous.id),
      ).map((row) => Number(row.source_id))
    : [];

  const samePrice =
    previous && Math.abs(Number(previous.unit_price) - bestUnit) < 1e-6;
  const sameSources =
    JSON.stringify(priorIds) ===
    JSON.stringify([...bestIds].sort((a, b) => a - b));

  if (samePrice && sameSources) return;

  const state = db.prepare(
    `INSERT INTO best_price_states
      (item_id,unit_price,cause,recorded_at) VALUES (?,?,?,?)`,
  ).run(itemId, best.unit_price, cause, now);

  for (const sourceId of bestIds) {
    db.prepare(
      `INSERT INTO best_price_state_sources
        (item_id,best_price_state_id,source_id) VALUES (?,?,?)`,
    ).run(itemId, state.lastInsertRowid, sourceId);
  }
}
