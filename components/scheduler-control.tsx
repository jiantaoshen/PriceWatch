"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx, ui } from "../lib/ui";

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
type TaskResponse = TaskStatus & { error?: string };

const weekdays = [
  { name: "Monday", short: "Mon" },
  { name: "Tuesday", short: "Tue" },
  { name: "Wednesday", short: "Wed" },
  { name: "Thursday", short: "Thu" },
  { name: "Friday", short: "Fri" },
  { name: "Saturday", short: "Sat" },
  { name: "Sunday", short: "Sun" },
];

const successMessages: Record<Operation, string> = {
  save: "Schedule saved in Windows Task Scheduler.",
  run: "Run requested. Check Scrape runs for the actual result.",
  stop: "Stop requested.",
  enable: "Automatic runs enabled.",
  disable: "Automatic runs disabled.",
  remove: "Scheduled task deleted. Your data was not deleted.",
};

function readableTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
    return "Never";
  }

  return date.toLocaleString();
}

function TaskMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={ui.metric}>
      <p className={ui.metricLabel}>{label}</p>
      <p className="mt-2 text-base font-semibold text-ink break-words">{value}</p>
    </div>
  );
}

/**
 * Browser controls for the single app-owned Windows scheduled task.
 *
 * Display data comes from /api/scheduler. The PowerShell backend and its
 * ownership checks are intentionally unchanged by the Tailwind refactor.
 */
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
  // A GET started before a mutation must never overwrite that mutation's result.
  const operationRevision = useRef(0);

  const refresh = useCallback(async (syncSchedule = false) => {
    const revision = operationRevision.current;
    setRefreshing(true);

    try {
      const response = await fetch("/api/scheduler", { cache: "no-store" });
      const result: TaskResponse = await response.json();

      if (revision !== operationRevision.current) return;
      if (!response.ok) {
        throw new Error(result.error || "Task status unavailable");
      }

      setTask(result);

      // Do not erase unsaved form edits during the periodic refresh.
      if (!initialised.current || syncSchedule) {
        if (result.at) setAt(result.at);
        if (result.frequency === "daily" || result.frequency === "weekly") {
          setFrequency(result.frequency);
        }
        if (result.days?.length) setSelectedDays(result.days);
        initialised.current = true;
      }

      setStatusError("");
    } catch (cause) {
      if (revision === operationRevision.current) {
        setStatusError(
          cause instanceof Error ? cause.message : "Task status unavailable",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Status polling changes only the webpage; it does not change task timing.
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function operate(operation: Operation) {
    if (busy) return;

    if (
      operation === "remove" &&
      !window.confirm(
        "Delete the PriceWatch scheduled task? The SQLite data and scrape history will stay intact.",
      )
    ) {
      return;
    }

    if (
      operation === "stop" &&
      !window.confirm(
        "Stop the currently running scraper? The current scrape might be incomplete.",
      )
    ) {
      return;
    }

    if (operation === "save" && frequency === "weekly" && selectedDays.length === 0) {
      setError("Please select at least one day for a weekly schedule.");
      return;
    }

    operationRevision.current += 1;
    setBusy(operation);
    setMessage("");
    setError("");

    try {
      const body =
        operation === "save"
          ? {
              operation,
              at,
              frequency,
              days: frequency === "weekly" ? selectedDays : [],
            }
          : { operation };

      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const result: TaskResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Scheduler operation failed");
      }
      if (operation === "save" && (!result.installed || !result.managed)) {
        throw new Error(
          `Windows registered the task, but its ownership check failed: ${result.mismatchReason || "Unknown mismatch"}`,
        );
      }

      setTask(result);
      setStatusError("");

      if (operation === "save") {
        if (result.at) setAt(result.at);
        if (result.frequency === "daily" || result.frequency === "weekly") {
          setFrequency(result.frequency);
        }
        if (result.days?.length) setSelectedDays(result.days);
      }

      setMessage(successMessages[operation]);
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
  const locked = Boolean(busy) || loading;
  const scheduleLocked = (installed && !managed) || locked;
  const chosenDays = new Set(selectedDays);

  return (
    <>
      <section className={ui.panel}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={ui.sectionTitle}>Windows Task Scheduler</h2>
            <p className={ui.subtitle}>
              Manage the PriceWatch scheduled task here. The scraper works even
              when this website is closed.
            </p>
          </div>
          <button
            type="button"
            className={ui.secondaryButton}
            disabled={locked || refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className={ui.metricGrid}>
          <TaskMetric
            label="Task status"
            value={
              loading
                ? "Checking…"
                : !installed
                  ? "Not installed"
                  : task?.state || "Unknown"
            }
          />
          <TaskMetric label="Next automatic run" value={readableTime(task?.nextRun)} />
          <TaskMetric label="Previous launch" value={readableTime(task?.lastRun)} />
          <TaskMetric
            label="Last task exit code"
            value={installed ? (task?.lastResult ?? "—") : "—"}
          />
        </div>

        {installed && !managed && (
          <p className={cx(ui.note, ui.errorNote, "mt-4")} role="alert">
            This Windows task does not match the PriceWatch configuration. For
            safety it cannot be modified from this page.
            {task?.mismatchReason && <> Reason: {task.mismatchReason}</>}
          </p>
        )}

        <div className={cx(ui.buttonRow, "mt-4")}>
          <button
            type="button"
            className={ui.button}
            disabled={!managed || disabled || running || locked}
            onClick={() => void operate("run")}
          >
            {busy === "run" ? "Starting…" : running ? "Scraping…" : "Run now"}
          </button>
          <button
            type="button"
            className={ui.secondaryButton}
            disabled={!managed || !running || locked}
            onClick={() => void operate("stop")}
          >
            Stop current run
          </button>
          {installed && (
            <button
              type="button"
              className={ui.secondaryButton}
              disabled={!managed || locked}
              onClick={() => void operate(disabled ? "enable" : "disable")}
            >
              {disabled ? "Enable schedule" : "Disable schedule"}
            </button>
          )}
          <Link className={ui.secondaryButton} href="/runs">
            View scrape history
          </Link>
        </div>

        {message && (!installed || managed) && (
          <p className={cx(ui.note, ui.successNote, "mt-4")} role="status">
            {message}
          </p>
        )}
        {(error || statusError) && (
          <p className={cx(ui.note, ui.errorNote, "mt-4")} role="alert">
            {error || statusError}
          </p>
        )}

        <p className={cx(ui.small, "mt-4")}>
          Running or stopping a task sends a request to Windows; check Scrape
          runs for scraper results. Status refreshes every five seconds.
        </p>
      </section>

      <section className={ui.panel}>
        <h2 className={ui.sectionTitle}>
          {installed ? "Edit automatic schedule" : "Create automatic schedule"}
        </h2>
        <p className={cx(ui.subtitle, "mb-5")}>
          Runs as your current Windows user while signed in. Save will register
          or update only this app&apos;s task, without a command prompt.
        </p>

        <form
          className={ui.compactForm}
          onSubmit={(event) => {
            event.preventDefault();
            void operate("save");
          }}
        >
          <div className={ui.twoColumns}>
            <label className={ui.label}>
              Repeat
              <select
                className={ui.field}
                value={frequency}
                disabled={scheduleLocked}
                onChange={(event) =>
                  setFrequency(event.target.value as "daily" | "weekly")
                }
              >
                <option value="daily">Every day</option>
                <option value="weekly">Selected weekdays</option>
              </select>
            </label>

            <label className={ui.label}>
              Run at (Windows local time)
              <input
                className={ui.field}
                type="time"
                value={at}
                required
                disabled={scheduleLocked}
                onChange={(event) => setAt(event.target.value)}
              />
            </label>
          </div>

          {frequency === "weekly" && (
            <fieldset
              className="rounded-lg border border-line p-3.5"
              disabled={scheduleLocked}
            >
              <legend className="px-2 text-[13px] font-semibold">
                Days of the week
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                {weekdays.map(({ name, short }) => (
                  <label className={ui.checkboxLabel} key={name}>
                    <input
                      className={ui.checkbox}
                      type="checkbox"
                      checked={chosenDays.has(name)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelectedDays((current) =>
                          checked
                            ? [...current, name]
                            : current.filter((value) => value !== name),
                        );
                      }}
                    />
                    {short}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className={cx(ui.buttonRow, "mt-3")}>
            <button
              type="submit"
              className={ui.button}
              disabled={
                scheduleLocked ||
                (frequency === "weekly" && selectedDays.length === 0)
              }
            >
              {busy === "save"
                ? "Saving…"
                : installed
                  ? "Save schedule"
                  : "Install schedule"}
            </button>
            {installed && (
              <button
                type="button"
                className={ui.dangerButton}
                disabled={!managed || locked}
                onClick={() => void operate("remove")}
              >
                Delete scheduled task
              </button>
            )}
          </div>
        </form>

        <p className={cx(ui.small, "mt-5")}>
          Requires Windows, Python with Playwright installed, and an existing
          SQLite database. If permissions block registration, launch the
          website under the Windows account that should own the task.
        </p>
      </section>
    </>
  );
}
