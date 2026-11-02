// Lowest latest unit price from non-archived sources controls the item summary.
import { one, all } from "./db";
import type { DatabaseSync } from "node:sqlite";
export function refreshBest(db: DatabaseSync, itemId: string, now: string, cause: string) {
  const item = one(db,"SELECT * FROM tracked_items WHERE id=?",itemId);
  if (!item) throw new Error("Unknown item.");
  const offers = all(db,`SELECT s.id, p.price, p.quantity, p.unit_price
    FROM item_sources s JOIN price_history p ON p.id=(
      SELECT h.id FROM price_history h WHERE h.source_id=s.id
      ORDER BY h.recorded_at DESC,h.id DESC LIMIT 1)
    WHERE s.item_id=? AND s.archived_at IS NULL`,itemId);
  const sorted = offers.filter(x=>Number.isFinite(Number(x.unit_price)))
    .sort((a,b)=>Number(a.unit_price)-Number(b.unit_price));
  if (!sorted.length) {
    db.prepare(`UPDATE tracked_items SET current_price=NULL,current_quantity=NULL,
      current_unit_price=NULL,updated_at=? WHERE id=?`).run(now,itemId);
    return;
  }
  const best = sorted[0];
  const oldUnit = item.current_unit_price === null ? null : Number(item.current_unit_price);
  const bestUnit = Number(best.unit_price);
  if (oldUnit !== null && Math.abs(oldUnit-bestUnit)>1e-6) {
    db.prepare(`UPDATE tracked_items SET previous_price=?,previous_quantity=?,
      previous_unit_price=?,last_price_changed_at=? WHERE id=?`)
      .run(item.current_price,item.current_quantity,item.current_unit_price,now,itemId);
  }
  db.prepare(`UPDATE tracked_items SET current_price=?,current_quantity=?,
    current_unit_price=?,last_successful_price_at=?,updated_at=? WHERE id=?`)
    .run(best.price,best.quantity,best.unit_price,now,now,itemId);
  const previous = one(db,`SELECT id,unit_price FROM best_price_states
    WHERE item_id=? ORDER BY recorded_at DESC,id DESC LIMIT 1`,itemId);
  const bestIds = sorted.filter(x=>Math.abs(Number(x.unit_price)-bestUnit)<1e-6).map(x=>Number(x.id)).sort((a,b)=>a-b);
  const priorIds = previous ? all(db,`SELECT source_id FROM best_price_state_sources
    WHERE best_price_state_id=? ORDER BY source_id`,Number(previous.id)).map(x=>Number(x.source_id)) : [];
  if (previous && Math.abs(Number(previous.unit_price)-bestUnit)<1e-6 &&
      JSON.stringify(priorIds)===JSON.stringify([...bestIds].sort((a,b)=>a-b))) return;
  const state = db.prepare(`INSERT INTO best_price_states
    (item_id,unit_price,cause,recorded_at) VALUES (?,?,?,?)`)
    .run(itemId,best.unit_price,cause,now);
  for (const id of bestIds) db.prepare(`INSERT INTO best_price_state_sources
    (item_id,best_price_state_id,source_id) VALUES (?,?,?)`)
    .run(itemId,state.lastInsertRowid,id);
}
