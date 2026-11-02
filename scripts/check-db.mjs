// Read-only integrity and schema check; never rewrites the migration audit.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "tracked_items", "item_sources", "scrape_runs", "scrape_results",
  "price_history", "best_price_states", "best_price_state_sources", "price_alert_events"
];
const configured = process.env.PRICEWATCH_SQLITE_PATH || "data/pricewatch.sqlite3";
const filename = resolve(process.cwd(), configured);
if (!existsSync(filename)) {
  console.error(`Database missing: ${filename}`);
  process.exit(2);
}
const db = new DatabaseSync(filename, { readOnly: true });
try {
  const integrity = db.prepare("PRAGMA integrity_check").get()?.integrity_check;
  const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  if (integrity !== "ok" || foreignKeys.length) throw Error("SQLite integrity/foreign key check failed");
  for (const table of required) {
    const present = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!present) throw Error(`Missing migrated table: ${table}`);
    const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count;
    console.log(`${table}: ${count}`);
  }
  console.log("SQLite integrity and schema OK (read-only)");
} finally {
  db.close();
}
