"""Check price persistence, suspicious prices, and foreign keys without web access."""
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scraper"))
sys.path.insert(0, str(ROOT / "tests"))
from price_store import save_result
from fixture import build


class SQLiteTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        build(self.db)
        self.job = {"item_id": "item1", "source_id": 1, "default_quantity": "1"}

    def tearDown(self):
        self.db.close()

    def test_success_updates_history_and_best(self):
        with self.db:
            self.assertEqual(save_result(self.db, "run1", self.job,
                {"ok": True, "price": 99.50}), "Success")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT current_price FROM tracked_items").fetchone()[0], "99.5000")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM best_price_states").fetchone()[0], 1)
        self.assertFalse(self.db.execute("PRAGMA foreign_key_check").fetchall())

    def test_bad_price_is_recorded_but_not_accepted(self):
        with self.db:
            save_result(self.db, "run1", self.job, {"ok": False, "error": "timeout"})
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT result_status FROM scrape_results").fetchone()[0], "Failed")

    def test_suspicious_price_is_accepted_without_review(self):
        self.db.execute("""INSERT INTO price_history(item_id,source_id,price,quantity,unit_price,origin,recorded_at)
          VALUES ('item1',1,'100.0000','1.0000','100.000000','Manual','2026-01-01T00:00:00+00:00')""")
        with self.db:
            result = save_result(self.db, "run1", self.job, {"ok": True, "price": 300})
        self.assertEqual(result, "Suspicious")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 2)
        self.assertEqual(self.db.execute("SELECT review_status FROM scrape_results").fetchone()[0], "NotRequired")
        self.assertEqual(self.db.execute("SELECT current_unit_price FROM tracked_items").fetchone()[0], "300.000000")
        self.assertTrue(self.db.execute("SELECT suspicious_reason FROM scrape_results").fetchone()[0])

    def test_excluded_suspicious_price_is_not_next_scan_baseline(self):
        self.db.execute("""INSERT INTO price_history(item_id,source_id,price,quantity,unit_price,origin,recorded_at)
          VALUES ('item1',1,'100.0000','1.0000','100.000000','Manual','2026-01-01T00:00:00+00:00')""")
        with self.db:
            self.assertEqual(save_result(self.db, "run1", self.job,
                {"ok": True, "price": 10}), "Suspicious")
        self.assertEqual(self.db.execute("SELECT current_unit_price FROM tracked_items").fetchone()[0], "10.000000")
        with self.db:
            self.db.execute("UPDATE scrape_results SET review_status='Rejected',reviewed_at='now' WHERE run_id='run1'")
        self.db.execute("""INSERT INTO scrape_runs(id,started_at,status,total_items,successful,failed,suspicious)
           VALUES ('run2','now','Running',1,0,0,0)""")
        with self.db:
            self.assertEqual(save_result(self.db, "run2", self.job,
                {"ok": True, "price": 95}), "Success")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 3)
        self.assertEqual(self.db.execute("SELECT current_unit_price FROM tracked_items").fetchone()[0], "95.000000")
        self.assertEqual(self.db.execute("SELECT review_status FROM scrape_results WHERE run_id='run1'").fetchone()[0], "Rejected")

    def test_nonpositive_scraped_price_is_rejected(self):
        with self.db:
            self.assertEqual(save_result(self.db, "run1", self.job,
                {"ok": True, "price": 0}), "Failed")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
