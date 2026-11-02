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

    def test_suspicious_price_needs_review(self):
        self.db.execute("""INSERT INTO price_history(item_id,source_id,price,quantity,unit_price,origin,recorded_at)
          VALUES ('item1',1,'100.0000','1.0000','100.000000','Manual','yesterday')""")
        with self.db:
            result = save_result(self.db, "run1", self.job, {"ok": True, "price": 300})
        self.assertEqual(result, "Suspicious")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT review_status FROM scrape_results").fetchone()[0], "Pending")


if __name__ == "__main__":
    unittest.main()
