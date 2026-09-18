"use client";

import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Pencil,
  RotateCcw,
  Store,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { ApiError, apiFetch } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelativeDifference,
  formatUnitPrice,
} from "@/lib/format";
import type {
  ItemDetail,
  PriceHistoryPoint,
  SourceOffer,
} from "@/lib/types";

export default function ProductDetailPage() {
  const params =
    useParams<{ id: string }>();

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

  async function load() {
  if (!account) {
    setItem(null);
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const token =
      await getAccessToken();

    const itemResult =
      await apiFetch<ItemDetail>(
        `/api/items/${params.id}`,
        token.accessToken
      );

    setItem(itemResult);

    const [
      historyResult,
      offersResult,
    ] = await Promise.allSettled([
      apiFetch<PriceHistoryPoint[]>(
        `/api/items/${params.id}/history`,
        token.accessToken
      ),

      apiFetch<SourceOffer[]>(
        `/api/items/${params.id}/offers`,
        token.accessToken
      ),
    ]);

    if (
      historyResult.status ===
      "fulfilled"
    ) {
      setHistory(
        historyResult.value
      );
    } else {
      console.error(
        "Could not load history:",
        historyResult.reason
      );

      setHistory([]);
    }

    if (
      offersResult.status ===
      "fulfilled"
    ) {
      setOffers(
        offersResult.value
      );
    } else {
      console.error(
        "Could not load offers:",
        offersResult.reason
      );

      setOffers([]);
    }
  } catch (err) {
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
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    if (ready) {
      load().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account, params.id]);

  const historicalLow =
    useMemo(
      () =>
        history.length
          ? Math.min(
              ...history.map(
                (x) => x.unitPrice
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
                (x) => x.unitPrice
              )
            )
          : null,
      [history]
    );

  async function runItemAction(
    path: string,
    method: "POST" | "DELETE"
  ) {
    setActionBusy(true);

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

      await load();
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
        ) : error ? (
          <EmptyMessage message={error} />
        ) : item ? (
          <div className="space-y-6">
            <Link
              href="/"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "-ml-2",
              })}
            >
              <ArrowLeft className="size-4" />
              Products
            </Link>

            <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {item.itemType}
                  </Badge>

                  <Badge variant="outline">
                    {item.updateMode}
                  </Badge>

                  {item.archivedAt && (
                    <Badge>
                      Archived
                    </Badge>
                  )}
                </div>

                <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight">
                  {item.name}
                </h1>

                <div className="mt-5">
                  <div className="text-sm text-muted-foreground">
                    Current unit price
                  </div>

                  <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                    {formatUnitPrice(
                      item.currentUnitPrice,
                      item.currency,
                      item.unit
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {item.currentStore && (
                      <span>
                        Best at{" "}
                        <span className="font-medium text-foreground">
                          {item.currentStore}
                        </span>
                      </span>
                    )}

                    {formatRelativeDifference(
                      item.currentUnitPrice,
                      item.targetUnitPrice,
                      item.currency
                    ) && (
                      <span>
                        {formatRelativeDifference(
                          item.currentUnitPrice,
                          item.targetUnitPrice,
                          item.currency
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/items/${item.id}/edit`}
                  className={buttonVariants({
                    variant: "outline",
                  })}
                >
                  <Pencil className="size-4" />
                  Edit
                </Link>

                {item.archivedAt ? (
                  <Button
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() =>
                      runItemAction(
                        `/api/items/${item.id}/restore`,
                        "POST"
                      )
                    }
                  >
                    <RotateCcw className="size-4" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() =>
                      runItemAction(
                        `/api/items/${item.id}/archive`,
                        "POST"
                      )
                    }
                  >
                    <Archive className="size-4" />
                    Archive
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        disabled={actionBusy}
                      />
                    }
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Permanently delete this product?
                      </AlertDialogTitle>

                      <AlertDialogDescription>
                        This permanently deletes the
                        item, sources, price history,
                        alerts, and item-specific review
                        records. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        Cancel
                      </AlertDialogCancel>

                      <AlertDialogAction
                        onClick={() =>
                          runItemAction(
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
                value={item.currentUnitPrice}
                item={item}
              />

              <PriceMetric
                label="Target"
                value={item.targetUnitPrice}
                item={item}
              />

              <PriceMetric
                label="Previous"
                value={item.previousUnitPrice}
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
                <div className="flex flex-col gap-1">
                  <CardTitle>
                    Unit price history
                  </CardTitle>

                  <p className="text-sm text-muted-foreground">
                    Accepted normalized price changes only.
                  </p>
                </div>
              </CardHeader>

              <CardContent>
                <PriceHistoryChart
                  history={history}
                  targetUnitPrice={
                    item.targetUnitPrice
                  }
                  currency={item.currency}
                  unit={item.unit}
                />
              </CardContent>
            </Card>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Offers
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {offers.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No sources configured.
                    </div>
                  ) : (
                    offers.map((offer) => (
                      <div
                        key={offer.sourceId}
                        className="rounded-xl border p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">
                                {offer.store}
                              </h3>

                              <Badge
                                variant={
                                  offer.isCurrent
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {offer.isCurrent
                                  ? "Current best"
                                  : offer.origin ??
                                    (offer.scrapingEnabled
                                      ? "Automatic"
                                      : "Manual")}
                              </Badge>
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {offer.scrapingEnabled
                                ? "Automatic source"
                                : "Manual source"}
                              {offer.observedAt
                                ? ` · ${formatDateTime(
                                    offer.observedAt
                                  )}`
                                : ""}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className="text-xl font-semibold tabular-nums">
                              {formatUnitPrice(
                                offer.unitPrice,
                                item.currency,
                                item.unit
                              )}
                            </div>

                            {offer.price !== null &&
                              offer.quantity !==
                                null && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formatMoney(
                                    offer.price,
                                    item.currency
                                  )}{" "}
                                  / {offer.quantity}
                                </div>
                              )}
                          </div>
                        </div>

                        {(offer.note ||
                          offer.url) && (
                          <>
                            <Separator className="my-3" />

                            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                              <span>
                                {offer.note ??
                                  "No note"}
                              </span>

                              {offer.url && (
                                <a
                                  href={offer.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  })}
                                >
                                  Open offer
                                  <ExternalLink className="size-4" />
                                </a>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Last purchase
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums">
                      {formatMoney(
                        item.lastPurchasePrice,
                        item.currency
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(
                        item.lastPurchaseDate
                      )}
                    </p>
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
                      label="Mode"
                      value={item.updateMode}
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
                      label="Last price change"
                      value={formatDateTime(
                        item.lastPriceChangedAt
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
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
      <Store className="size-4" />
      <AlertTitle>
        PriceWatch
      </AlertTitle>
      <AlertDescription>
        {message}
      </AlertDescription>
    </Alert>
  );
}
