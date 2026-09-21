"use client";

import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { apiFetch, getErrorMessage } from "@/lib/api";
import type { ScheduleStatus } from "@/lib/types";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Message = {
  text: string;
  variant: "success" | "destructive";
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [day, setDay] = useState("Monday");
  const [time, setTime] = useState("08:00");
  const [runIfMissed, setRunIfMissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function load() {
    const result = await apiFetch<ScheduleStatus>("/api/private/schedule");
    setSchedule(result);
    setDay(result.day);
    setTime(result.time);
    setRunIfMissed(result.runIfMissed);
  }

  useEffect(() => {
    load().catch((error) => setMessage({ text: getErrorMessage(error), variant: "destructive" }));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const result = await apiFetch<ScheduleStatus>("/api/private/schedule", {
        method: "PUT",
        body: JSON.stringify({ enabled: true, day, time, runIfMissed }),
      });
      setSchedule(result);
      setMessage({ text: "Schedule saved.", variant: "success" });
    } catch (err) {
      setMessage({ text: getErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch<void>("/api/private/schedule", { method: "DELETE" });
      await load();
      setMessage({ text: "Schedule removed.", variant: "success" });
    } catch (err) {
      setMessage({ text: getErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Schedule" description="Windows Task Scheduler launches PriceWatch.Private with --run-once.">
      <Card className="max-w-2xl gap-0 py-0">
        <CardContent className="p-5">
          <Alert className="mb-5">
            <AlertDescription>
              Task: {schedule?.taskExists ? "installed" : "not installed"}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-day">Day</Label>
              <NativeSelect id="schedule-day" value={day} onChange={(event) => setDay(event.target.value)}>
                {days.map((value) => <option key={value}>{value}</option>)}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input id="schedule-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Checkbox
              id="run-if-missed"
              checked={runIfMissed}
              onCheckedChange={(checked) => setRunIfMissed(checked === true)}
            />
            <Label htmlFor="run-if-missed" className="font-normal">
              Run when Windows becomes available if the scheduled time was missed
            </Label>
          </div>

          {message && (
            <Alert variant={message.variant} className="mt-4">
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 flex gap-2">
            <Button onClick={save} disabled={busy}>
              <Save />
              Save schedule
            </Button>
            <Button variant="outline" onClick={remove} disabled={busy || !schedule?.taskExists}>
              <Trash2 />
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
