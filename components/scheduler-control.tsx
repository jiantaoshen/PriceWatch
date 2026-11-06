"use client";
// Install, configure and operate the app-owned Windows Task Scheduler job in the browser.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type TaskStatus = {
  installed: boolean;
  managed: boolean;
  mismatchReason?: string | null;
  state?: string;
  nextRun?: string | null;
  lastRun?: string | null;
  lastResult?: number | null;
  frequency?: "daily" | "weekly" | null;
  at?: string | null;
  days?: string[];
};

type Operation = "save" | "run" | "stop" | "enable" | "disable" | "remove";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const shortDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function readableTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "Never";
  return date.toLocaleString();
}

export function SchedulerControl() {
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [message, setMessage] = useState("");
  const [at, setAt] = useState("09:00");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Monday"]);
  const initialised = useRef(false);
  // A polling GET that started before a mutation must not overwrite its result.
  const operationRevision = useRef(0);

  const refresh = useCallback(async (syncSchedule = false) => {
    const revision = operationRevision.current;
    setRefreshing(true);
    try {
      const response = await fetch("/api/scheduler", { cache: "no-store" });
      const result: TaskStatus & { error?: string } = await response.json();
      if (revision !== operationRevision.current) return;
      if (!response.ok) throw new Error(result.error || "Task status unavailable");
      setTask(result);
      if (!initialised.current || syncSchedule) {
        if (result.at) setAt(result.at);
        if (result.frequency === "weekly" || result.frequency === "daily") setFrequency(result.frequency);
        if (result.days?.length) setSelectedDays(result.days);
        initialised.current = true;
      }
      setStatusError("");
    } catch (cause) {
      if (revision === operationRevision.current) {
        setStatusError(cause instanceof Error ? cause.message : "Task status unavailable");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function operate(operation: Operation) {
    if (busy) return;
    if (operation === "remove" && !window.confirm("Delete the PriceWatch scheduled task? The SQLite data and scrape history will stay intact.")) return;
    if (operation === "stop" && !window.confirm("Stop the currently running scraper? The current scrape might be incomplete.")) return;
    if (operation === "save" && (frequency === "weekly" && selectedDays.length === 0)) {
      setError("Please select at least one day for a weekly schedule.");
      return;
    }
    operationRevision.current += 1;
    setBusy(operation);
    setMessage("");
    setError("");
    try {
      const body = operation === "save"
        ? { operation, at, frequency, days: frequency === "weekly" ? selectedDays : [] }
        : { operation };
      const response = await fetch("/api/scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", cache: "no-store", body: JSON.stringify(body),
      });
      const result: TaskStatus & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Scheduler operation failed");
      if (operation === "save" && (!result.installed || !result.managed)) {
        throw new Error(`Windows registered the task, but its ownership check failed: ${result.mismatchReason || "Unknown mismatch"}`);
      }
      setTask(result);
      setStatusError("");
      if (operation === "save") {
        // The status response is authoritative; the next timer refresh won't overwrite edits.
        if (result.at) setAt(result.at);
        if (result.frequency === "weekly" || result.frequency === "daily") setFrequency(result.frequency);
        if (result.days?.length) setSelectedDays(result.days);
      }
      setMessage({
        save: "Schedule saved in Windows Task Scheduler.",
        run: "Run requested. Check Scrape runs for the actual result.",
        stop: "Stop requested.",
        enable: "Automatic runs enabled.",
        disable: "Automatic runs disabled.",
        remove: "Scheduled task deleted. Your data was not deleted.",
      }[operation]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scheduler operation failed");
    } finally {
      operationRevision.current += 1;
      setBusy(null);
      void refresh();
    }
  }

  const installed = task?.installed ?? false;
  const managed = installed && task?.managed;
  const running = task?.state === "Running";
  const disabled = task?.state === "Disabled";
  const locked = !!busy || loading;
  const weekdays = new Set(selectedDays);

  return <>
    <section className="panel">
      <div className="heading"><div><h2>Windows Task Scheduler</h2>
        <p className="subheading">Manage the PriceWatch scheduled task here. The scraper works even when this website is closed.</p>
      </div><button type="button" className="button secondary" disabled={locked || refreshing} onClick={() => void refresh()}>
        {refreshing ? "Refreshing…" : "Refresh"}</button></div>
      <div className="metric-grid">
        <div className="metric"><div className="label">Task status</div>
          <div className="value" style={{ fontSize: 18 }}>{loading ? "Checking…" : !installed ? "Not installed" : task?.state || "Unknown"}</div></div>
        <div className="metric"><div className="label">Next automatic run</div>
          <div className="value" style={{ fontSize: 16 }}>{readableTime(task?.nextRun)}</div></div>
        <div className="metric"><div className="label">Previous launch</div>
          <div className="value" style={{ fontSize: 16 }}>{readableTime(task?.lastRun)}</div></div>
        <div className="metric"><div className="label">Last task exit code</div>
          <div className="value" style={{ fontSize: 18 }}>{installed ? task?.lastResult ?? "—" : "—"}</div></div>
      </div>
      {installed && !managed && <p className="notice error" role="alert" style={{ marginTop: 16 }}>
        This Windows task does not match the PriceWatch configuration. For safety it cannot be modified from this page.
        {task?.mismatchReason && <> Reason: {task.mismatchReason}</>}
      </p>}
      <div className="card-actions scheduler-actions">
        <button type="button" disabled={!managed || disabled || running || locked} onClick={() => void operate("run")}>
          {busy === "run" ? "Starting…" : running ? "Scraping…" : "Run now"}
        </button>
        <button type="button" className="button secondary" disabled={!managed || !running || locked}
          onClick={() => void operate("stop")}>Stop current run</button>
        {installed && <button type="button" className="button secondary" disabled={!managed || locked}
          onClick={() => void operate(disabled ? "enable" : "disable")}>
          {disabled ? "Enable schedule" : "Disable schedule"}</button>}
        <Link className="button secondary" href="/runs">View scrape history</Link>
      </div>
      {message && (!installed || managed) && <p className="notice success-note" role="status" style={{ marginTop: 16 }}>{message}</p>}
      {(error || statusError) && <p className="notice error" role="alert" style={{ marginTop: 16 }}>{error || statusError}</p>}
      <p className="muted small" style={{ marginTop: 16 }}>
        Running or stopping a task sends a request to Windows; check Scrape runs for scraper results. Status refreshes every five seconds.
      </p>
    </section>

    <section className="panel">
      <h2>{installed ? "Edit automatic schedule" : "Create automatic schedule"}</h2>
      <p className="subheading" style={{ marginBottom: 18 }}>
        Runs as your current Windows user while signed in. Save will register or update only this app&apos;s task, without a command prompt.
      </p>
      <form className="form compact" onSubmit={event => { event.preventDefault(); void operate("save"); }}>
        <div className="grid two">
          <label>Repeat
            <select value={frequency} disabled={!managed && installed || locked}
              onChange={event => setFrequency(event.target.value as "daily" | "weekly")}>
              <option value="daily">Every day</option>
              <option value="weekly">Selected weekdays</option>
            </select>
          </label>
          <label>Run at (Windows local time)
            <input type="time" value={at} required disabled={!managed && installed || locked}
              onChange={event => setAt(event.target.value)} />
          </label>
        </div>
        {frequency === "weekly" && <fieldset className="scheduler-weekdays" disabled={!managed && installed || locked}>
          <legend>Days of the week</legend>
          <div className="scheduler-day-grid">{days.map((day, index) => <label className="check" key={day}>
            <input type="checkbox" checked={weekdays.has(day)} onChange={event => {
              const checked = event.currentTarget.checked;
              setSelectedDays(current => checked ? [...current, day]
                : current.filter(value => value !== day));
            }} /> {shortDay[index]}
          </label>)}</div>
        </fieldset>}
        <div className="card-actions scheduler-actions">
          <button type="submit" disabled={!managed && installed || locked || (frequency === "weekly" && selectedDays.length === 0)}>
            {busy === "save" ? "Saving…" : installed ? "Save schedule" : "Install schedule"}
          </button>
          {installed && <button type="button" className="danger" disabled={!managed || locked}
            onClick={() => void operate("remove")}>Delete scheduled task</button>}
        </div>
      </form>
      <p className="muted small" style={{ marginTop: 18 }}>
        Requires Windows, Python with Playwright installed, and an existing SQLite database. If permissions block registration, launch the website under the Windows account that should own the task.
      </p>
    </section>
  </>;
}
