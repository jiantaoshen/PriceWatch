// Reviews tab revives the original pending-price review workflow.
import { pendingReviews } from "../../lib/reviews";
import { money, text, time } from "../../lib/format";
import { reviewAction } from "./actions";
export const dynamic="force-dynamic";
export default function Reviews() {
  const reviews=pendingReviews();
  return <><div className="heading"><div><h1>Reviews</h1>
    <p className="subheading">Suspicious price changes require manual approval before they affect the lowest price.</p></div></div>
    <div className="metric-grid"><div className="metric"><span className="label">Pending reviews</span>
      <div className="value">{reviews.length}</div></div></div>
    <section className="panel table-wrap"><h2>Pending price reviews</h2><table><thead><tr>
      <th>Item / store</th><th>Observed</th><th>Proposed price</th><th>Reason</th><th>Decision</th></tr></thead>
      <tbody>{reviews.map(r=><tr key={text(r.id)}><td><strong>{r.name}</strong><p className="small muted">{r.store}</p></td>
        <td>{time(r.observed_at)}</td><td>{money(r.scraped_price,text(r.currency))}</td>
        <td>{r.suspicious_reason||"Large price change"}</td>
        <td><form className="inline-form" action={reviewAction}><input type="hidden" name="id" value={text(r.id)}/>
          <button type="submit" name="decision" value="approve">Approve</button>
          <button type="submit" name="decision" value="reject" className="danger">Reject</button></form></td></tr>)}</tbody></table>
      {!reviews.length&&<div className="empty">No pending price reviews.</div>}</section></>;
}
