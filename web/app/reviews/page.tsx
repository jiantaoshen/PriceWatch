"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePage } from "@/components/workspace-page";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Badge } from "@pricewatch/ui/badge";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { Label } from "@pricewatch/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime, formatUnitPrice } from "@pricewatch/shared/format";
import type { PendingReview } from "@/lib/types";

async function fetchReviewsData(accessToken: string) {
  return apiFetch<PendingReview[]>("/api/reviews/pending", accessToken);
}

export default function ReviewsPage() {
  const { ready, account, getAccessToken } = useAuth();
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!ready || !account) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getAccessToken()
      .then((token) => fetchReviewsData(token.accessToken))
      .then((value) => { if (!cancelled) setReviews(value); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) setError("No data available.");
        else setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [ready, account, getAccessToken]);

  async function postAction(reviewId: number, action: "confirm" | "use-last" | "manual", body?: unknown) {
    setBusyId(reviewId);
    setError(null);

    try {
      const token = await getAccessToken();
      await apiFetch<void>(`/api/reviews/${reviewId}/${action}`, token.accessToken, {
        method: "POST",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      setReviews(await fetchReviewsData(token.accessToken));
      window.dispatchEvent(new Event("pricewatch:reviews-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspacePage title="Reviews" description="Resolve sources where PriceWatch could not determine a trustworthy new price.">
      <div className="max-w-5xl">
        {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="mt-6 space-y-4">
          {!ready || loading ? (
            <LoadingReviews />
          ) : !account ? (
            <EmptyState title="Sign in to view reviews" description="Use the Login button in the top-right corner." />
          ) : reviews.length === 0 ? (
            <EmptyState title="Nothing needs review" description="Failed or suspicious price checks will appear here." />
          ) : reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              busy={busyId === review.id}
              onConfirm={() => postAction(review.id, "confirm")}
              onUseLast={(note) => postAction(review.id, "use-last", { note })}
              onManual={(payload) => postAction(review.id, "manual", payload)}
            />
          ))}
        </div>
      </div>
    </WorkspacePage>
  );
}

function ReviewCard({
  review,
  busy,
  onConfirm,
  onUseLast,
  onManual,
}: {
  review: PendingReview;
  busy: boolean;
  onConfirm: () => Promise<void> | void;
  onUseLast: (note: string | null) => Promise<void> | void;
  onManual: (payload: { price: number; quantity: number; note: string | null }) => Promise<void> | void;
}) {
  const [panel, setPanel] = useState<"last" | "manual" | null>(null);
  const [note, setNote] = useState("");
  const [manualPrice, setManualPrice] = useState(review.scrapedPrice?.toString() ?? "");
  const [manualQuantity, setManualQuantity] = useState(
    (review.scrapedQuantity ?? review.defaultQuantity).toString()
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  function submitManual() {
    const price = Number(manualPrice);
    const quantity = Number(manualQuantity);

    if (!Number.isFinite(price) || price < 0) {
      setValidationError("Manual price must be zero or greater.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setValidationError("Quantity must be greater than zero.");
      return;
    }

    setValidationError(null);
    void onManual({ price, quantity, note: note.trim() || null });
  }

  const isSuspicious = review.resultStatus === "Suspicious";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{review.resultStatus}</Badge>
              <Badge variant="secondary">{review.store}</Badge>
            </div>
            <CardTitle className="mt-3 text-lg">{review.itemName}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Observed {formatDateTime(review.observedAt)}</p>
          </div>
          <Link href={`/items/${review.itemId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Product</Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReviewMetric label="Scraped" value={formatUnitPrice(review.scrapedUnitPrice, review.currency, review.unit)} />
          <ReviewMetric label="Last known" value={formatUnitPrice(review.lastKnownUnitPrice, review.currency, review.unit)} />
          <ReviewMetric label="Product current" value={formatUnitPrice(review.currentUnitPrice, review.currency, review.unit)} />
        </div>

        <div className="rounded-lg border border-dashed p-3 text-sm">
          <div className="font-medium">Why this needs review</div>
          <div className="mt-1 text-muted-foreground">
            {review.suspiciousReason ?? review.error ?? "PriceWatch could not determine a trustworthy new price."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isSuspicious && (
            <Button disabled={busy} onClick={() => void onConfirm()}>Confirm scraped price</Button>
          )}
          {review.hasLastKnownPrice && (
            <Button variant="outline" disabled={busy} onClick={() => setPanel(panel === "last" ? null : "last")}>Use last known price</Button>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setPanel(panel === "manual" ? null : "manual")}>Enter manual price</Button>
        </div>

        {panel === "last" && review.hasLastKnownPrice && (
          <div className="rounded-lg border bg-muted/15 p-4">
            <Label>Note (optional)</Label>
            <Textarea className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button className="mt-3" disabled={busy} onClick={() => void onUseLast(note.trim() || null)}>Keep last known price</Button>
          </div>
        )}

        {panel === "manual" && (
          <div className="rounded-lg border bg-muted/15 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" min="0" step="0.01" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="0.000001" step="any" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Note (optional)</Label>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
            </div>
            {validationError && <p className="mt-3 text-sm text-destructive">{validationError}</p>}
            <Button className="mt-3" disabled={busy} onClick={submitManual}>Save manual observation</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-medium tabular-nums">{value}</div></div>;
}

function LoadingReviews() {
  return <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">Loading reviews…</div>;
}
