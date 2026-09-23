"use client";

import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { ProductsSkeleton } from "@/components/products-skeleton";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionStatusNav, type SubscriptionFilter } from "@/components/subscription-status-nav";
import { SubscriptionToolbar, type SubscriptionSort } from "@/components/subscription-toolbar";
import { WorkspacePage } from "@/components/workspace-page";
import { ApiError, apiFetch } from "@/lib/api";
import type { ItemListItem } from "@/lib/types";

async function fetchSubscriptionsData(accessToken: string) {
  return apiFetch<ItemListItem[]>("/api/items?includeArchived=true", accessToken);
}

export default function SubscriptionsPage() {
  const { ready, account, getAccessToken } = useAuth();

  const [items, setItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubscriptionFilter>("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SubscriptionSort>("name");

  useEffect(() => {
    if (!ready || !account) return;

    let cancelled = false;

    void getAccessToken()
      .then((token) => {
        if (!cancelled) {
          setLoading(true);
          setForbidden(false);
          setError(null);
        }

        return fetchSubscriptionsData(token.accessToken);
      })
      .then((items) => {
        if (!cancelled) setItems(items);
      })
      .catch((err) => {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          setItems([]);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, account, getAccessToken]);

  async function reloadData() {
    const token = await getAccessToken();
    const items = await fetchSubscriptionsData(token.accessToken);
    setItems(items);
  }

  const subscriptions = items.filter((item) => item.itemType === "Subscription");
  const activeSubscriptions = subscriptions.filter((item) => !item.archivedAt);
  const archivedSubscriptions = subscriptions.filter((item) => item.archivedAt);

  const monthlyTotal = activeSubscriptions.reduce((sum, item) => sum + (item.monthlyPrice ?? 0), 0);
  const currency = activeSubscriptions[0]?.currency ?? "SEK";

  const visibleSubscriptions = filter === "archived" ? archivedSubscriptions : activeSubscriptions;

  const filteredSubscriptions = visibleSubscriptions
    .filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "current-price") return (a.monthlyPrice ?? 0) - (b.monthlyPrice ?? 0);
      return a.name.localeCompare(b.name);
    });

  return (
    <WorkspacePage title="Subscriptions" description="Track your recurring monthly expenses.">
      <SubscriptionStatusNav
        activeFilter={filter}
        onChange={setFilter}
        active={activeSubscriptions.length}
        archived={archivedSubscriptions.length}
        monthlyTotal={monthlyTotal}
        currency={currency}
      />

      <SubscriptionToolbar search={search} onSearchChange={setSearch} sort={sort} onSortChange={setSort} />

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filteredSubscriptions.length}</span>{" "}
        {filteredSubscriptions.length === 1 ? "subscription" : "subscriptions"}
      </p>

      {!ready ? (
        <ProductsSkeleton />
      ) : !account ? (
        <EmptyState
          icon={CreditCard}
          title="Sign in to view subscriptions"
          description="Use the Login button in the top-right corner."
        />
      ) : loading ? (
        <ProductsSkeleton />
      ) : forbidden ? (
        <EmptyState
          icon={CreditCard}
          title="No data available"
          description="This Microsoft account does not have access to the PriceWatch data."
        />
      ) : error ? (
        <EmptyState icon={CreditCard} title="Could not load subscriptions" description={error} />
      ) : filteredSubscriptions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No subscriptions here"
          description="Try another status, change your search, or add a subscription."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSubscriptions.map((item) => (
            <SubscriptionCard key={item.id} item={item} onRestored={() => void reloadData()} />
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}
