"use client";

import {
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Pause,
  RotateCcw,
  Store,
  Target,
} from "lucide-react";
import Link from "next/link";
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
import {
  formatDate,
  formatMoney,
  formatRelativeDifference,
  formatUnitPrice,
} from "@/lib/format";
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
  const hasCurrent = item.currentUnitPrice !== null;
  const hasTarget = item.targetUnitPrice !== null;

  const targetDifference =
    formatRelativeDifference(
      item.currentUnitPrice,
      item.targetUnitPrice,
      item.currency
    );

  const previousDifference =
    item.currentUnitPrice !== null &&
    item.previousUnitPrice !== null
      ? item.currentUnitPrice - item.previousUnitPrice
      : null;

  const previousPercent =
    previousDifference !== null &&
    item.previousUnitPrice !== null &&
    item.previousUnitPrice !== 0
      ? (previousDifference / item.previousUnitPrice) * 100
      : null;

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        archived &&
          "border-dashed bg-muted/15 hover:translate-y-0"
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          archived
            ? "bg-muted-foreground/20"
            : item.belowTarget
              ? "bg-success/75"
              : "bg-border"
        )}
      />

      <CardHeader className="space-y-3 pb-4 pt-6">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 tracking-tight">
              {item.name}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Store className="size-3.5" />
                {item.sourceCount}{" "}
                {item.sourceCount === 1
                  ? "store"
                  : "stores"}
              </span>

              <span>{item.updateMode}</span>

              {!item.trackingEnabled && !archived && (
                <span className="inline-flex items-center gap-1">
                  <Pause className="size-3" />
                  Tracking off
                </span>
              )}
            </div>
          </div>

          {archived ? (
            <Badge variant="secondary">
              <Archive className="mr-1 size-3" />
              Archived
            </Badge>
          ) : item.belowTarget ? (
            <Badge variant="success">
              Below target
            </Badge>
          ) : hasTarget && hasCurrent ? (
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
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {archived
              ? "Last known unit price"
              : "Current unit price"}
          </div>

          {hasCurrent ? (
            <div className="mt-1.5">
              <div
                className={cn(
                  "text-3xl font-semibold tracking-tight tabular-nums",
                  archived && "text-muted-foreground"
                )}
              >
                {formatUnitPrice(
                  item.currentUnitPrice,
                  item.currency,
                  item.unit
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {item.currentStore && (
                  <span>
                    {archived ? "Last best at" : "Best at"}{" "}
                    <span className="font-medium text-foreground">
                      {item.currentStore}
                    </span>
                  </span>
                )}

                {!archived && targetDifference && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {targetDifference}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="text-xl font-semibold tracking-tight text-muted-foreground">
                No accepted price yet
              </div>

              <div className="mt-2 text-sm text-muted-foreground">
                Waiting for a manual or scraped price.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background/70 p-3">
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
          </div>

          <div className="rounded-xl border bg-background/70 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {previousDifference !== null &&
              previousDifference < 0 ? (
                <ArrowDownRight className="size-3.5" />
              ) : previousDifference !== null &&
                previousDifference > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <CircleDollarSign className="size-3.5" />
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

        <div className="mt-auto space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Last purchase
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
              {archived ? "Archived" : "Last checked"}
            </span>

            <span>
              {formatDate(
                archived
                  ? item.archivedAt
                  : item.lastCheckedAt
              )}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3">
        {archived && onRestore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={restoring}
            onClick={() => onRestore(item.id)}
          >
            <RotateCcw className="size-4" />
            {restoring ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <div />
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
