"use client";

import {
  Check,
  CircleAlert,
  ExternalLink,
  PencilLine,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { WorkspacePage } from "@/components/workspace-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Button,
  buttonVariants,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatUnitPrice,
} from "@/lib/format";
import type { PendingReview } from "@/lib/types";

export default function ReviewsPage() {
  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [reviews, setReviews] =
    useState<PendingReview[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [busyId, setBusyId] =
    useState<number | null>(null);

  async function load() {
    if (!account) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const result =
        await apiFetch<PendingReview[]>(
          "/api/reviews/pending",
          token.accessToken
        );

      setReviews(result);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403
      ) {
        setError("No data available.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : String(err)
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function postAction(
    reviewId: number,
    action: "accept" | "reject" | "manual",
    body?: unknown
  ) {
    setBusyId(reviewId);
    setError(null);

    try {
      const token = await getAccessToken();

      await apiFetch<void>(
        `/api/reviews/${reviewId}/${action}`,
        token.accessToken,
        {
          method: "POST",
          ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
        }
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (ready) {
      load().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  return (
    <WorkspacePage
      title="Reviews"
      description="Review suspicious scrape results before they change an accepted item price."
      headerAction={
        <Badge
          variant={
            reviews.length > 0
              ? "default"
              : "secondary"
          }
          className="w-fit"
        >
          {reviews.length}{" "}
          {reviews.length === 1
            ? "pending review"
            : "pending reviews"}
        </Badge>
      }
    >
      <div className="max-w-5xl">
        {error && (
          <Alert
            variant="destructive"
            className="mt-6"
          >
            <CircleAlert className="size-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-4">
          {!ready || loading ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              Loading reviews…
            </div>
          ) : !account ? (
            <EmptyReviews
              title="Sign in to view reviews"
              description="Use the Login button in the top-right corner."
            />
          ) : reviews.length === 0 ? (
            <EmptyReviews
              title="Nothing needs review"
              description="Suspicious scrape results will appear here."
            />
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                busy={busyId === review.id}
                onAccept={() =>
                  postAction(
                    review.id,
                    "accept"
                  )
                }
                onReject={(note) =>
                  postAction(
                    review.id,
                    "reject",
                    { note }
                  )
                }
                onManual={(payload) =>
                  postAction(
                    review.id,
                    "manual",
                    payload
                  )
                }
              />
            ))
          )}
        </div>
      </div>
    </WorkspacePage>
  );
}

function ReviewCard({
  review,
  busy,
  onAccept,
  onReject,
  onManual,
}: {
  review: PendingReview;
  busy: boolean;
  onAccept: () => Promise<void> | void;
  onReject: (
    note: string | null
  ) => Promise<void> | void;
  onManual: (payload: {
    price: number;
    quantity: number;
    note: string | null;
  }) => Promise<void> | void;
}) {
  const [panel, setPanel] =
    useState<"reject" | "manual" | null>(null);

  const [note, setNote] =
    useState("");

  const [manualPrice, setManualPrice] =
    useState(
      review.scrapedPrice?.toString() ?? ""
    );

  const [manualQuantity, setManualQuantity] =
    useState(
      review.scrapedQuantity?.toString() ?? "1"
    );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const currency =
    review.currency ?? "SEK";

  const unit = review.unit ?? null;

  const currentDifference =
    review.scrapedUnitPrice !== null &&
    review.currentUnitPrice !== null &&
    review.currentUnitPrice !== 0
      ? ((review.scrapedUnitPrice -
          review.currentUnitPrice) /
          review.currentUnitPrice) *
        100
      : null;

  function submitManual() {
    const price = Number(manualPrice);
    const quantity = Number(manualQuantity);

    if (!Number.isFinite(price) || price < 0) {
      setValidationError(
        "Manual price must be zero or greater."
      );
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setValidationError(
        "Quantity must be greater than zero."
      );
      return;
    }

    setValidationError(null);

    onManual({
      price,
      quantity,
      note: note.trim() || null,
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {review.resultStatus}
              </Badge>

              {review.store && (
                <Badge variant="secondary">
                  {review.store}
                </Badge>
              )}
            </div>

            <CardTitle className="mt-3 text-lg leading-6">
              {review.itemName}
            </CardTitle>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(review.createdAt)}
            </p>
          </div>

          <Link
            href={`/items/${review.itemId}`}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
            })}
          >
            Product
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Scraped unit price
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatUnitPrice(
                review.scrapedUnitPrice,
                currency,
                unit
              )}
            </div>

            {currentDifference !== null && (
              <div
                className={
                  currentDifference < 0
                    ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                    : "text-sm font-medium text-amber-700 dark:text-amber-400"
                }
              >
                {currentDifference > 0 ? "+" : ""}
                {currentDifference.toFixed(1)}% vs current
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ReviewMetric
            label="Current accepted"
            value={formatUnitPrice(
              review.currentUnitPrice,
              currency,
              unit
            )}
          />

          <ReviewMetric
            label="Target"
            value={formatUnitPrice(
              review.targetUnitPrice,
              currency,
              unit
            )}
          />
        </div>

        {(review.suspiciousReason || review.error) && (
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <div className="font-medium">
              Why this needs review
            </div>

            <div className="mt-1 text-muted-foreground">
              {review.suspiciousReason ?? review.error}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => onAccept()}
          >
            <Check className="size-4" />
            Accept scraped price
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setValidationError(null);
              setPanel(
                panel === "manual"
                  ? null
                  : "manual"
              );
            }}
          >
            <PencilLine className="size-4" />
            Manual override
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setValidationError(null);
              setPanel(
                panel === "reject"
                  ? null
                  : "reject"
              );
            }}
          >
            <X className="size-4" />
            Reject
          </Button>
        </div>

        {panel === "manual" && (
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="font-medium">
              Manual override
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Use the correct package price and quantity for
              this single reviewed result.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPrice}
                  onChange={(event) =>
                    setManualPrice(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={manualQuantity}
                  onChange={(event) =>
                    setManualQuantity(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Note</Label>
                <Textarea
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder="Optional review note"
                />
              </div>
            </div>

            {validationError && (
              <p className="mt-3 text-sm text-destructive">
                {validationError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={submitManual}
              >
                Save override
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setPanel(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {panel === "reject" && (
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="font-medium">
              Reject result
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Rejecting keeps the current accepted product
              price unchanged.
            </p>

            <div className="mt-4 space-y-2">
              <Label>Note</Label>
              <Textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="Optional reason"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  onReject(
                    note.trim() || null
                  )
                }
              >
                Reject result
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setPanel(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EmptyReviews({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Check className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 text-base font-semibold">
        {title}
      </h2>

      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
