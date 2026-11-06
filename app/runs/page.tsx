import Link from "next/link";
import { PageHeading } from "../../components/page-heading";
import { money, text, time } from "../../lib/format";
import { recentRuns, resultsForRun } from "../../lib/queries";
import { cx, ui } from "../../lib/ui";

export const dynamic = "force-dynamic";

type RunsProps = {
  searchParams: Promise<{ id?: string }>;
};

function statusClass(value: unknown): string {
  if (value === "Success") return ui.tagGood;
  if (value === "Failed") return ui.tagBad;
  return ui.tagWarn;
}

export default async function Runs({ searchParams }: RunsProps) {
  const { id } = await searchParams;
  const runs = recentRuns();
  const selectedId = id && runs.some((run) => run.id === id) ? id : undefined;
  const results = selectedId ? resultsForRun(selectedId) : [];
  const latest = runs[0];

  const metrics = [
    { label: "Total runs", value: runs.length },
    { label: "Latest success", value: latest?.successful ?? 0 },
    { label: "Latest failures", value: latest?.failed ?? 0 },
    { label: "Latest suspicious", value: latest?.suspicious ?? 0 },
  ];

  return (
    <>
      <PageHeading
        title="Scrape runs"
        description="Recent crawler executions and their source-level results from SQLite."
      />

      <div className={ui.metricGrid}>
        {metrics.map(({ label, value }) => (
          <div className={ui.metric} key={label}>
            <p className={ui.metricLabel}>{label}</p>
            <p className={ui.metricValue}>{value}</p>
          </div>
        ))}
      </div>

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>Recent runs</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Started</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>Successful</th>
                <th className={ui.th}>Failed</th>
                <th className={ui.th}>Suspicious</th>
                <th className={ui.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={text(run.id)}>
                  <td className={ui.td}>{time(run.started_at)}</td>
                  <td className={ui.td}>
                    <span className={cx(ui.tag, statusClass(run.status))}>
                      {run.status}
                    </span>
                  </td>
                  <td className={ui.td}>{run.successful}</td>
                  <td className={ui.td}>{run.failed}</td>
                  <td className={ui.td}>{run.suspicious}</td>
                  <td className={ui.td}>
                    <Link
                      href={`/runs?id=${encodeURIComponent(text(run.id))}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      View results →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {runs.length === 0 && (
          <div className={ui.empty}>No scrape runs recorded yet.</div>
        )}
      </section>

      {selectedId && (
        <section className={ui.panel}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Run results</h2>
            <Link className="text-brand hover:underline" href="/runs">
              Close
            </Link>
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Item</th>
                  <th className={ui.th}>Store</th>
                  <th className={ui.th}>Status</th>
                  <th className={ui.th}>Price</th>
                  <th className={ui.th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td className={ui.td}>{result.name}</td>
                    <td className={ui.td}>{result.store || "—"}</td>
                    <td className={ui.td}>
                      <span
                        className={cx(ui.tag, statusClass(result.result_status))}
                      >
                        {result.result_status}
                      </span>
                    </td>
                    <td className={ui.td}>{money(result.scraped_price)}</td>
                    <td className={cx(ui.td, "text-muted")}>
                      {result.error || result.suspicious_reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
