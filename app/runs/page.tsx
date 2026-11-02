// The old Private Runs tab, using the migrated scrape_runs/results SQLite tables.
import Link from "next/link";
import { recentRuns, resultsForRun } from "../../lib/queries";
import { money, text, time } from "../../lib/format";
export const dynamic="force-dynamic";
export default async function Runs({searchParams}:{searchParams:Promise<{id?:string}>}) {
  const {id}=await searchParams;
  const runs=recentRuns();
  const selected=id&&runs.some(r=>r.id===id)?id:undefined;
  const results=selected?resultsForRun(selected):[];
  const last=runs[0];
  const state=(value:unknown)=>value==="Success"?"good":value==="Failed"?"bad":"warn";
  return <><div className="heading"><div><h1>Scrape runs</h1>
    <p className="subheading">Recent crawler executions and their source-level results from SQLite.</p></div></div>
    <div className="metric-grid">{[
      ["Total runs",runs.length],["Latest success",last?.successful??0],["Latest failures",last?.failed??0],["Latest suspicious",last?.suspicious??0],
    ].map(([name,value])=><div className="metric" key={String(name)}><div className="label">{name}</div><div className="value">{value}</div></div>)}</div>
    <section className="panel table-wrap"><h2>Recent runs</h2><table><thead><tr><th>Started</th><th>Status</th><th>Successful</th><th>Failed</th><th>Suspicious</th><th>Details</th></tr></thead>
      <tbody>{runs.map(r=><tr key={text(r.id)}><td>{time(r.started_at)}</td>
        <td><span className={`status-pill ${state(r.status)}`}>{r.status}</span></td>
        <td>{r.successful}</td><td>{r.failed}</td><td>{r.suspicious}</td>
        <td><Link href={`/runs?id=${encodeURIComponent(text(r.id))}`}>View results →</Link></td></tr>)}</tbody></table>
      {!runs.length&&<div className="empty">No scrape runs recorded yet.</div>}</section>
    {selected&&<section className="panel table-wrap"><div className="heading"><h2>Run results</h2><Link href="/runs">Close</Link></div>
      <table><thead><tr><th>Item</th><th>Store</th><th>Status</th><th>Price</th><th>Reason</th></tr></thead>
      <tbody>{results.map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.store||"—"}</td>
        <td><span className={`status-pill ${state(r.result_status)}`}>{r.result_status}</span></td>
        <td>{money(r.scraped_price)}</td><td className="muted">{r.error||r.suspicious_reason||"—"}</td></tr>)}</tbody></table></section>}
  </>;
}
