// The old Private Email tab, now backed by SQLite settings and alert history.
import { emailOverview } from "../../lib/email-settings";
import { money, text, time } from "../../lib/format";
import { saveSettingsAction, testEmailAction } from "./actions";
export const dynamic="force-dynamic";
export default async function Email({searchParams}:{searchParams:Promise<{message?:string}>}) {
  const {message}=await searchParams;
  const {settings:s,events}=emailOverview();
  return <><div className="heading"><div><h1>Email alerts</h1>
    <p className="subheading">Configure local SMTP delivery for automatic below-target price alerts.</p></div></div>
    {message&&<div className={`notice ${message==="error"?"error":"success-note"}`}>
      {message==="saved"?"Settings saved to local SQLite.":message==="sent"?"Test email sent.":"Test email failed. See the Next.js terminal for details."}</div>}
    <div className="grid two"><section className="panel"><h2>Price alert email</h2>
      <p className="muted small">When a new accepted scraped best price falls at or below the target, the independent crawler sends one message per best-price state.</p>
      <form className="form" action={saveSettingsAction}>
        <label className="check"><input type="checkbox" name="enabled" defaultChecked={Boolean(s?.enabled)}/> Enable automatic price alert emails</label>
        <label>SMTP host<input name="smtp_host" defaultValue={text(s?.smtp_host)} placeholder="smtp.example.com"/></label>
        <div className="grid two"><label>Port<input type="number" name="smtp_port" min="1" max="65535" defaultValue={text(s?.smtp_port||587)}/></label>
          <label className="check"><input type="checkbox" name="use_tls" defaultChecked={Boolean(s?.use_tls)}/> TLS / STARTTLS</label></div>
        <label>Username<input name="username" defaultValue={text(s?.username)} autoComplete="username"/></label>
        <label>App password <span className="muted small">{s?.password_configured?"Password configured; leave blank to keep it":"Not configured"}</span>
          <input name="password" type="password" autoComplete="new-password" placeholder="Leave blank to retain existing password"/></label>
        <label className="check"><input type="checkbox" name="clear_password"/> Clear saved password</label>
        <label>From address<input type="email" name="from_address" defaultValue={text(s?.from_address)} placeholder="alerts@example.com"/></label>
        <label>To address<input name="to_address" defaultValue={text(s?.to_address)} placeholder="me@example.com"/></label>
        <button type="submit">Save settings</button>
      </form><hr style={{border:0,borderTop:"1px solid var(--border)",margin:"20px 0"}}/>
      <form action={testEmailAction}><button className="button secondary" type="submit">Send test email</button></form>
      <p className="small muted" style={{marginTop:14}}>SMTP password is encrypted with Windows DPAPI and bound to your Windows account. Keep old database backups private; the website and scheduled scraper must run as the same Windows user.</p>
    </section><section className="panel"><h2>Recent price alert events</h2><div className="table-wrap"><table>
      <thead><tr><th>Item</th><th>Price / target</th><th>Status</th><th>When</th></tr></thead>
      <tbody>{events.map(e=><tr key={text(e.id)}><td>{e.name||"—"}</td>
        <td>{money(e.unit_price)} / {money(e.target_unit_price)}</td>
        <td><span className={`tag ${e.status==="Sent"?"good":e.status==="Failed"?"bad":""}`}>{e.status}</span>
          {e.error&&<p className="small muted">{e.error}</p>}</td><td>{time(e.sent_at||e.created_at)}</td></tr>)}</tbody></table></div>
      {!events.length&&<div className="empty">No alert events yet.</div>}
    </section></div></>;
}
