"use client";

import { ArrowDownRight, ArrowUpRight, CircleDollarSign } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@pricewatch/ui/card";
import { formatDate, formatRelativeDifference, formatUnitPrice } from "@pricewatch/shared/format";
import type { ItemListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({
  item,
  onRestore,
  restoring = false,
}: {
  item: ItemListItem;
  onRestore?: (id: string) => Promise<void> | void;
  restoring?: boolean;
}) {
  const archived = Boolean(item.archivedAt);
  const belowTarget =
    item.currentUnitPrice !== null &&
    item.targetUnitPrice !== null &&
    item.currentUnitPrice <= item.targetUnitPrice;
  const targetDifference = formatRelativeDifference(
    item.currentUnitPrice,
    item.targetUnitPrice,
    item.currency
  );
  const previousDifference =
    item.currentUnitPrice !== null && item.previousUnitPrice !== null
      ? item.currentUnitPrice - item.previousUnitPrice
      : null;
  const previousPercent =
    previousDifference !== null && item.previousUnitPrice !== null && item.previousUnitPrice !== 0
      ? (previousDifference / item.previousUnitPrice) * 100
      : null;

  return (
    <Card className={cn("group relative h-full", archived && "bg-muted")}>
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          archived ? "bg-muted-foreground" : belowTarget ? "bg-success" : "bg-border"
        )}
      />

      <CardHeader className="space-y-3 pb-4 pt-6">
        <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 tracking-tight">
          {item.name}
        </h3>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{item.sourceCount} {item.sourceCount === 1 ? "store" : "stores"}</span>
          <span>{archived ? "Archived" : `Scraping ${item.hasScrapingSources ? "ON" : "OFF"}`}</span>
          {!item.trackingEnabled && !archived && <span>Tracking OFF</span>}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Last known unit price
          </div>

          {item.currentUnitPrice !== null ? (
            <div className="mt-1.5">
              <div
                className={cn(
                  "text-3xl font-semibold tracking-tight tabular-nums",
                  archived ? "text-muted-foreground" : belowTarget ? "text-success" : ""
                )}
              >
                {formatUnitPrice(item.currentUnitPrice, item.currency, item.unit)}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {item.currentStores.length > 0 && (
                  <span>
                    {archived ? "Last best at" : "Best at"}{" "}
                    <span className="font-medium text-foreground">{item.currentStores.join(", ")}</span>
                  </span>
                )}
                {!archived && targetDifference && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{targetDifference}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="text-xl font-semibold tracking-tight text-muted-foreground">
                No accepted price yet
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Waiting for a price.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background/70 p-3">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="mt-1.5 font-medium tabular-nums">
              {formatUnitPrice(item.targetUnitPrice, item.currency, item.unit)}
            </div>
          </div>

          <div className="rounded-xl border bg-background/70 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {previousDifference !== null && previousDifference < 0 ? (
                <ArrowDownRight className="size-3.5" />
              ) : previousDifference !== null && previousDifference > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <CircleDollarSign className="size-3.5" />
              )}
              Previous
            </div>
            <div className="mt-1.5 font-medium tabular-nums">
              {formatUnitPrice(item.previousUnitPrice, item.currency, item.unit)}
            </div>
            {previousPercent !== null && (
              <div
                className={cn(
                  "mt-1 text-xs font-medium tabular-nums",
                  previousPercent < 0
                    ? "text-success"
                    : previousPercent > 0
                      ? "text-warning"
                      : "text-muted-foreground"
                )}
              >
                {previousPercent > 0 ? "+" : ""}
                {previousPercent.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>{archived ? "Archived" : "Last checked"}</span>
            <span>{formatDate(archived ? item.archivedAt : item.lastCheckedAt)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3">
        {archived && onRestore ? (
          <Button type="button" variant="outline" size="sm" disabled={restoring} onClick={() => onRestore(item.id)}>
            {restoring ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <div />
        )}

        <Link href={`/items/${item.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          View details
        </Link>
      </CardFooter>
    </Card>
  );
}
