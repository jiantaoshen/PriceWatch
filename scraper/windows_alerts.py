"""Submit existing below-target, one-time price alerts to the Windows desktop.

Keep the original price_alert_events ledger and selection criteria; only the
transport changes. Windows may suppress banners via Focus Assist/notifications.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

from price_store import now

ROOT = Path(__file__).resolve().parent.parent
NOTIFIER = ROOT / "scripts" / "show-notification.ps1"


def deliver(rows):
    """Ask the Windows shell to display one summary for this scrape run.

    Send untrusted item names as JSON through standard input, never as command
    arguments. A completed subprocess means *submitted*, not *user saw it*.
    """
    if os.name != "nt":
        raise RuntimeError("Desktop notifications require Windows and a signed-in user")
    if not NOTIFIER.is_file():
        raise FileNotFoundError(f"Notification helper missing: {NOTIFIER}")
    payload = {"items": [{
        "name": str(row["name"]),
        "price": str(row["unit_price"]),
        "target": str(row["target_unit_price"]),
        "currency": str(row["currency"]),
    } for row in rows]}
    result = subprocess.run(
        [str(Path(os.environ.get("WINDIR", r"C:\Windows")) /
             "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"),
         "-NoProfile", "-NonInteractive", "-Sta", "-ExecutionPolicy", "Bypass",
         "-File", str(NOTIFIER)],
        input=json.dumps(payload, ensure_ascii=True),
        text=True, encoding="utf-8", errors="replace", capture_output=True,
        timeout=25, cwd=ROOT, check=False,
    )
    if result.returncode:
        reason = (result.stderr or result.stdout or "PowerShell notification failed").strip()
        raise RuntimeError(reason[:500])


def send_alerts(db, started):
    """Keep original <= target selection and one event per best-price state.

    Events that were already Sent/Failed/Pending are not sent again, including
    events created by older SMTP releases. Failures are recorded, not retried,
    matching the old email behavior. The DB schema is not migrated or changed.
    """
    rows = db.execute("""SELECT b.id AS state_id,b.item_id,b.unit_price,i.name,i.target_unit_price,
        i.currency,i.unit FROM best_price_states b JOIN tracked_items i ON i.id=b.item_id
        WHERE b.recorded_at >= ? AND i.archived_at IS NULL AND i.tracking_enabled=1
          AND i.target_unit_price IS NOT NULL AND CAST(b.unit_price AS REAL)<=CAST(i.target_unit_price AS REAL)
          AND b.id=(SELECT MAX(id) FROM best_price_states WHERE item_id=i.id)""", (started,)).fetchall()
    pending = []
    for row in rows:
        with db:
            inserted = db.execute("""INSERT OR IGNORE INTO price_alert_events
              (item_id,best_price_state_id,unit_price,target_unit_price,status,created_at)
              VALUES (?,?,?,?,?,?)""", (row["item_id"], row["state_id"], row["unit_price"],
                                        row["target_unit_price"], "Pending", now()))
        if inserted.rowcount:
            pending.append(row)
    if not pending:
        return 0
    try:
        deliver(pending)
    except Exception as exc:
        error = str(exc)[:500]
        with db:
            db.executemany("""UPDATE price_alert_events SET status='Failed',error=?
                 WHERE best_price_state_id=? AND status='Pending'""",
                 [(error, row["state_id"]) for row in pending])
        print(f"Windows price notification failed: {error}", file=sys.stderr)
        return 0
    with db:
        db.executemany("""UPDATE price_alert_events SET status='Sent',sent_at=?,error=NULL
             WHERE best_price_state_id=? AND status='Pending'""",
             [(now(), row["state_id"]) for row in pending])
    return len(pending)


def send_test():
    deliver([{
        "name": "PriceWatch test notification",
        "unit_price": "99.00", "target_unit_price": "100.00", "currency": "SEK",
    }])
    print("Windows notification submitted")


if __name__ == "__main__":
    try:
        if sys.argv[1:] != ["--test"]:
            raise ValueError("Usage: python scraper/windows_alerts.py --test")
        send_test()
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"Windows notification failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
