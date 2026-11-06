import { SchedulerControl } from "../../components/scheduler-control";

export default function Schedule() {
  return <>
    <div className="heading"><div><h1>Schedule</h1>
      <p className="subheading">Install and manage Windows Task Scheduler from the website. No manual PowerShell commands required.</p>
    </div></div>
    <SchedulerControl />
    <section className="panel"><h2>Independent crawler</h2>
      <p>The Windows task launches <code>scraper/run_once.py</code> using the same SQLite database as the website.</p>
      <p className="muted small">The site may be closed while scraping runs. With the default task settings, your Windows user must be signed in. Windows controls task timing and missed runs.</p>
    </section>
  </>;
}
