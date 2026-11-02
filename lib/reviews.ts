// Pending suspicious scrape observations can be accepted or rejected locally.
import { all, one, transaction, withDb } from "./db";
import { refreshBest } from "./best-price";
export function pendingReviews() {
  return withDb(db=>all(db,`SELECT r.id,r.item_id,r.source_id,r.observed_at,r.scraped_price,
    r.scraped_quantity,r.scraped_unit_price,r.suspicious_reason,i.name,i.currency,s.store
    FROM scrape_results r JOIN tracked_items i ON i.id=r.item_id
    JOIN item_sources s ON s.id=r.source_id
    WHERE r.result_status='Suspicious' AND r.review_status='Pending'
    ORDER BY r.observed_at DESC LIMIT 100`));
}
export function resolveReview(id:number,decision:"Approved"|"Rejected") {
  if(!Number.isSafeInteger(id)||id<=0) throw Error("Invalid review ID");
  withDb(db=>transaction(db,()=>{
    const row=one(db,`SELECT r.* FROM scrape_results r JOIN item_sources s ON s.id=r.source_id
      WHERE r.id=? AND r.result_status='Suspicious' AND r.review_status='Pending' AND s.archived_at IS NULL`,id);
    if(!row) throw Error("Review missing or already resolved");
    const now=new Date().toISOString();
    if(decision==="Approved") {
      if(row.scraped_price==null||row.scraped_quantity==null||row.scraped_unit_price==null) throw Error("Missing price");
      db.prepare(`INSERT INTO price_history(item_id,source_id,scrape_result_id,
        price,quantity,unit_price,origin,recorded_at) VALUES(?,?,?,?,?,?,?,?)`)
        .run(row.item_id,row.source_id,id,row.scraped_price,row.scraped_quantity,row.scraped_unit_price,"Review",now);
      refreshBest(db,String(row.item_id),now,"Review");
    }
    db.prepare("UPDATE scrape_results SET review_status=?,reviewed_at=? WHERE id=?").run(decision,now,id);
  }));
}
