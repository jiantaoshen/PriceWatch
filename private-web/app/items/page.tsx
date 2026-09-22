"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Card, CardContent } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { formatDateTime, formatUnitPrice } from "@pricewatch/shared/format";
import type { PrivateItem } from "@/lib/types";

export default function ItemsPage() {
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PrivateItem[]>("/api/private/items?includeArchived=true")
      .then(setItems)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? items.filter((item) =>
          item.name.toLowerCase().includes(query) ||
          item.currentStore?.toLowerCase().includes(query),
        )
      : items;
  }, [items, search]);

  return (
    <Page title="Items" description="Read-only Neon view used by the local scraper.">
      <div className="relative mb-5 max-w-xl">
        <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search items or stores…"
          className="pl-9"
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <Card key={item.id} className={item.archivedAt ? "gap-0 border-dashed bg-muted/40 py-0" : "gap-0 py-0"}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="line-clamp-2 font-semibold">{item.name}</h2>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.itemType} · {item.updateMode} · {item.sourceCount} sources
                  </div>
                </div>
                <StatusBadge value={item.archivedAt ? "Archived" : item.belowTarget ? "Below target" : "Active"} />
              </div>

              <div className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.archivedAt ? "Last known unit price" : "Current unit price"}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatUnitPrice(item.currentUnitPrice, item.currency, item.unit)}
              </div>
              {item.currentStore && (
                <div className="mt-1 text-sm text-muted-foreground">Best at {item.currentStore}</div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Small label="Target" value={formatUnitPrice(item.targetUnitPrice, item.currency, item.unit)} />
                <Small label="Previous" value={formatUnitPrice(item.previousUnitPrice, item.currency, item.unit)} />
              </div>

              <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
                <div className="flex justify-between gap-3"><span>Automatic</span><span>{item.automaticSourceCount}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span>Manual</span><span>{item.manualSourceCount}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span>Last checked</span><span>{formatDateTime(item.lastCheckedAt)}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
