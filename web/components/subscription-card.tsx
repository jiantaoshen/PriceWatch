"use client";

import { Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@pricewatch/ui/card";
import { formatUnitPrice } from "@pricewatch/shared/format";
import { apiFetch } from "@/lib/api";
import type { ItemListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SubscriptionCard({item, onRestored}: {
  item: ItemListItem;
  onRestored?: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const archived = Boolean(item.archivedAt);

  async function restore() {
    setBusy(true);

    try {
      const token = await getAccessToken();

      await apiFetch<void>(`/api/items/${item.id}/restore`, token.accessToken, {
        method: "POST",
      });

      onRestored?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("group relative h-full", archived && "border-dashed bg-muted")}>
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          archived ? "bg-muted-foreground" : "bg-border"
        )}
      />

      <CardHeader className="pb-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-6 tracking-tight">
          {item.name}
        </h3>

        {archived && (
          <span className="text-xs text-muted-foreground">
            Archived
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Monthly price
        </div>

        <div className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
          {formatUnitPrice(
            item.monthlyPrice,
            item.currency,
            item.unit
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/15 px-6 py-3">
        {archived ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void restore()}
          >
            <RotateCcw className="size-4" />
            {busy ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <span />
        )}

        <Link
          href={`/subscriptions/${item.id}/edit`}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
          })}
        >
          <Pencil className="size-4" />
          Edit
        </Link>
      </CardFooter>
    </Card>
  );
}