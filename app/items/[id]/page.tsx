// Edit a tracked item, manage its sources, and browse the latest price history.
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemDetails } from "../../../lib/queries";
import { PriceChart } from "../../../components/price-chart";
import { money, text, time } from "../../../lib/format";
import { saveItemAction, archiveItemAction, restoreItemAction, addSourceAction, archiveSourceAction, addPriceAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ItemPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  const { item, sources, history, bestHistory } = itemDetails(id);
  if (!item) notFound();

  return <><div className="heading"><div><p className="eyebrow">ITEM DETAILS</p><h1>{item.name}</h1>
    <p className="muted">Current lowest price: <strong>{money(item.current_price,item.currency as string)}</strong></p></div>
    <Link className="button secondary" href="/">Back to list</Link></div>

    {item.archived_at && <form className="notice" action={restoreItemAction}>This item is archived.
      <input type="hidden" name="id" value={id}/><button type="submit">Restore item (tracking remains off)</button></form>}

    <div className="grid two"><section className="panel"><h2>Item Settings</h2>
      <form className="form compact" action={saveItemAction}>
        <input type="hidden" name="id" value={id}/>
        <label>Name<input name="name" defaultValue={text(item.name)} maxLength={500} required/></label>
        <div className="grid two"><label>Type<select name="item_type" defaultValue={text(item.item_type)}><option>Product</option><option>Subscription</option></select></label>
          <label>Currency<input name="currency" defaultValue={text(item.currency)} maxLength={3} required/></label></div>
        <div className="grid two"><label>Comparison Quantity<input name="comparison_quantity" type="number" min="0.0001" step="any" defaultValue={text(item.comparison_quantity)} required/></label>
          <label>Unit<input name="unit" defaultValue={text(item.unit)}/></label></div>
        <label>Target Price<input name="target_price" type="number" min="0" step="any" defaultValue={text(item.target_price)}/></label>
        <label className="check"><input name="tracking_enabled" type="checkbox" defaultChecked={Boolean(item.tracking_enabled)}/> Enable Tracking</label>
        <button type="submit">Save Changes</button>
      </form>

      {!item.archived_at && <form className="danger-zone" action={archiveItemAction}>
        <input type="hidden" name="id" value={id}/><button className="danger" type="submit">Archive Item</button>
      </form>}</section>

      <section className="panel"><h2>Add Source</h2>
      <form className="form compact" action={addSourceAction}>
        <input type="hidden" name="item_id" value={id}/>
        <label>Store Name<input name="store" required placeholder="Apotea"/></label>
        <label>Product URL<input name="url" type="url" placeholder="https://..."/></label>
        <label>Package Quantity<input name="default_quantity" type="number" min="0.0001" step="any" defaultValue="1" required/></label>
        <label>Notes<input name="note"/></label>
        <label className="check"><input name="scraping_enabled" type="checkbox" defaultChecked/> Automatic Scraping (requires URL)</label>
        <button type="submit">Add Source</button>
      </form></section></div>

    <section className="panel"><h2>Sources and Manual Price Entries</h2>
      {sources.length ? <div className="source-list">{sources.map(s=><div className="source" key={text(s.id)}>
        <div><strong>{s.store}</strong><p className="small muted">{s.url ? <a href={text(s.url)} rel="noreferrer" target="_blank">Open Product Page</a> : "Manual Source"} · {s.scraping_enabled ? "Automatic Scraping" : "Manual"}</p>
          <p className="small muted">Latest: {money(s.last_price,item.currency as string)} · {time(s.price_at)}</p></div>
        <form action={addPriceAction} className="inline-form"><input type="hidden" name="item_id" value={id}/>
          <input type="hidden" name="source_id" value={text(s.id)}/>
          <input name="price" type="number" min="0" step="any" required placeholder="Price" aria-label="Price"/>
          <input name="quantity" type="number" min="0.0001" step="any" defaultValue={text(s.default_quantity)} required aria-label="Quantity"/>
          <button type="submit">Record Price</button></form>
        <form action={archiveSourceAction}><input type="hidden" name="item_id" value={id}/>
          <input type="hidden" name="source_id" value={text(s.id)}/><button className="small danger" type="submit">Archive Source</button></form>
      </div>)}</div> : <p className="muted">No sources yet. Add a source above before recording prices.</p>}</section>

    <section className="panel"><h2>Lowest Price History</h2>
      <PriceChart points={bestHistory} target={item.target_unit_price} currency={text(item.currency)}/></section>

    <section className="panel table-wrap"><h2>Recent Price History</h2><table><thead><tr><th>Time</th><th>Store</th><th>Price</th><th>Quantity</th><th>Unit Price</th><th>Method</th></tr></thead>
      <tbody>{history.map(p=><tr key={text(p.id)}><td>{time(p.recorded_at)}</td><td>{p.store}</td>
        <td>{money(p.price,item.currency as string)}</td><td>{p.quantity}</td><td>{money(p.unit_price,item.currency as string)}</td><td>{p.origin}</td></tr>)}</tbody></table>
      {!history.length && <p className="muted">No price history yet.</p>}</section></>;
}
