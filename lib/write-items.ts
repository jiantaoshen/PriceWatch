// Item and source mutations use explicit transactions and preserve SQLite IDs.
import { randomUUID } from "node:crypto";
import { transaction, withDb } from "./db";
import { refreshBest } from "./best-price";

export function required(value: FormDataEntryValue | null, max = 500): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error("Required text is empty or too long.");
  return text;
}

export function positive(value: FormDataEntryValue | null, fallback: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < 0.0001 || number > 10000000 ||
      Number(number.toFixed(4)) === 0) throw new Error("Quantity must be between 0.0001 and 10,000,000.");
  return Number(number.toFixed(4));
}

export function optionalPrice(value: FormDataEntryValue | null): string | null {
  if (value === null || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e10) throw new Error("Invalid price.");
  return number.toFixed(4);
}

export function saveItem(form: FormData, itemId?: string) {
  const id = itemId || randomUUID();
  const name = required(form.get("name"));
  const itemType = form.get("item_type") === "Subscription" ? "Subscription" : "Product";
  const currency = required(form.get("currency"), 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code.");
  const unit = String(form.get("unit") || "").trim() || null;
  if (unit && unit.length > 80) throw new Error("Unit is too long.");
  const quantity = positive(form.get("comparison_quantity"), 1);
  const target = optionalPrice(form.get("target_price"));
  const targetUnit = target === null ? null : (Number(target) / quantity).toFixed(6);
  const enabled = form.get("tracking_enabled") === "on" ? 1 : 0;
  const now = new Date().toISOString();
  withDb(db => transaction(db, () => {
    if (itemId) {
      const result = db.prepare(`UPDATE tracked_items SET name=?,item_type=?,currency=?,unit=?,
        target_price=?,comparison_quantity=?,target_unit_price=?,tracking_enabled=?,updated_at=?
        WHERE id=? AND archived_at IS NULL`).run(name,itemType,currency,unit,target,quantity.toFixed(4),targetUnit,enabled,now,id);
      if (!result.changes) throw new Error("Item not found.");
    } else {
      db.prepare(`INSERT INTO tracked_items
        (id,item_type,name,currency,unit,target_price,comparison_quantity,target_unit_price,
         tracking_enabled,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
          id,itemType,name,currency,unit,target,quantity.toFixed(4),targetUnit,enabled,now,now);
    }
  }));
  return id;
}

export function archiveItem(id: string) {
  withDb(db => transaction(db, () => {
    db.prepare("UPDATE tracked_items SET tracking_enabled=0,archived_at=?,updated_at=? WHERE id=?")
      .run(new Date().toISOString(),new Date().toISOString(),id);
  }));
}

export function addSource(form: FormData) {
  const itemId = required(form.get("item_id"), 40);
  const store = required(form.get("store"), 200);
  const rawUrl = String(form.get("url") || "").trim();
  if (rawUrl) {
    if (rawUrl.length > 2048 || /[\u0000-\u001f\u007f]/.test(rawUrl)) throw new Error("Invalid source URL.");
    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch { throw new Error("Invalid source URL."); }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname ||
        parsed.username || parsed.password ||
        (parsed.port && parsed.port !== (parsed.protocol === "https:" ? "443" : "80"))) {
      throw new Error("Source URLs must use public HTTP(S) without credentials or custom ports.");
    }
  }
  const quantity = positive(form.get("default_quantity"), 1).toFixed(4);
  const enabled = rawUrl && form.get("scraping_enabled") === "on" ? 1 : 0;
  const note = String(form.get("note") || "").trim() || null;
  if (note && note.length > 2000) throw new Error("Source note is too long.");
  const now = new Date().toISOString();
  withDb(db => transaction(db, () => {
    db.prepare(`INSERT INTO item_sources
      (item_id,store,url,scraping_enabled,default_quantity,note,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(itemId,store,rawUrl || null,enabled,quantity,
      note,now,now);
  }));
  return itemId;
}

export function archiveSource(id: number, itemId: string) {
  withDb(db => transaction(db, () => {
    const now = new Date().toISOString();
    db.prepare("UPDATE item_sources SET archived_at=?,scraping_enabled=0,updated_at=? WHERE id=? AND item_id=?")
      .run(now,now,id,itemId);
    refreshBest(db,itemId,now,"SourceChange");
  }));
}

// Restore an archived item without re-enabling scraping automatically.
export function restoreItem(id: string) {
  withDb(db => transaction(db, () => {
    const now = new Date().toISOString();
    db.prepare("UPDATE tracked_items SET archived_at=NULL,tracking_enabled=0,updated_at=? WHERE id=?")
      .run(now,id);
  }));
}
