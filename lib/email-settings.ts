// Local SMTP settings live in SQLite; the password is never returned to the page.
import { all, one, transaction, withDb } from "./db";
import type { DatabaseSync } from "node:sqlite";
const schema = `CREATE TABLE IF NOT EXISTS local_email_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0,
  smtp_host TEXT NOT NULL DEFAULT '', smtp_port INTEGER NOT NULL DEFAULT 587,
  use_tls INTEGER NOT NULL DEFAULT 1, username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '', from_address TEXT NOT NULL DEFAULT '',
  to_address TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)`;
function ensure(db:DatabaseSync) {
  db.exec(schema);
  db.prepare(`INSERT OR IGNORE INTO local_email_settings(id,updated_at) VALUES(1,?)`).run(new Date().toISOString());
}
export function emailOverview() {
  return withDb(db=>{
    ensure(db);
    const row = one(db,`SELECT enabled,smtp_host,smtp_port,use_tls,username,
      LENGTH(password)>0 AS password_configured,from_address,to_address FROM local_email_settings WHERE id=1`);
    const events = all(db,`SELECT e.id,e.status,e.unit_price,e.target_unit_price,e.created_at,e.sent_at,e.error,i.name
      FROM price_alert_events e LEFT JOIN tracked_items i ON i.id=e.item_id ORDER BY e.created_at DESC,e.id DESC LIMIT 50`);
    return {settings:row,events};
  });
}
export function saveEmailSettings(form:FormData) {
  const host=String(form.get("smtp_host")||"").trim();
  const port=Number(form.get("smtp_port"));
  const username=String(form.get("username")||"").trim();
  const from=String(form.get("from_address")||"").trim();
  const to=String(form.get("to_address")||"").trim();
  const password=String(form.get("password")||"");
  const enabled=Number(form.get("enabled")==="on");
  const tls=Number(form.get("use_tls")==="on");
  if(host.length>255 || !Number.isInteger(port) || port<1 || port>65535 ||
      [username,from,to].some(s=>s.length>300) || password.length>1000) throw Error("Invalid SMTP configuration");
  if(enabled && (!host || !from.includes("@") || !to.includes("@"))) throw Error("SMTP host, from and to are required");
  withDb(db=>transaction(db,()=>{
    ensure(db);
    db.prepare(`UPDATE local_email_settings SET enabled=?,smtp_host=?,smtp_port=?,use_tls=?,
      username=?,from_address=?,to_address=?,updated_at=? WHERE id=1`)
      .run(enabled,host,port,tls,username,from,to,new Date().toISOString());
    if(password) db.prepare("UPDATE local_email_settings SET password=? WHERE id=1").run(password);
    if(form.get("clear_password")==="on") db.prepare("UPDATE local_email_settings SET password='' WHERE id=1").run();
  }));
}
