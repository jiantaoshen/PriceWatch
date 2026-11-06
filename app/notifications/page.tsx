// Reuse the original price-alert history; replace SMTP settings with a test button.
import { recentAlerts } from "../../lib/alerts";
import { money, text, time } from "../../lib/format";
import { testNotificationAction } from "./actions";
export const dynamic = "force-dynamic";

export default async function Notifications({searchParams}: {searchParams: Promise<{message?: string}>}) {
  const {message} = await searchParams;
  const events = recentAlerts();
  return <><div className="heading"><div><h1>Windows notifications</h1>
    <p className="subheading">Automatic local alerts when a newly accepted scraped best price is at or below its target. Each best-price state is alerted at most once.</p>
  </div></div>
  {message && <div className={`notice ${message === "sent" ? "success-note" : "error"}`}>
    {message === "sent" ? "Notification submitted to Windows. Visibility depends on Windows notification settings." :
      "Windows notification failed. Check the Next.js terminal and that you are signed into the Windows desktop."}
  </div>}
  <section className="panel"><h2>Desktop notification</h2>
    <p className="muted small">No email account or SMTP server is needed. Windows Scheduler still runs the scraper; notifications are displayed in your signed-in Windows session. Do Not Disturb may hide them.</p>
    <form action={testNotificationAction}><button className="button secondary" type="submit">Send test notification</button></form>
  </section>
  <section className="panel table-wrap"><h2>Recent price alerts</h2><table>
    <thead><tr><th>Item</th><th>Price / target</th><th>Status</th><th>When</th></tr></thead>
    <tbody>{events.map(e => <tr key={text(e.id)}><td>{e.name || "—"}</td>
      <td>{money(e.unit_price)} / {money(e.target_unit_price)} {text(e.currency)}</td>
      <td><span className={`tag ${e.status === "Sent" ? "good" : e.status === "Failed" ? "bad" : ""}`}>
        {e.status === "Sent" ? "Notified" : text(e.status)}</span>
        {e.error && <p className="small muted">{e.error}</p>}</td>
      <td>{time(e.sent_at || e.created_at)}</td></tr>)}</tbody></table>
    {!events.length && <div className="empty">No price alerts yet.</div>}
    <p className="small muted">Older “Sent” entries may refer to emails from previous versions. New entries mean the notification was submitted to Windows, not necessarily seen.</p>
  </section></>;
}
