"""An accepted suspicious quote still completes the scheduled run successfully."""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "scraper"), str(ROOT / "tests")]

from fixture import build
from price_store import best_for_item
import run_once


class RunOnceTests(unittest.TestCase):
    def test_suspicious_only_run_is_success_and_keeps_notification_path(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "prices.sqlite3"
            with sqlite3.connect(database) as db:
                db.row_factory = sqlite3.Row
                build(db)
                db.execute("""INSERT INTO price_history
                    (item_id,source_id,price,quantity,unit_price,origin,recorded_at)
                    VALUES ('item1',1,'100.0000','1.0000','100.000000','Manual',
                            '2026-01-01T00:00:00+00:00')""")
                best_for_item(db, "item1", "2026-01-01T00:00:00+00:00")
                db.commit()

            result = {
                ("item1", 1): {
                    "ok": True,
                    "price": 10,
                    "observed_at": "2026-11-02T00:00:00+00:00",
                },
            }
            with patch.object(run_once, "database_path", return_value=database), \
                 patch.object(run_once, "run_worker", return_value=result), \
                 patch.object(run_once, "send_alerts", return_value=1) as alerts:
                self.assertEqual(run_once.main(), 0)
                alerts.assert_called_once()

            with sqlite3.connect(database) as db:
                self.assertEqual(
                    db.execute("SELECT current_unit_price FROM tracked_items").fetchone()[0],
                    "10.000000",
                )
                self.assertEqual(
                    db.execute("SELECT status FROM scrape_runs ORDER BY rowid DESC LIMIT 1").fetchone()[0],
                    "Success",
                )
                self.assertEqual(
                    db.execute("SELECT suspicious FROM scrape_runs ORDER BY rowid DESC LIMIT 1").fetchone()[0],
                    1,
                )


if __name__ == "__main__":
    unittest.main()
