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
    subscriptions.filter(
      (item) => !item.archivedAt
    );

  const archivedSubscriptions =
    subscriptions.filter(
      (item) =>
        Boolean(item.archivedAt)
    );

  const belowTargetSubscriptions =
    activeSubscriptions.filter(
      (item) =>
        item.currentUnitPrice !==
          null &&
        item.targetUnitPrice !==
          null &&
        item.currentUnitPrice <=
          item.targetUnitPrice
    );

  const droppedSubscriptions =
    activeSubscriptions.filter(
      (item) =>
        item.currentUnitPrice !==
          null &&
        item.previousUnitPrice !==
          null &&
        item.currentUnitPrice <
          item.previousUnitPrice
    );

  const increasedSubscriptions =
    activeSubscriptions.filter(
      (item) =>
        item.currentUnitPrice !==
          null &&
        item.previousUnitPrice !==
          null &&
        item.currentUnitPrice >
          item.previousUnitPrice
    );

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

      const query =
        search
          .trim()
          .toLowerCase();

      if (query) {
        result =
          result.filter(
            (item) =>
              item.name
                .toLowerCase()
                .includes(query) ||
              item.currentStore
                ?.toLowerCase()
                .includes(query)
          );
      }

      return [...result].sort(
        (a, b) => {
          switch (sort) {
            case "current-price":
              return compareNullableNumbers(
                a.currentUnitPrice,
                b.currentUnitPrice
              );

            case "target-gap":
              return compareNullableNumbers(
                targetGap(a),
                targetGap(b)
              );

            case "last-checked":
              return compareNullableDates(
                b.lastCheckedAt,
                a.lastCheckedAt
              );

            case "name":
            default:
              return a.name.localeCompare(
                b.name
              );
          }
        }
      );
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
            <EmptySubscriptions
              title="Sign in to view subscriptions"
              description="Use the Login button in the top-right corner."
            />
          ) : forbidden ? (
            <EmptySubscriptions
              title="No data available"
              description="This Microsoft account does not have access to the PriceWatch data."
            />
          ) : error ? (
            <EmptySubscriptions
              title="Could not load subscriptions"
              description={error}
            />
          ) : filteredSubscriptions.length ===
            0 ? (
            <EmptySubscriptions
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

function EmptySubscriptions({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CreditCard className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 text-base font-semibold">
        {title}
      </h2>

      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function targetGap(
  item: ItemListItem
) {
  if (
    item.currentUnitPrice === null ||
    item.targetUnitPrice === null
  ) {
    return null;
  }

  return (
    item.currentUnitPrice -
    item.targetUnitPrice
  );
}

function compareNullableNumbers(
  a: number | null,
  b: number | null
) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return a - b;
}

function compareNullableDates(
  a: string | null,
  b: string | null
) {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return 1;
  }

  if (!b) {
    return -1;
  }

  return (
    new Date(a).getTime() -
    new Date(b).getTime()
  );
}
