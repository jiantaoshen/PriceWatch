import { PageHeading } from "../../components/page-heading";
import { SchedulerControl } from "../../components/scheduler-control";
import { ui } from "../../lib/ui";

export default function Schedule() {
  return (
    <>
      <PageHeading
        title="Schedule"
        description="Install and manage Windows Task Scheduler from the website. No manual PowerShell commands required."
      />

      <SchedulerControl />

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Independent crawler</h2>
        <p className="mb-2 text-sm leading-6">
          The Windows task launches{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
            scraper/run_once.py
          </code>{" "}
          using the same SQLite database as the website.
        </p>
        <p className={ui.small}>
          The site may be closed while scraping runs. With the default task
          settings, your Windows user must be signed in. Windows controls task
          timing and missed runs.
        </p>
      </section>
    </>
  );
}
