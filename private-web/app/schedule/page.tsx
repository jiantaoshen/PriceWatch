"use client";

import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ScheduleStatus } from "@/lib/types";
import { Card, Page, primaryButton, outlineButton } from "@/components/ui";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [day, setDay] = useState("Monday");
  const [time, setTime] = useState("08:00");
  const [runIfMissed, setRunIfMissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const result = await apiFetch<ScheduleStatus>("/api/private/schedule");
    setSchedule(result);
    setDay(result.day);
    setTime(result.time);
    setRunIfMissed(result.runIfMissed);
  }

  useEffect(() => { load().catch((e) => setMessage(String(e))); }, []);

  async function save() {
    setBusy(true);
    try {
      const result = await apiFetch<ScheduleStatus>("/api/private/schedule", {
        method: "PUT",
        body: JSON.stringify({ enabled: true, day, time, runIfMissed }),
      });
      setSchedule(result);
      setMessage("Schedule saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch<void>("/api/private/schedule", { method: "DELETE" });
      await load();
      setMessage("Schedule removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Schedule" description="Windows Task Scheduler launches PriceWatch.Private with --run-once.">
      <Card className="max-w-2xl p-5">
        <div className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
          Task: {schedule?.taskExists ? "installed" : "not installed"}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            <span>Day</span>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3">
              {days.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3" />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={runIfMissed} onChange={(e) => setRunIfMissed(e.target.checked)} className="size-4" />
          Run when Windows becomes available if the scheduled time was missed
        </label>

        {message && <div className="mt-4 text-sm text-zinc-600">{message}</div>}

        <div className="mt-6 flex gap-2">
          <button className={primaryButton} onClick={save} disabled={busy}>
            <Save className="size-4" /> Save schedule
          </button>
          <button className={outlineButton} onClick={remove} disabled={busy || !schedule?.taskExists}>
            <Trash2 className="size-4" /> Remove
          </button>
        </div>
      </Card>
    </Page>
  );
}
