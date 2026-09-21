"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CreditCard,
} from "lucide-react";
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
import {
  hasPriceDrop,
  hasPriceIncrease,
  isActiveItem,
  isArchivedItem,
  isBelowTarget,
  matchesItemSearch,
  sortItems,
} from "@/lib/item-list";
import type {
  ItemListItem,
} from "@/lib/types";

export default function SubscriptionsPage() {
  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [items, setItems] =
    useState<ItemListItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [forbidden, setForbidden] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<SubscriptionFilter>(
      "active"
    );

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState<SubscriptionSort>(
      "name"
    );

  async function loadData() {
    if (!account) {
      setItems([]);
      return;
    }

    setLoading(true);
    setForbidden(false);
    setError(null);

    try {
      const token =
        await getAccessToken();

      const result =
        await apiFetch<ItemListItem[]>(
          "/api/items?includeArchived=true",
          token.accessToken
        );

      setItems(result);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403
      ) {
        setForbidden(true);
        setItems([]);
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
      loadData().catch(
        console.error
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  const subscriptions =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.itemType ===
            "Subscription"
        ),
      [items]
    );

  const activeSubscriptions =
    subscriptions.filter(isActiveItem);

  const archivedSubscriptions =
    subscriptions.filter(isArchivedItem);

  const belowTargetSubscriptions =
    activeSubscriptions.filter(isBelowTarget);

  const droppedSubscriptions =
    activeSubscriptions.filter(hasPriceDrop);

  const increasedSubscriptions =
    activeSubscriptions.filter(hasPriceIncrease);

  const noPriceSubscriptions =
    activeSubscriptions.filter(
      (item) =>
        item.currentUnitPrice ===
        null
    );

  const filteredSubscriptions =
    useMemo(() => {
      let result =
        filter === "archived"
          ? archivedSubscriptions
          : filter ===
              "below-target"
            ? belowTargetSubscriptions
            : filter === "drops"
              ? droppedSubscriptions
              : filter ===
                  "increases"
                ? increasedSubscriptions
                : filter ===
                    "no-price"
                  ? noPriceSubscriptions
                  : activeSubscriptions;

      result = result.filter((item) =>
        matchesItemSearch(item, search)
      );

      return sortItems(result, sort);
    }, [
      filter,
      search,
      sort,
      activeSubscriptions,
      archivedSubscriptions,
      belowTargetSubscriptions,
      droppedSubscriptions,
      increasedSubscriptions,
      noPriceSubscriptions,
    ]);

  return (
    <WorkspacePage
      title="Subscriptions"
      description="Track recurring services and price changes using the same normalized PriceWatch model."
    >
          <SubscriptionStatusNav
            activeFilter={filter}
            onChange={setFilter}
            active={
              activeSubscriptions.length
            }
            archived={
              archivedSubscriptions.length
            }
            belowTarget={
              belowTargetSubscriptions.length
            }
            drops={
              droppedSubscriptions.length
            }
            increases={
              increasedSubscriptions.length
            }
            noPrice={
              noPriceSubscriptions.length
            }
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
                {
                  filteredSubscriptions.length
                }
              </span>{" "}
              {filteredSubscriptions.length ===
              1
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
          ) : filteredSubscriptions.length ===
            0 ? (
            <EmptyState
              icon={CreditCard}
              title="No subscriptions here"
              description="Try another status, change your search, or add a subscription."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSubscriptions.map(
                (item) => (
                  <SubscriptionCard
                    key={item.id}
                    item={item}
                    onRestored={() => {
                      loadData().catch(
                        console.error
                      );
                    }}
                  />
                )
              )}
            </div>
          )}
    </WorkspacePage>
  );
}

