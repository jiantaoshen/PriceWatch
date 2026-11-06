"""Persist valid scraped prices, flag anomalies, and maintain active best offers.

A suspicious result is an accepted observation; it is never held for approval.
The existing scrape_results.review_status = 'Rejected' flag implements auditable
schema-free soft deletion for suspect price_history entries.
"""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation


def now():
    return datetime.now(timezone.utc).isoformat()


def decimal(value, digits=4):
    """Convert a price safely, keeping decimal strings instead of floats."""
    number = Decimal(str(value))
    if not number.is_finite() or number < 0 or number > Decimal("10000000000"):
        raise ValueError("Price must be a finite, nonnegative number")
    return format(number.quantize(Decimal(1).scaleb(-digits)), "f")


def best_for_item(db, item_id, when):
    """Recompute the current lowest unit price from latest active source offers."""
    item = db.execute("SELECT * FROM tracked_items WHERE id=?", (item_id,)).fetchone()
    rows = db.execute("""SELECT s.id,p.price,p.quantity,p.unit_price FROM item_sources s
        JOIN price_history p ON p.id=(SELECT h.id FROM price_history h
            LEFT JOIN scrape_results r ON r.id=h.scrape_result_id
            WHERE h.source_id=s.id
              AND COALESCE(r.review_status, '') != 'Rejected'
            ORDER BY h.recorded_at DESC,h.id DESC LIMIT 1)
        WHERE s.item_id=? AND s.archived_at IS NULL""", (item_id,)).fetchall()
    if not rows:
        db.execute("""UPDATE tracked_items SET current_price=NULL,
          current_quantity=NULL,current_unit_price=NULL,updated_at=? WHERE id=?""",
          (when, item_id))
        return
    unit = min(Decimal(row["unit_price"]) for row in rows)
    best = [row for row in rows if Decimal(row["unit_price"]) == unit]
    best.sort(key=lambda row: row["id"])
    sample = best[0]
    old = Decimal(item["current_unit_price"]) if item["current_unit_price"] is not None else None
    if old is not None and old != unit:
        db.execute("""UPDATE tracked_items SET previous_price=current_price,
          previous_quantity=current_quantity,previous_unit_price=current_unit_price,
          last_price_changed_at=? WHERE id=?""", (when, item_id))
    db.execute("""UPDATE tracked_items SET current_price=?,current_quantity=?,
       current_unit_price=?,last_successful_price_at=?,updated_at=? WHERE id=?""",
       (sample["price"], sample["quantity"], sample["unit_price"], when, when, item_id))
    prior = db.execute("""SELECT id,unit_price FROM best_price_states WHERE item_id=?
       ORDER BY recorded_at DESC,id DESC LIMIT 1""", (item_id,)).fetchone()
    sources = [row["id"] for row in best]
    if prior:
        prior_sources = [row[0] for row in db.execute("""SELECT source_id FROM best_price_state_sources
          WHERE best_price_state_id=? ORDER BY source_id""", (prior["id"],))]
        if Decimal(prior["unit_price"]) == unit and prior_sources == sources:
            return
    state_id = db.execute("""INSERT INTO best_price_states(item_id,unit_price,cause,recorded_at)
      VALUES (?,?,?,?)""", (item_id, decimal(unit, 6), "Automatic", when)).lastrowid
    for source_id in sources:
        db.execute("""INSERT INTO best_price_state_sources
          (item_id,best_price_state_id,source_id) VALUES (?,?,?)""", (item_id, state_id, source_id))


def save_result(db, run_id, job, result):
    """Accept valid prices, including outliers; preserve the suspicious flag."""
    when = result.get("observed_at") or now()
    item_id, source_id = job["item_id"], job["source_id"]
    error, reason, price = None, None, None
    try:
        if not result.get("ok"):
            raise ValueError(result.get("error") or "Scraper returned no price")
        price = Decimal(decimal(result["price"]))
        if price <= 0:
            raise ValueError("Scraped price must be greater than zero")
    except (ValueError, InvalidOperation, TypeError, KeyError) as exc:
        error = str(exc)[:1000]
    quantity = Decimal(job["default_quantity"])
    unit = price / quantity if price is not None and quantity > 0 else None
    prior = db.execute("""SELECT p.unit_price FROM price_history p
        LEFT JOIN scrape_results r ON r.id=p.scrape_result_id
        WHERE p.source_id=? AND COALESCE(r.review_status, '') != 'Rejected'
        ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1""", (source_id,)).fetchone()
    if unit is not None and prior and Decimal(prior[0]) > 0:
        ratio = abs(unit / Decimal(prior[0]) - 1)
        if ratio > Decimal("0.80"):
            reason = f"Price changed by {ratio:.0%}; saved as suspicious"
    status = "Failed" if error else "Suspicious" if reason else "Success"
    quantity_str = decimal(quantity)
    cur = db.execute("""INSERT INTO scrape_results(run_id,item_id,source_id,scraped_price,
      scraped_quantity,scraped_unit_price,result_status,error,suspicious_reason,
      review_status,observed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
      (run_id,item_id,source_id,decimal(price) if price is not None else None,
       quantity_str if price is not None else None,decimal(unit,6) if unit is not None else None,
       status,error,reason,"NotRequired",when,now()))
    if status != "Failed":
        db.execute("""INSERT INTO price_history(item_id,source_id,scrape_result_id,
          price,quantity,unit_price,origin,recorded_at) VALUES (?,?,?,?,?,?,?,?)""",
          (item_id,source_id,cur.lastrowid,decimal(price),quantity_str,decimal(unit,6),"Scrape",when))
        best_for_item(db,item_id,when)
    db.execute("UPDATE tracked_items SET last_checked_at=?,updated_at=? WHERE id=?",(when,now(),item_id))
    return status
