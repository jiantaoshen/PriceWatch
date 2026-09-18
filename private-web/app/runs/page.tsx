"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { RunResult, RunSummary } from "@/lib/types";
import { formatDateTime, formatUnitPrice } from "@/lib/format";
import { Card, Page, StatusBadge, outlineButton } from "@/components/ui";

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns() {
    try {
      setRuns(await apiFetch<RunSummary[]>("/api/private/runs?limit=30"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { loadRuns().catch(console.error); }, []);

  async function openRun(id: string) {
    setSelected(id);
    setResults(await apiFetch<RunResult[]>(`/api/private/runs/${id}/results`));
  }

  return (
    <Page title="Runs" description="Scrape run history stored in Neon.">
      {error && <div className="mb-5 text-sm text-red-600">{error}</div>}

      <div className="space-y-3">
        {runs.map((run) => (
          <Card key={run.id}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={run.status} />
                  <span className="text-sm font-medium">{formatDateTime(run.startedAt)}</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {run.totalItems} items · {run.successful} success · {run.suspicious} suspicious · {run.failed} failed
                </div>
              </div>
              <button className={outlineButton} onClick={() => openRun(run.id)}>
                {selected === run.id ? "Refresh results" : "View results"}
              </button>
            </div>

            {selected === run.id && (
              <div className="border-t border-zinc-200 p-4">
                {results.length === 0 ? (
                  <div className="text-sm text-zinc-500">No source results for this run.</div>
                ) : (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div key={result.id} className="rounded-lg bg-zinc-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{result.itemName} · {result.store ?? "Unknown source"}</div>
                          <div className="flex items-center gap-2">
                            <StatusBadge value={result.resultStatus} />
                            <StatusBadge value={result.reviewStatus} />
                          </div>
                        </div>
                        <div className="mt-2 text-zinc-600">
                          Unit price: {result.scrapedUnitPrice ?? "—"}
                        </div>
                        {(result.suspiciousReason || result.error) && (
                          <div className="mt-2 text-xs text-zinc-500">{result.suspiciousReason ?? result.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Page>
  );
}
