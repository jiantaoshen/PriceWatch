"""Independent scrape CLI: run Playwright, then commit results into SQLite."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from uuid import uuid4

from price_store import now, save_result
from windows_alerts import send_alerts
from run_lock import ScrapeLock

ROOT = Path(__file__).resolve().parent.parent


def database_path():
    configured = Path(os.getenv("PRICEWATCH_SQLITE_PATH", "data/pricewatch.sqlite3"))
    return configured if configured.is_absolute() else ROOT / configured


def list_jobs(db):
    return [dict(row) for row in db.execute("""SELECT i.id AS item_id,i.name,s.id AS source_id,
        s.store,s.url,s.default_quantity FROM tracked_items i
        JOIN item_sources s ON s.item_id=i.id
        WHERE i.archived_at IS NULL AND i.tracking_enabled=1
          AND s.archived_at IS NULL AND s.scraping_enabled=1 AND s.url IS NOT NULL
        ORDER BY i.name,s.id""")]


def run_worker(jobs):
    request = {"headless": True, "jobs": [{key: job[key] for key in
               ("item_id", "name", "source_id", "store", "url")} for job in jobs]}
    try:
        proc = subprocess.run([sys.executable, str(ROOT / "scraper" / "worker.py")],
            input=json.dumps(request), text=True, capture_output=True, timeout=1200, cwd=ROOT)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr, end="")
        payload = json.loads(proc.stdout)
        if proc.returncode or payload.get("error"):
            raise RuntimeError("Playwright worker failed: " + str(payload.get("error", "nonzero exit")))
        return {(str(r["item_id"]), int(r["source_id"])): r for r in payload["results"]}
    except Exception as error:
        print(f"Worker failure: {type(error).__name__}: {error}", file=sys.stderr)
        return {}


def main():
    filename = database_path()
    if not filename.is_file():
        print(f"Missing SQLite database: {filename}", file=sys.stderr)
        return 2
    with ScrapeLock(filename):
        with sqlite3.connect(filename, timeout=15) as db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
            db.execute("PRAGMA busy_timeout=15000")
            jobs = list_jobs(db)
            if not jobs:
                print("No active sources with scraping enabled; nothing to do")
                return 0
            run_id, started = str(uuid4()), now()
            with db:
                db.execute("""INSERT INTO scrape_runs
                  (id,started_at,status,total_items,successful,failed,suspicious)
                  VALUES (?,?,'Running',?,0,0,0)""", (run_id,started,len(jobs)))
            results = run_worker(jobs)
            counts = {"Success": 0, "Failed": 0, "Suspicious": 0}
            for job in jobs:
                key = (str(job["item_id"]), int(job["source_id"]))
                result = results.get(key, {"ok": False, "error": "Worker returned no result"})
                with db:
                    status = save_result(db,run_id,job,result)
                    counts[status] += 1
            accepted = counts["Success"] + counts["Suspicious"]
            state = "Success" if accepted == len(jobs) else (
                "Partial" if accepted else "Failed")
            with db:
                db.execute("""UPDATE scrape_runs SET finished_at=?,status=?,successful=?,
                  failed=?,suspicious=? WHERE id=?""",
                  (now(),state,counts["Success"],counts["Failed"],counts["Suspicious"],run_id))
            notified = send_alerts(db, started)
            if notified:
                print(f"Submitted Windows notifications for {notified} price alerts")
            print(f"Run {run_id}: {state}, success={counts['Success']}, "
                  f"failed={counts['Failed']}, suspicious={counts['Suspicious']}")
            return 0 if state == "Success" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (sqlite3.Error, RuntimeError) as error:
        print(f"Scrape aborted: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(2)
