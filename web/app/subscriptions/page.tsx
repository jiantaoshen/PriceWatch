"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePage } from "@/components/workspace-page";
import { SubscriptionCard } from "@/components/subscription-card";
import {
  SubscriptionFilter,
  SubscriptionStatusNav,
} from "@/components/subscription-status-nav";
import {
  SubscriptionSort,
  SubscriptionToolbar,
} from "@/components/subscription-toolbar";
import { ProductsSkeleton } from "@/components/products-skeleton";
import { ApiError, apiFetch } from "@/lib/api";
import type { ItemListItem } from "@/lib/types";

export default function SubscriptionsPage() {
  const { ready, account, getAccessToken } = useAuth();

  const [items, setItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubscriptionFilter>("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SubscriptionSort>("name");

  async function loadData() {
    if (!account) {
      setItems([]);
      return;
    }

    setLoading(true);
    setForbidden(false);
    setError(null);

    try {
      const token = await getAccessToken();

      const result = await apiFetch<ItemListItem[]>(
        "/api/items?includeArchived=true",
        token.accessToken
      );

      setItems(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) void loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  const subscriptions = items.filter((item) => item.itemType === "Subscription");
  const activeSubscriptions = subscriptions.filter((item) => !item.archivedAt);
  const archivedSubscriptions = subscriptions.filter((item) => item.archivedAt);

  const monthlyTotal = activeSubscriptions.reduce(
    (sum, item) => sum + (item.monthlyPrice ?? 0),
    0
  );

  const currency = activeSubscriptions[0]?.currency ?? "SEK";

  const filteredSubscriptions = (
    filter === "archived"
      ? archivedSubscriptions
      : activeSubscriptions
  )
    .filter((item) =>
      item.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "current-price") {
        return (a.monthlyPrice ?? 0) - (b.monthlyPrice ?? 0);
      }

      return a.name.localeCompare(b.name);
    });

  return (
    <WorkspacePage
      title="Subscriptions"
      description="Track your recurring monthly expenses."
    >
      <SubscriptionStatusNav
        activeFilter={filter}
        onChange={setFilter}
        active={activeSubscriptions.length}
        archived={archivedSubscriptions.length}
        monthlyTotal={monthlyTotal}
        currency={currency}
      />

      <SubscriptionToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {filteredSubscriptions.length}
          </span>{" "}
          {filteredSubscriptions.length === 1
            ? "subscription"
            : "subscriptions"}
        </p>
      </div>

      {!ready || loading ? (
        <ProductsSkeleton />
      ) : !account ? (
        <EmptyState
          icon={CreditCard}
          title="Sign in to view subscriptions"
          description="Use the Login button in the top-right corner."
        />
      ) : forbidden ? (
        <EmptyState
          icon={CreditCard}
          title="No data available"
          description="This Microsoft account does not have access to the PriceWatch data."
        />
      ) : error ? (
        <EmptyState
          icon={CreditCard}
          title="Could not load subscriptions"
          description={error}
        />
      ) : filteredSubscriptions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No subscriptions here"
          description="Try another status, change your search, or add a subscription."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSubscriptions.map((item) => (
            <SubscriptionCard
              key={item.id}
              item={item}
              onRestored={() => void loadData()}
            />
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}