"use client";

import {
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  RotateCcw,
  Target,
} from "lucide-react";
import Link from "next/link";
import {
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Button,
  buttonVariants,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatRelativeDifference,
  formatUnitPrice,
} from "@/lib/format";
import type { ItemListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SubscriptionCard({
  item,
  onRestored,
}: {
  item: ItemListItem;
  onRestored?: () => void;
}) {
  const {
    getAccessToken,
  } = useAuth();

  const [busy, setBusy] =
    useState(false);

  const hasCurrent =
    item.currentUnitPrice !== null;

  const hasTarget =
    item.targetUnitPrice !== null;

  const targetDifference =
    formatRelativeDifference(
      item.currentUnitPrice,
      item.targetUnitPrice,
      item.currency
    );

  const previousDifference =
    item.currentUnitPrice !== null &&
    item.previousUnitPrice !== null
      ? item.currentUnitPrice -
        item.previousUnitPrice
      : null;

  async function restore() {
    setBusy(true);

    try {
      const token =
        await getAccessToken();

      await apiFetch<void>(
        `/api/items/${item.id}/restore`,
        token.accessToken,
        {
          method: "POST",
        }
      );

      onRestored?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md",
        item.archivedAt &&
          "border-dashed bg-muted/20"
      )}
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 tracking-tight">
              {item.name}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="size-3.5" />

                {item.currentStore
                  ? item.currentStore
                  : `${item.sourceCount} ${
                      item.sourceCount === 1
                        ? "provider"
                        : "providers"
                    }`}
              </span>

              <span>
                {item.updateMode}
              </span>

              {!item.trackingEnabled &&
                !item.archivedAt && (
                  <span>
                    Tracking off
                  </span>
                )}
            </div>
          </div>

          {item.archivedAt ? (
            <Badge variant="secondary">
              <Archive className="mr-1 size-3" />
              Archived
            </Badge>
          ) : item.belowTarget ? (
            <Badge>
              Below target
            </Badge>
          ) : hasTarget &&
            hasCurrent ? (
            <Badge variant="outline">
              Above target
            </Badge>
          ) : (
            <Badge variant="secondary">
              No price
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.archivedAt
              ? "Last known price"
              : "Current price"}
          </div>

          {hasCurrent ? (
            <div className="mt-1.5">
              <div className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatUnitPrice(
                  item.currentUnitPrice,
                  item.currency,
                  item.unit
                )}
              </div>

              {item.currentStore && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Provider{" "}
                  <span className="font-medium text-foreground">
                    {item.currentStore}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="text-xl font-semibold tracking-tight text-muted-foreground">
                No accepted price yet
              </div>

              <div className="mt-2 text-sm text-muted-foreground">
                Add a manual price or wait for a valid automatic update.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="size-3.5" />
              Target
            </div>

            <div className="mt-1.5 font-medium tabular-nums">
              {formatUnitPrice(
                item.targetUnitPrice,
                item.currency,
                item.unit
              )}
            </div>

            {targetDifference && (
              <div className="mt-1 text-xs text-muted-foreground">
                {targetDifference}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {previousDifference !== null &&
              previousDifference < 0 ? (
                <ArrowDownRight className="size-3.5" />
              ) : previousDifference !== null &&
                previousDifference > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <CreditCard className="size-3.5" />
              )}

              Previous
            </div>

            <div className="mt-1.5 font-medium tabular-nums">
              {formatUnitPrice(
                item.previousUnitPrice,
                item.currency,
                item.unit
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {previousDifference === null
                ? "No previous price"
                : previousDifference === 0
                  ? "No change"
                  : `${previousDifference < 0 ? "↓" : "↑"} ${formatMoney(
                      Math.abs(
                        previousDifference
                      ),
                      item.currency
                    )}`}
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Last payment
            </span>

            <span className="text-right tabular-nums">
              {item.lastPurchasePrice !== null
                ? `${formatMoney(
                    item.lastPurchasePrice,
                    item.currency
                  )}${
                    item.lastPurchaseDate
                      ? ` · ${formatDate(
                          item.lastPurchaseDate
                        )}`
                      : ""
                  }`
                : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>
              {item.archivedAt
                ? "Archived"
                : "Last checked"}
            </span>

            <span>
              {formatDate(
                item.archivedAt ??
                  item.lastCheckedAt
              )}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/15 px-6 py-3">
        {item.archivedAt ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              restore().catch(
                console.error
              );
            }}
          >
            <RotateCcw className="size-4" />
            {busy
              ? "Restoring…"
              : "Restore"}
          </Button>
        ) : (
          <span />
        )}

        <Link
          href={`/items/${item.id}`}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
          })}
        >
          View details
          <ArrowRight className="size-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
