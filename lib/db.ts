// Open the migrated SQLite file only; never create or migrate production data.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Row = Record<string, string | number | bigint | null>;
export type Value = string | number | bigint | null;

export function databasePath(): string {
  const configured = process.env.PRICEWATCH_SQLITE_PATH || "data/pricewatch.sqlite3";
  return path.resolve(process.cwd(), configured);
}

export function withDb<T>(operation: (db: DatabaseSync) => T): T {
  const filename = databasePath();
  if (!fs.existsSync(filename)) {
    throw new Error(`SQLite database not found: ${filename}. See README.md.`);
  }
  const db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;");
    return operation(db);
  } finally {
    db.close();
  }
}

export function all(db: DatabaseSync, sql: string, ...params: Value[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function one(db: DatabaseSync, sql: string, ...params: Value[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
