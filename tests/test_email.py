"""Alert sending tests always use in-memory SQLite and a fake SMTP sender."""
from unittest import TestCase
from unittest.mock import patch
from pathlib import Path
import sqlite3
import sys
sys.path[:0] = [str(Path(__file__).resolve().parent.parent / "scraper")]
from fixture import build
from price_store import best_for_item
from mail_alerts import send_alerts


class EmailTests(TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        build(self.db)
        self.db.executescript("""CREATE TABLE local_email_settings (
          id INTEGER PRIMARY KEY,enabled INTEGER,smtp_host TEXT,smtp_port INTEGER,use_tls INTEGER,
          username TEXT,password TEXT,from_address TEXT,to_address TEXT);""")
        self.db.execute("""INSERT INTO local_email_settings VALUES
          (1,1,'smtp.example.com',587,1,'','','sender@example.com','recipient@example.com')""")
        self.db.execute("UPDATE tracked_items SET target_unit_price='20.000000' WHERE id='item1'")
        self.db.execute("""INSERT INTO price_history(item_id,source_id,price,quantity,unit_price,origin,recorded_at)
          VALUES('item1',1,'12.0000','1.0000','12.000000','Scrape','2026-11-01T12:00:00+00:00')""")
        best_for_item(self.db,"item1","2026-11-01T12:00:00+00:00")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @patch("mail_alerts.deliver")
    def test_send_at_most_once_per_state(self, fake):
        first = send_alerts(self.db,"2026-11-01T00:00:00+00:00")
        second = send_alerts(self.db,"2026-11-01T00:00:00+00:00")
        self.assertEqual((first,second),(1,0))
        self.assertEqual(fake.call_count,1)
        self.assertEqual(self.db.execute("SELECT status FROM price_alert_events").fetchone()[0],"Sent")

    @patch("mail_alerts.deliver")
    def test_disabled_alerts_do_not_send(self, fake):
        self.db.execute("UPDATE local_email_settings SET enabled=0")
        self.assertEqual(send_alerts(self.db,"2026-11-01T00:00:00+00:00"),0)
        fake.assert_not_called()
