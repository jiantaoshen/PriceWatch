// Safely exercise CRUD against a temporary *copy* of the user's SQLite file.
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const configured = process.env.PRICEWATCH_SQLITE_PATH || "data/pricewatch.sqlite3";
const original = resolve(process.cwd(), configured);
if (!existsSync(original)) throw Error(`Database missing: ${original}`);
const directory = mkdtempSync(join(tmpdir(), "pricewatch-smoke-"));
const copy = join(directory, "test.sqlite3");
let db;
try {
  copyFileSync(original, copy);
  db = new DatabaseSync(copy);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; BEGIN IMMEDIATE");
  const id = randomUUID(), now = new Date().toISOString();
  db.prepare(`INSERT INTO tracked_items (id,item_type,name,currency,comparison_quantity,
    tracking_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id,"Product","Local smoke test","SEK","1.0000",1,now,now);
  const source = db.prepare(`INSERT INTO item_sources
    (item_id,store,url,scraping_enabled,default_quantity,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(id,"Test source",null,0,"1.0000",now,now);
  db.prepare(`INSERT INTO price_history
    (item_id,source_id,price,quantity,unit_price,origin,recorded_at)
    VALUES (?,?,?,?,?,?,?)`).run(id,source.lastInsertRowid,"12.5000","1.0000","12.500000","Manual",now);
  const result = db.prepare("SELECT COUNT(*) AS n FROM price_history WHERE item_id=?").get(id);
  if (result?.n !== 1) throw Error("Smoke test price insert/read failed");
  const fk = db.prepare("PRAGMA foreign_key_check").all();
  if (fk.length) throw Error("Foreign key violation in smoke test");
  db.exec("COMMIT");
  console.log("CRUD smoke test OK — all writes were on a temporary copy");
} catch (error) {
  try { db?.exec("ROLLBACK"); } catch { /* No active transaction. */ }
  throw error;
} finally {
  db?.close();
  rmSync(directory, { recursive: true, force: true });
}
