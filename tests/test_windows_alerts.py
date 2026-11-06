"""Original below-target and de-duplication behavior with a mocked Windows shell."""
from pathlib import Path
import sqlite3
import sys
from unittest import TestCase
from unittest.mock import patch

sys.path[:0] = [str(Path(__file__).resolve().parent.parent / "scraper")]
from fixture import build
from price_store import best_for_item
from windows_alerts import send_alerts


class WindowsAlertTests(TestCase):
    START = "2026-11-01T00:00:00+00:00"
    WHEN = "2026-11-01T12:00:00+00:00"

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        build(self.db)
        self.db.execute("UPDATE tracked_items SET target_unit_price='20.000000' WHERE id='item1'")
        self.set_price(12, self.WHEN)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def set_price(self, price, when):
        self.db.execute("""INSERT INTO price_history(item_id,source_id,price,quantity,
            unit_price,origin,recorded_at) VALUES ('item1',1,?,'1.0000',?,'Scrape',?)""",
            (f"{price:.4f}", f"{price:.6f}", when))
        best_for_item(self.db, "item1", when)

    @patch("windows_alerts.deliver")
    def test_new_below_target_event_only_once(self, deliver):
        self.assertEqual(send_alerts(self.db, self.START), 1)
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_called_once()
        self.assertEqual(self.db.execute("SELECT status FROM price_alert_events").fetchone()[0], "Sent")

    @patch("windows_alerts.deliver")
    def test_equal_target_keeps_original_behavior(self, deliver):
        self.db.execute("UPDATE tracked_items SET target_unit_price='12' WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 1)
        deliver.assert_called_once()

    @patch("windows_alerts.deliver")
    def test_above_target_does_not_notify(self, deliver):
        self.db.execute("UPDATE tracked_items SET target_unit_price='11' WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_no_target_does_not_notify(self, deliver):
        self.db.execute("UPDATE tracked_items SET target_unit_price=NULL WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_archived_or_disabled_item_does_not_notify(self, deliver):
        self.db.execute("UPDATE tracked_items SET archived_at='now' WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        self.db.execute("UPDATE tracked_items SET archived_at=NULL,tracking_enabled=0 WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_old_state_not_backfilled(self, deliver):
        self.assertEqual(send_alerts(self.db, "2026-11-02T00:00:00+00:00"), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_no_duplicate_after_failed_notification(self, deliver):
        deliver.side_effect = RuntimeError("Desktop not available")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        self.assertEqual(send_alerts(self.db, self.START), 0)
        self.assertEqual(deliver.call_count, 1)
        status, error = self.db.execute("SELECT status,error FROM price_alert_events").fetchone()
        self.assertEqual(status, "Failed")
        self.assertIn("Desktop not available", error)

    @patch("windows_alerts.deliver")
    def test_old_sent_email_is_not_sent_again(self, deliver):
        self.db.execute("""INSERT INTO price_alert_events
            (item_id,best_price_state_id,unit_price,target_unit_price,status,created_at,sent_at)
            SELECT item_id,id,unit_price,'20.000000','Sent','now','now' FROM best_price_states""")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_second_new_best_state_can_alert_once(self, deliver):
        self.assertEqual(send_alerts(self.db, self.START), 1)
        self.set_price(10, "2026-11-02T12:00:00+00:00")
        self.assertEqual(send_alerts(self.db, "2026-11-02T00:00:00+00:00"), 1)
        self.assertEqual(send_alerts(self.db, "2026-11-02T00:00:00+00:00"), 0)
        self.assertEqual(deliver.call_count, 2)

    @patch("windows_alerts.deliver")
    def test_suspicious_below_target_price_still_notifies_once(self, deliver):
        from price_store import save_result
        self.db.execute("UPDATE tracked_items SET target_unit_price='2.000000' WHERE id='item1'")
        self.db.execute("""INSERT INTO scrape_runs(id,started_at,status,total_items,successful,failed,suspicious)
            VALUES ('run2','now','Running',1,0,0,0)""")
        job = {"item_id": "item1", "source_id": 1, "default_quantity": "1"}
        with self.db:
            self.assertEqual(save_result(self.db, "run2", job,
                {"ok": True, "price": 1.5, "observed_at": "2026-11-02T12:00:00+00:00"}), "Suspicious")
        self.assertEqual(send_alerts(self.db, "2026-11-02T00:00:00+00:00"), 1)
        self.assertEqual(send_alerts(self.db, "2026-11-02T00:00:00+00:00"), 0)
        deliver.assert_called_once()

    @patch("windows_alerts.deliver")
    def test_excluding_only_price_never_sends_alert(self, deliver):
        # A deletion during a running scan must not notify from the old snapshot.
        self.db.execute("UPDATE tracked_items SET current_unit_price=NULL WHERE id='item1'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_recalculation_snapshot_does_not_send_alert(self, deliver):
        self.db.execute("UPDATE best_price_states SET cause='PriceExcluded'")
        self.assertEqual(send_alerts(self.db, self.START), 0)
        deliver.assert_not_called()

    @patch("windows_alerts.deliver")
    def test_legacy_email_settings_not_required(self, deliver):
        self.assertFalse(self.db.execute("SELECT name FROM sqlite_master WHERE name='local_email_settings'").fetchone())
        self.assertEqual(send_alerts(self.db, self.START), 1)
        deliver.assert_called_once()


if __name__ == "__main__":
    import unittest
    unittest.main()
