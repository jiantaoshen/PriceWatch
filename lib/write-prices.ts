/** Manual price entries update history, best-price snapshots and item summaries. */
import { refreshBest } from "./best-price";
import { one, transaction, withDb } from "./db";
import { optionalPrice, positive } from "./write-items";

export function addManualPrice(form: FormData) {
  const itemId = String(form.get("item_id") || "");
  const sourceId = Number(form.get("source_id"));
  const price = optionalPrice(form.get("price"));
  const quantity = positive(form.get("quantity"), 1);

  if (!itemId || !Number.isSafeInteger(sourceId) || price === null) {
    throw new Error("Invalid price entry.");
  }

  const now = new Date().toISOString();
  withDb((db) =>
    transaction(db, () => {
      const source = one(
        db,
        "SELECT id FROM item_sources WHERE id=? AND item_id=? AND archived_at IS NULL",
        sourceId,
        itemId,
      );
      if (!source) {
        throw new Error("Source does not belong to this item.");
      }

      db.prepare(
        `INSERT INTO price_history
          (item_id,source_id,price,quantity,unit_price,origin,recorded_at)
          VALUES (?,?,?,?,?,?,?)`,
      ).run(
        itemId,
        sourceId,
        price,
        quantity.toFixed(4),
        (Number(price) / quantity).toFixed(6),
        "Manual",
        now,
      );

      refreshBest(db, itemId, now, "Manual");
    }),
  );

  return itemId;
}
