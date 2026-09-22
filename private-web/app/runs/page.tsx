"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Button } from "@pricewatch/ui/button";
import { Card, CardContent } from "@pricewatch/ui/card";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@pricewatch/shared/format";
import type { RunResult, RunSummary } from "@/lib/types";

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns() {
    try {
      setRuns(await apiFetch<RunSummary[]>("/api/private/runs?limit=30"));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadRuns().catch(console.error);
  }, []);

  async function openRun(id: string) {
    setSelected(id);
    try {
      setResults(await apiFetch<RunResult[]>(`/api/private/runs/${id}/results`));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Page title="Runs" description="Scrape run history stored in Neon.">
      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {runs.map((run) => (
          <Card key={run.id} className="gap-0 py-0">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={run.status} />
                  <span className="text-sm font-medium">{formatDateTime(run.startedAt)}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {run.totalItems} items · {run.successful} success · {run.suspicious} suspicious · {run.failed} failed
                </div>
              </div>
              <Button variant="outline" onClick={() => openRun(run.id)}>
                {selected === run.id ? "Refresh results" : "View results"}
              </Button>
            </CardContent>

            {selected === run.id && (
              <div className="border-t p-4">
                {results.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No source results for this run.</div>
                ) : (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div key={result.id} className="rounded-lg bg-muted p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{result.itemName} · {result.store ?? "Unknown source"}</div>
                          <div className="flex items-center gap-2">
                            <StatusBadge value={result.resultStatus} />
                            <StatusBadge value={result.reviewStatus} />
                          </div>
                        </div>
                        <div className="mt-2 text-foreground/75">
                          Unit price: {result.scrapedUnitPrice ?? "—"}
                        </div>
                        {(result.suspiciousReason || result.error) && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {result.suspiciousReason ?? result.error}
                          </div>
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
