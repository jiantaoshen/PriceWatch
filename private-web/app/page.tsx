"use client";

import { Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  Metric,
  Page,
  StatusBadge,
  primaryButton,
} from "@/components/ui";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await apiFetch<DashboardData>("/api/private/dashboard"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load().catch(console.error);
    const timer = window.setInterval(() => load().catch(console.error), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function runNow() {
    setBusy(true);
    try {
      await apiFetch("/api/private/run", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Private dashboard"
      description="Local scraper control. Product data and accepted prices remain in Neon."
      action={
        <button className={primaryButton} onClick={runNow} disabled={busy || data?.coordinator.running}>
          {data?.coordinator.running ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
          {data?.coordinator.running ? "Running…" : "Run now"}
        </button>
      }
    >
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active items" value={data?.activeItems ?? "—"} />
        <Metric label="Automatic sources" value={data?.automaticSources ?? "—"} />
        <Metric label="Manual sources" value={data?.manualSources ?? "—"} />
        <Metric label="Pending reviews" value={data?.pendingReviews ?? "—"} />
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Latest run</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {data?.lastRun ? formatDateTime(data.lastRun.startedAt) : "No runs yet"}
            </p>
          </div>
          {data?.lastRun && <StatusBadge value={data.lastRun.status} />}
        </div>

        {data?.lastRun && (
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Mini label="Items" value={data.lastRun.totalItems} />
            <Mini label="Success" value={data.lastRun.successful} />
            <Mini label="Suspicious" value={data.lastRun.suspicious} />
            <Mini label="Failed" value={data.lastRun.failed} />
          </div>
        )}

        {data?.coordinator.lastError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {data.coordinator.lastError}
          </div>
        )}
      </Card>
    </Page>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
