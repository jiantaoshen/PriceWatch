// Shared Products/Subscriptions page with the original card grid and status tabs.
import Link from "next/link";
import { listItems } from "../lib/queries";
import { ProductCard } from "./product-card";
import type { Row } from "../lib/db";
import { text } from "../lib/format";
export function ProductList({ kind, filter, search, sort="name" }: {kind: "Product"|"Subscription";filter:string;search:string;sort?:string}) {
  const all = listItems().filter(i => i.item_type === kind);
  const live = all.filter(i => !i.archived_at);
  const below=(i:Row)=>i.current_unit_price!=null && i.target_unit_price!=null && Number(i.current_unit_price)<=Number(i.target_unit_price);
  const drop=(i:Row)=>i.current_unit_price!=null && i.previous_unit_price!=null && Number(i.current_unit_price)<Number(i.previous_unit_price);
  const rise=(i:Row)=>i.current_unit_price!=null && i.previous_unit_price!=null && Number(i.current_unit_price)>Number(i.previous_unit_price);
  const counts={active:live.length,archived:all.length-live.length,below:live.filter(below).length,drops:live.filter(drop).length,increases:live.filter(rise).length};
  const selected=all.filter(i=> filter==="archived" ? !!i.archived_at :
    !i.archived_at && (filter==="below"?below(i):filter==="drops"?drop(i):filter==="increases"?rise(i):true));
  const visible = selected.filter(i => (text(i.name)+" "+text(i.current_stores)).toLowerCase().includes(search.toLowerCase()));
  visible.sort((a,b)=>sort==="price" ? Number(a.current_unit_price??Infinity)-Number(b.current_unit_price??Infinity)
    : sort==="gap" ? (Number(a.current_unit_price??Infinity)-Number(a.target_unit_price??0))-
                      (Number(b.current_unit_price??Infinity)-Number(b.target_unit_price??0))
    : text(a.name).localeCompare(text(b.name)));
  const base = kind==="Product"?"/":"/subscriptions";
  const url = (f:string) => `${base}?filter=${f}`;
  return <><div className="heading"><div><h1>{kind === "Product" ? "Products" : "Subscriptions"}</h1>
    <p className="subheading">Compare normalized prices, watch targets, and keep archived items for later.</p></div>
    <Link className="button" href={`/items/new?type=${kind}`}>+ Add {kind.toLowerCase()}</Link></div>
    <nav className="status-tabs" aria-label="Item filters">{[
      ["active", "Active", counts.active],["below", "Below target", counts.below],
      ["drops", "Price drops", counts.drops],["increases", "Price increases", counts.increases],["archived", "Archived", counts.archived],
    ].map(([id,name,count])=><Link key={id} className={filter===id?"active":""} href={url(String(id))}>{name} · {count}</Link>)}</nav>
    <div className="filter-toolbar"><form action={base} method="get"><input type="hidden" name="filter" value={filter}/>
      <input name="q" defaultValue={search} placeholder="Search products or stores…" aria-label="Search items"/>
      <select name="sort" defaultValue={sort} aria-label="Sort items" style={{maxWidth:170}}>
        <option value="name">Name</option><option value="price">Current price</option><option value="gap">Target gap</option>
      </select><button className="button secondary" type="submit">Apply</button></form></div>
    <p className="small muted">Showing {visible.length} {kind.toLowerCase()}{visible.length===1?"":"s"}</p>
    {visible.length?<section className="product-grid">{visible.map((i:Row)=><ProductCard key={text(i.id)} item={i}/>)}</section>:
      <div className="empty">No matching items. Add a {kind.toLowerCase()} or change the filter.</div>}</>;
}
