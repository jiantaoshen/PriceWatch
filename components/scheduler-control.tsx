"use client";
// Live status and Run now button for the Windows scheduler task.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type TaskStatus = {
  installed: boolean;
  state?: string;
  nextRun?: string;
  lastRun?: string;
  lastResult?: number;
};

function readableTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "Never";
  return date.toLocaleString();
}

export function SchedulerControl() {
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/scheduler", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status unavailable");
      setTask(result as TaskStatus);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function runNow() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/scheduler", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start task");
      setMessage("Run requested. Check Scrape runs for the actual results.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start task");
    } finally {
      setBusy(false);
    }
  }

  const running = task?.state === "Running";
  const active = task?.installed && task.state !== "Disabled";
  return <section className="panel">
    <div className="heading"><div><h2>Windows Task Scheduler</h2>
      <p className="subheading">Scheduled and manual runs use the same Python scraper and SQLite file.</p>
    </div><button type="button" className="button secondary" onClick={() => void refresh()}>Refresh</button></div>
    <div className="metric-grid">
      <div className="metric"><div className="label">Task status</div>
        <div className="value" style={{ fontSize: 18 }}>{loading ? "Checking…" : !task?.installed ? "Not installed" : task.state}</div></div>
      <div className="metric"><div className="label">Next automatic run</div>
        <div className="value" style={{ fontSize: 16 }}>{readableTime(task?.nextRun)}</div></div>
      <div className="metric"><div className="label">Previous launch</div>
        <div className="value" style={{ fontSize: 16 }}>{readableTime(task?.lastRun)}</div></div>
      <div className="metric"><div className="label">Last task exit code</div>
        <div className="value" style={{ fontSize: 18 }}>{task?.installed ? task.lastResult ?? "—" : "—"}</div></div>
    </div>
    <div className="card-actions">
      <button type="button" disabled={!active || busy || running} onClick={() => void runNow()}>
        {busy ? "Starting…" : running ? "Scraping…" : "Run now"}
      </button>
      <Link className="button secondary" href="/runs">View scrape history</Link>
    </div>
    {message && <p className="notice success-note" role="status" style={{ marginTop: 16 }}>{message}</p>}
    {error && <p className="notice error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
    {!loading && !task?.installed && !error && <p className="muted small" style={{ marginTop: 16 }}>
      Install the task once from PowerShell with <code>scripts/install-scheduler.ps1</code>.
    </p>}
    <p className="muted small" style={{ marginTop: 16 }}>
      Run now only requests a launch; it does not mean scraping succeeded. Status refreshes every five seconds.
    </p>
  </section>;
}
