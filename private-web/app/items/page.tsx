"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { PrivateItem } from "@/lib/types";
import { formatDateTime, formatUnitPrice } from "@/lib/format";
import { Card, Page, StatusBadge } from "@/components/ui";

export default function ItemsPage() {
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PrivateItem[]>("/api/private/items?includeArchived=true")
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? items.filter((x) => x.name.toLowerCase().includes(query) || x.currentStore?.toLowerCase().includes(query))
      : items;
  }, [items, search]);

  return (
    <Page title="Items" description="Read-only Neon view used by the local scraper.">
      <div className="relative mb-5 max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items or stores…"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      {error && <div className="mb-5 text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <Card key={item.id} className={item.archivedAt ? "border-dashed bg-zinc-50" : ""}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="line-clamp-2 font-semibold">{item.name}</h2>
                  <div className="mt-2 text-xs text-zinc-500">
                    {item.itemType} · {item.updateMode} · {item.sourceCount} sources
                  </div>
                </div>
                <StatusBadge value={item.archivedAt ? "Archived" : item.belowTarget ? "Below target" : "Active"} />
              </div>

              <div className="mt-5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {item.archivedAt ? "Last known unit price" : "Current unit price"}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatUnitPrice(item.currentUnitPrice, item.currency, item.unit)}
              </div>
              {item.currentStore && <div className="mt-1 text-sm text-zinc-500">Best at {item.currentStore}</div>}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Small label="Target" value={formatUnitPrice(item.targetUnitPrice, item.currency, item.unit)} />
                <Small label="Previous" value={formatUnitPrice(item.previousUnitPrice, item.currency, item.unit)} />
              </div>

              <div className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                <div className="flex justify-between gap-3"><span>Automatic</span><span>{item.automaticSourceCount}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span>Manual</span><span>{item.manualSourceCount}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span>Last checked</span><span>{formatDateTime(item.lastCheckedAt)}</span></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
