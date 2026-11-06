"""SMTP delivery and idempotent price alerts, using only the local SQLite file."""
from email.message import EmailMessage
import os
from pathlib import Path
import sqlite3
import smtplib
import ssl
import sys
from price_store import now
from pricewatch.dpapi_secrets import (
    is_protected, migrate_legacy_password, unprotect_password,
)

ROOT = Path(__file__).resolve().parent.parent


def config(db):
    """Return disabled if the optional new settings table does not yet exist."""
    table = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='local_email_settings'").fetchone()
    if not table:
        return None
    # Older app releases stored the password as plaintext. Migrate it before
    # the scheduler reads it, even when the website has not been opened.
    migrate_legacy_password(db)
    row = db.execute("SELECT * FROM local_email_settings WHERE id=1").fetchone()
    return dict(row) if row else None


def deliver(settings, subject, body):
    """Use implicit TLS on port 465, STARTTLS otherwise; never send a password unencrypted."""
    port = int(settings["smtp_port"])
    host = settings["smtp_host"].strip()
    if not host or not settings["from_address"] or not settings["to_address"]:
        raise ValueError("Configure SMTP host, from and to addresses")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings["from_address"]
    msg["To"] = settings["to_address"]
    msg.set_content(body)
    secure = bool(settings["use_tls"])
    # Explicit verified TLS context: the library default is not guaranteed to
    # verify the SMTP server certificate on every supported Python release.
    tls_context = ssl.create_default_context()
    password = None
    if settings["username"]:
        if not secure:
            raise ValueError("TLS must be enabled before SMTP authentication")
        stored = settings["password"]
        if not stored:
            raise ValueError("SMTP password is not configured")
        # config() already migrated legacy database values. Tests may inject
        # a plaintext password directly without opening a database.
        password = unprotect_password(stored) if is_protected(stored) else stored
    connection = (smtplib.SMTP_SSL(host, port, timeout=25, context=tls_context)
                  if secure and port == 465 else smtplib.SMTP(host, port, timeout=25))
    with connection as server:
        if secure and port != 465:
            server.starttls(context=tls_context)
            server.ehlo()
        if password is not None:
            server.login(settings["username"], password)
        server.send_message(msg)


def send_alerts(db, started):
    """Email newly created best-price states only; never duplicate a sent event."""
    settings = config(db)
    if not settings or not settings["enabled"]:
        return 0
    rows = db.execute("""SELECT b.id AS state_id,b.item_id,b.unit_price,i.name,i.target_unit_price,
        i.currency,i.unit FROM best_price_states b JOIN tracked_items i ON i.id=b.item_id
        WHERE b.recorded_at >= ? AND i.archived_at IS NULL AND i.tracking_enabled=1
          AND i.target_unit_price IS NOT NULL AND CAST(b.unit_price AS REAL)<=CAST(i.target_unit_price AS REAL)
          AND b.id=(SELECT MAX(id) FROM best_price_states WHERE item_id=i.id)""", (started,)).fetchall()
    sent = 0
    for row in rows:
        with db:
            cursor = db.execute("""INSERT OR IGNORE INTO price_alert_events
              (item_id,best_price_state_id,unit_price,target_unit_price,status,created_at)
              VALUES (?,?,?,?,?,?)""", (row["item_id"],row["state_id"],row["unit_price"],
                                  row["target_unit_price"],"Pending",now()))
        if cursor.rowcount == 0:
            continue
        try:
            subject = f"PriceWatch: {row['name']} is below target"
            body = (f"{row['name']}\nBest unit price: {row['unit_price']} {row['currency']}"
                    f"\nTarget unit price: {row['target_unit_price']} {row['currency']}\n")
            deliver(settings, subject, body)
            with db:
                db.execute("UPDATE price_alert_events SET status='Sent',sent_at=?,error=NULL WHERE best_price_state_id=?",
                           (now(),row["state_id"]))
            sent += 1
        except Exception as exc:
            with db:
                db.execute("UPDATE price_alert_events SET status='Failed',error=? WHERE best_price_state_id=?",
                           (str(exc)[:500],row["state_id"]))
            print(f"Email failed for {row['name']}: {exc}", file=sys.stderr)
    return sent


def send_test():
    filename = Path(os.getenv("PRICEWATCH_SQLITE_PATH", ROOT / "data" / "pricewatch.sqlite3"))
    with sqlite3.connect(filename, timeout=15) as db:
        db.row_factory = sqlite3.Row
        settings = config(db)
        if not settings:
            raise RuntimeError("SMTP settings not saved")
        deliver(settings,"PriceWatch test email","SMTP delivery from PriceWatch Local works.")
    print("Test email sent")


if __name__ == "__main__":
    try:
        if sys.argv[1:] != ["--test"]:
            raise ValueError("Usage: python scraper/mail_alerts.py --test")
        send_test()
    except (ValueError, RuntimeError, OSError, smtplib.SMTPException, sqlite3.Error) as exc:
        print(f"Email test failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
