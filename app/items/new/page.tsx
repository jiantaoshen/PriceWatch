// Product/Subscription creation reuses the local item form and old styling.
import Link from "next/link";
import { saveItemAction } from "../../actions";
export default async function NewItem({searchParams}:{searchParams:Promise<{type?:string}>}) {
  const type=(await searchParams).type==="Subscription"?"Subscription":"Product";
  return <><div className="heading"><div><h1>Add {type.toLowerCase()}</h1>
    <p className="subheading">New items are stored directly in local SQLite.</p></div></div>
  <section className="panel" style={{maxWidth:720}}><form className="form" action={saveItemAction}>
    <label>Name<input name="name" maxLength={500} required/></label>
    <div className="grid two"><label>Type<select name="item_type" defaultValue={type}><option>Product</option><option>Subscription</option></select></label>
      <label>Currency<input name="currency" defaultValue="SEK" maxLength={3} required/></label></div>
    <div className="grid two"><label>Comparison quantity<input name="comparison_quantity" type="number" min="0.0001" step="any" defaultValue="1" required/></label>
      <label>Unit<input name="unit" placeholder="kg / L / item"/></label></div>
    <label>Target price<input name="target_price" type="number" min="0" step="any"/></label>
    <label className="check"><input name="tracking_enabled" type="checkbox" defaultChecked/> Enable tracking</label>
    <div className="card-actions"><button type="submit">Save item</button><Link className="button secondary" href="/">Cancel</Link></div>
  </form></section></>;
}
