"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@pricewatch/ui/badge";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { Label } from "@pricewatch/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiError, apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatMoney,
  formatRelativeDifference,
  formatUnitPrice,
} from "@pricewatch/shared/format";
import type {
  ItemDetail,
  PriceHistoryPoint,
  SourceOffer,
} from "@/lib/types";

async function fetchProductDetailData(
  id: string,
  accessToken: string
) {
  const item = await apiFetch<ItemDetail>(
    `/api/items/${id}`,
    accessToken
  );

  const [historyResult, offersResult] =
    await Promise.allSettled([
      apiFetch<PriceHistoryPoint[]>(
        `/api/items/${id}/history`,
        accessToken
      ),
      apiFetch<SourceOffer[]>(
        `/api/items/${id}/offers`,
        accessToken
      ),
    ]);

  return {
    item,
    history:
      historyResult.status === "fulfilled"
        ? historyResult.value
        : [],
    offers:
      offersResult.status === "fulfilled"
        ? offersResult.value
        : [],
  };
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [item, setItem] =
    useState<ItemDetail | null>(null);

  const [history, setHistory] =
    useState<PriceHistoryPoint[]>([]);

  const [offers, setOffers] =
    useState<SourceOffer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [actionBusy, setActionBusy] =
    useState(false);

  const [
    manualSourceId,
    setManualSourceId,
  ] = useState<number | null>(null);

  const [manualPrice, setManualPrice] =
    useState("");

  const [
    manualQuantity,
    setManualQuantity,
  ] = useState("1");

  async function reload() {
    const token =
      await getAccessToken();

    const result =
      await fetchProductDetailData(
        params.id,
        token.accessToken
      );

    setItem(result.item);
    setHistory(result.history);
    setOffers(result.offers);
  }

  useEffect(() => {
    if (!ready || !account) {
      return;
    }

    let cancelled = false;

    void getAccessToken()
      .then((token) => {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }

        return fetchProductDetailData(
          params.id,
          token.accessToken
        );
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setItem(result.item);
        setHistory(result.history);
        setOffers(result.offers);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        if (
          err instanceof ApiError &&
          err.status === 403
        ) {
          setError(
            "No data available."
          );
        } else if (
          err instanceof ApiError &&
          err.status === 404
        ) {
          setError(
            "Product not found."
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : String(err)
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    account,
    getAccessToken,
    params.id,
  ]);

  const historicalLow =
    useMemo(
      () =>
        history.length
          ? Math.min(
              ...history.map(
                (point) =>
                  point.unitPrice
              )
            )
          : null,
      [history]
    );

  const historicalHigh =
    useMemo(
      () =>
        history.length
          ? Math.max(
              ...history.map(
                (point) =>
                  point.unitPrice
              )
            )
          : null,
      [history]
    );

  const targetDifference =
    item
      ? formatRelativeDifference(
          item.currentUnitPrice,
          item.targetUnitPrice,
          item.currency
        )
      : null;

  const hasScrapingSources =
    item?.sources.some(
      (source) =>
        !source.archivedAt &&
        source.scrapingEnabled
    ) ?? false;

  async function runItemAction(
    path: string,
    method: "POST" | "DELETE"
  ) {
    setActionBusy(true);
    setError(null);

    try {
      const token =
        await getAccessToken();

      await apiFetch<void>(
        path,
        token.accessToken,
        { method }
      );

      if (method === "DELETE") {
        router.push("/");
        router.refresh();
        return;
      }

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function submitManual(
    offer: SourceOffer
  ) {
    const price =
      Number(manualPrice);

    const quantity =
      Number(manualQuantity);

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError(
        "Manual price must be zero or greater."
      );
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setError(
        "Quantity must be greater than zero."
      );
      return;
    }

    setActionBusy(true);
    setError(null);

    try {
      const token =
        await getAccessToken();

      await apiFetch<void>(
        `/api/items/${params.id}/sources/${offer.sourceId}/manual-price`,
        token.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            price,
            quantity,
          }),
        }
      );

      setManualSourceId(null);
      setManualPrice("");
      setManualQuantity("1");

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/15">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {!ready || loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            Loading product…
          </div>
        ) : !account ? (
          <EmptyMessage message="Sign in to view this product." />
        ) : error && !item ? (
          <EmptyMessage message={error} />
        ) : item ? (
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Link
                  href="/"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "-ml-2",
                  })}
                >
                  Products
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {item.name}
                  </h1>

                  {item.archivedAt && (
                    <Badge variant="secondary">
                      Archived
                    </Badge>
                  )}
                </div>

                <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">
                  {formatUnitPrice(
                    item.currentUnitPrice,
                    item.currency,
                    item.unit
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {item.currentStores.length >
                    0 && (
                    <span>
                      Best at{" "}
                      <span className="font-medium text-foreground">
                        {item.currentStores.join(
                          ", "
                        )}
                      </span>
                    </span>
                  )}

                  {targetDifference && (
                    <span>
                      {targetDifference}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/items/${item.id}/edit`}
                  className={buttonVariants({
                    variant: "outline",
                  })}
                >
                  Edit
                </Link>

                {item.archivedAt ? (
                  <Button
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() =>
                      void runItemAction(
                        `/api/items/${item.id}/restore`,
                        "POST"
                      )
                    }
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() =>
                      void runItemAction(
                        `/api/items/${item.id}/archive`,
                        "POST"
                      )
                    }
                  >
                    Archive
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        disabled={
                          actionBusy
                        }
                      />
                    }
                  >
                    Delete
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Permanently delete
                        this product?
                      </AlertDialogTitle>

                      <AlertDialogDescription>
                        This permanently
                        deletes the product,
                        sources, observations,
                        lowest-price history,
                        alerts, and reviews.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        Cancel
                      </AlertDialogCancel>

                      <AlertDialogAction
                        onClick={() =>
                          void runItemAction(
                            `/api/items/${item.id}`,
                            "DELETE"
                          )
                        }
                      >
                        Delete permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <PriceMetric
                label="Current"
                value={
                  item.currentUnitPrice
                }
                item={item}
              />

              <PriceMetric
                label="Target"
                value={
                  item.targetUnitPrice
                }
                item={item}
              />

              <PriceMetric
                label="Previous"
                value={
                  item.previousUnitPrice
                }
                item={item}
              />

              <PriceMetric
                label="Historical low"
                value={historicalLow}
                item={item}
              />

              <PriceMetric
                label="Historical high"
                value={historicalHigh}
                item={item}
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>
                  Lowest price history
                </CardTitle>

                <p className="text-sm text-muted-foreground">
                  Changes in the lowest
                  valid price or the store
                  set offering that price.
                </p>
              </CardHeader>

              <CardContent>
                <PriceHistoryChart
                  history={history}
                  targetUnitPrice={
                    item.targetUnitPrice
                  }
                  currency={
                    item.currency
                  }
                  unit={item.unit}
                />
              </CardContent>
            </Card>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Sources
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {offers.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No active sources
                      configured.
                    </div>
                  ) : (
                    offers.map(
                      (offer) => (
                        <div
                          key={
                            offer.sourceId
                          }
                          className="rounded-xl border p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-medium">
                                  {
                                    offer.store
                                  }
                                </h3>

                                {offer.isBest && (
                                  <Badge>
                                    Current
                                    best
                                  </Badge>
                                )}
                              </div>

                              <p className="mt-1 text-xs text-muted-foreground">
                                Scraping{" "}
                                {offer.scrapingEnabled
                                  ? "ON"
                                  : "OFF"}

                                {offer.origin
                                  ? ` · ${offer.origin}`
                                  : ""}

                                {offer.observedAt
                                  ? ` · ${formatDateTime(
                                      offer.observedAt
                                    )}`
                                  : ""}
                              </p>
                            </div>

                            <div className="sm:text-right">
                              <div className="text-xl font-semibold tabular-nums">
                                {formatUnitPrice(
                                  offer.unitPrice,
                                  item.currency,
                                  item.unit
                                )}
                              </div>

                              {offer.price !==
                                null &&
                                offer.quantity !==
                                  null && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {formatMoney(
                                      offer.price,
                                      item.currency
                                    )}{" "}
                                    /{" "}
                                    {
                                      offer.quantity
                                    }
                                  </div>
                                )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {offer.hasPendingReview ? (
                              <Link
                                href="/reviews"
                                className={buttonVariants(
                                  {
                                    variant:
                                      "outline",
                                    size: "sm",
                                  }
                                )}
                              >
                                Resolve pending
                                review
                              </Link>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setManualSourceId(
                                    (
                                      current
                                    ) =>
                                      current ===
                                      offer.sourceId
                                        ? null
                                        : offer.sourceId
                                  );

                                  setManualPrice(
                                    offer.price?.toString() ??
                                      ""
                                  );

                                  setManualQuantity(
                                    (
                                      offer.quantity ??
                                      offer.defaultQuantity
                                    ).toString()
                                  );
                                }}
                              >
                                Enter manual
                                price
                              </Button>
                            )}

                            {offer.url && (
                              <a
                                href={
                                  offer.url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className={buttonVariants(
                                  {
                                    variant:
                                      "ghost",
                                    size: "sm",
                                  }
                                )}
                              >
                                Open store
                              </a>
                            )}
                          </div>

                          {!offer.hasPendingReview &&
                            manualSourceId ===
                              offer.sourceId && (
                              <div className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>
                                    Price
                                  </Label>

                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                      manualPrice
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setManualPrice(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>
                                    Quantity
                                  </Label>

                                  <Input
                                    type="number"
                                    min="0.000001"
                                    step="any"
                                    value={
                                      manualQuantity
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setManualQuantity(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <Button
                                    disabled={
                                      actionBusy
                                    }
                                    onClick={() =>
                                      void submitManual(
                                        offer
                                      )
                                    }
                                  >
                                    Save manual
                                    observation
                                  </Button>
                                </div>
                              </div>
                            )}

                          {offer.note && (
                            <>
                              <Separator className="my-3" />

                              <p className="text-sm text-muted-foreground">
                                {
                                  offer.note
                                }
                              </p>
                            </>
                          )}
                        </div>
                      )
                    )
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Tracking
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  <InfoRow
                    label="Scraping"
                    value={
                      hasScrapingSources
                        ? "ON"
                        : "OFF"
                    }
                  />

                  <InfoRow
                    label="Tracking"
                    value={
                      item.trackingEnabled
                        ? "Enabled"
                        : "Disabled"
                    }
                  />

                  <InfoRow
                    label="Last checked"
                    value={formatDateTime(
                      item.lastCheckedAt
                    )}
                  />

                  <InfoRow
                    label="Last successful price"
                    value={formatDateTime(
                      item.lastSuccessfulPriceAt
                    )}
                  />

                  <InfoRow
                    label="Last price change"
                    value={formatDateTime(
                      item.lastPriceChangedAt
                    )}
                  />
                </CardContent>
              </Card>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function PriceMetric({
  label,
  value,
  item,
}: {
  label: string;
  value: number | null;
  item: ItemDetail;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>

        <div className="mt-2 text-lg font-semibold tabular-nums">
          {formatUnitPrice(
            value,
            item.currency,
            item.unit
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span className="text-right font-medium">
        {value}
      </span>
    </div>
  );
}

function EmptyMessage({
  message,
}: {
  message: string;
}) {
  return (
    <Alert>
      <AlertDescription>
        {message}
      </AlertDescription>
    </Alert>
  );
}