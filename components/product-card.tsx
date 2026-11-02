// Product card layout based on original PriceWatch web, backed by SQLite rows.
import Link from "next/link";
import type { Row } from "../lib/db";
import { money, text } from "../lib/format";
export function ProductCard({ item }: { item: Row }) {
  const curr = item.current_unit_price == null ? null : Number(item.current_unit_price);
  const target = item.target_unit_price == null ? null : Number(item.target_unit_price);
  const prev = item.previous_unit_price == null ? null : Number(item.previous_unit_price);
  const below = curr != null && target != null && curr <= target;
  const archived = !!item.archived_at;
  const name = text(item.name), currency = text(item.currency) || "SEK";
  return <article className={`product-card ${below ? "below" : ""} ${archived ? "archived" : ""}`}>
    <div className="top-rule"/><div className="card-body">
      <h3>{name}</h3><div className="card-metadata"><span>{item.sources} stores</span>
        <span>{archived ? "Archived" : item.tracking_enabled ? "Tracking ON" : "Tracking OFF"}</span></div>
      <p className="price-caption">Last known unit price</p>
      <div className="hero-price">{money(item.current_unit_price, currency)}</div>
      <p className="store-caption">{item.current_stores ? <>Best at <strong>{item.current_stores}</strong></> : "Waiting for a price"}</p>
      <div className="price-stats"><div className="price-stat"><div className="caption">Target</div>
        <strong>{money(item.target_unit_price,currency)}</strong></div>
        <div className="price-stat"><div className="caption">Previous</div>
          <strong>{money(item.previous_unit_price,currency)}</strong>
          {curr!=null && prev!=null && prev>0 && <div className="small muted">{((curr-prev)/prev*100).toFixed(1)}%</div>}
        </div></div></div>
    <div className="card-footer"><span className={below ? "tag good" : "tag"}>{below ? "Below target" : archived ? "Archived" : "Monitoring"}</span>
      <Link href={`/items/${encodeURIComponent(text(item.id))}`}>View details →</Link></div>
  </article>;
}
