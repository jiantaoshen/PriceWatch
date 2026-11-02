// Scheduler tab: preserve Classic UI and show live Windows task controls.
import { SchedulerControl } from "../../components/scheduler-control";

export default function Schedule() {
  return <>
    <div className="heading"><div><h1>Schedule</h1>
      <p className="subheading">Manage local scraper runs without opening another site.</p>
    </div></div>
    <SchedulerControl />
    <section className="panel"><h2>Independent crawler</h2>
      <p>The Windows task starts <code>scraper/run_once.py</code> using the project's SQLite file.</p>
      <p className="muted small">The scheduled task keeps working while this website is closed. The task runs under your Windows user, so that user must be signed in with the default setup.</p>
      <p className="muted small">To install or change the daily time, use <code>scripts/install-scheduler.ps1</code>. For detailed prices and failed stores, visit Scrape runs.</p>
    </section>
  </>;
}
