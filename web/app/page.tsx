"use client";

import {
  ArchiveRestore,
  PackageOpen,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { ProductCard } from "@/components/product-card";
import { ProductStatusNav } from "@/components/product-status-nav";
import {
  ProductSort,
  ProductToolbar,
} from "@/components/product-toolbar";
import { ProductsSkeleton } from "@/components/products-skeleton";
import { WorkspacePage } from "@/components/workspace-page";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  ItemListItem,
  PendingReview,
  ProductFilter,
} from "@/lib/types";

export default function HomePage() {
  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [items, setItems] =
    useState<ItemListItem[]>([]);

  const [pendingReviews, setPendingReviews] =
    useState<PendingReview[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [forbidden, setForbidden] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<ProductFilter>("active");

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState<ProductSort>("name");

  const [restoringId, setRestoringId] =
    useState<string | null>(null);

  async function loadData() {
    if (!account) {
      setItems([]);
      setPendingReviews([]);
      return;
    }

    setLoading(true);
    setForbidden(false);
    setError(null);

    try {
      const token = await getAccessToken();

      const [allItems, reviews] =
        await Promise.all([
          apiFetch<ItemListItem[]>(
            "/api/items?includeArchived=true",
            token.accessToken
          ),
          apiFetch<PendingReview[]>(
            "/api/reviews/pending",
            token.accessToken
          ),
        ]);

      setItems(allItems);
      setPendingReviews(reviews);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403
      ) {
        setForbidden(true);
        setItems([]);
        setPendingReviews([]);
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

  async function restoreItem(id: string) {
    setRestoringId(id);
    setError(null);

    try {
      const token = await getAccessToken();

      await apiFetch<void>(
        `/api/items/${id}/restore`,
        token.accessToken,
        { method: "POST" }
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setRestoringId(null);
    }
  }

  useEffect(() => {
    if (ready) {
      loadData().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  const products = useMemo(
    () =>
      items.filter(
        (item) => item.itemType === "Product"
      ),
    [items]
  );

  const activeProducts = products.filter(
    (item) => !item.archivedAt
  );

  const archivedProducts = products.filter(
    (item) => Boolean(item.archivedAt)
  );

  const belowTargetProducts =
    activeProducts.filter(
      (item) =>
        item.currentUnitPrice !== null &&
        item.targetUnitPrice !== null &&
        item.currentUnitPrice <=
          item.targetUnitPrice
    );

  const droppedProducts =
    activeProducts.filter(
      (item) =>
        item.currentUnitPrice !== null &&
        item.previousUnitPrice !== null &&
        item.currentUnitPrice <
          item.previousUnitPrice
    );

  const increasedProducts =
    activeProducts.filter(
      (item) =>
        item.currentUnitPrice !== null &&
        item.previousUnitPrice !== null &&
        item.currentUnitPrice >
          item.previousUnitPrice
    );

  const pendingProductIds = new Set(
    pendingReviews.map(
      (review) => review.itemId
    )
  );

  const reviewProducts =
    activeProducts.filter((item) =>
      pendingProductIds.has(item.id)
    );

  const filteredProducts = useMemo(() => {
    let result =
      filter === "archived"
        ? archivedProducts
        : filter === "below-target"
          ? belowTargetProducts
          : filter === "needs-review"
            ? reviewProducts
            : filter === "drops"
              ? droppedProducts
              : filter === "increases"
                ? increasedProducts
                : activeProducts;

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter(
        (item) =>
          item.name
            .toLowerCase()
            .includes(query) ||
          item.currentStore
            ?.toLowerCase()
            .includes(query)
      );
    }

    return [...result].sort((a, b) => {
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
          return a.name.localeCompare(b.name);
      }
    });
  }, [
    filter,
    search,
    sort,
    activeProducts,
    archivedProducts,
    belowTargetProducts,
    reviewProducts,
    droppedProducts,
    increasedProducts,
  ]);

  return (
    <WorkspacePage
      title="Products"
      description="Compare normalized prices, watch targets, and keep archived purchases for later."
    >
          <ProductStatusNav
            activeFilter={filter}
            onChange={setFilter}
            active={activeProducts.length}
            archived={archivedProducts.length}
            belowTarget={belowTargetProducts.length}
            needsReview={reviewProducts.length}
            drops={droppedProducts.length}
            increases={increasedProducts.length}
          />

          {filter === "archived" && (
            <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/25 px-4 py-3 text-sm">
              <ArchiveRestore className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

              <div>
                <div className="font-medium">
                  Archived products keep their data.
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  Sources, history, purchase data, and the
                  last known price remain available. Restore
                  makes the product active in the list again,
                  but tracking stays disabled until you enable
                  it yourself.
                </div>
              </div>
            </div>
          )}

          <ProductToolbar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {filteredProducts.length}
              </span>{" "}
              {filteredProducts.length === 1
                ? "product"
                : "products"}
            </p>
          </div>

          {!ready || loading ? (
            <ProductsSkeleton />
          ) : !account ? (
            <EmptyProducts
              title="Sign in to view PriceWatch"
              description="Use the Login button in the top-right corner."
            />
          ) : forbidden ? (
            <EmptyProducts
              title="No data available"
              description="This Microsoft account does not have access to the PriceWatch data."
            />
          ) : error ? (
            <EmptyProducts
              title="Could not load products"
              description={error}
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyProducts
              title={
                filter === "archived"
                  ? "No archived products"
                  : "No products here"
              }
              description={
                filter === "archived"
                  ? "Archived products will appear here and can be restored at any time."
                  : "Try another status, change your search, or add a new product."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onRestore={
                    item.archivedAt
                      ? restoreItem
                      : undefined
                  }
                  restoring={
                    restoringId === item.id
                  }
                />
              ))}
            </div>
          )}
    </WorkspacePage>
  );
}

function EmptyProducts({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <PackageOpen className="size-5 text-muted-foreground" />
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

function targetGap(item: ItemListItem) {
  if (
    item.currentUnitPrice === null ||
    item.targetUnitPrice === null
  ) {
    return null;
  }

  return (
    item.currentUnitPrice - item.targetUnitPrice
  );
}

function compareNullableNumbers(
  a: number | null,
  b: number | null
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareNullableDates(
  a: string | null,
  b: string | null
) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  return (
    new Date(a).getTime() -
    new Date(b).getTime()
  );
}
