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
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { ProductStatusNav } from "@/components/product-status-nav";
import {
  ProductSort,
  ProductToolbar,
} from "@/components/product-toolbar";
import { ProductsSkeleton } from "@/components/products-skeleton";
import { WorkspacePage } from "@/components/workspace-page";
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

  const activeProducts = products.filter(isActiveItem);

  const archivedProducts = products.filter(isArchivedItem);

  const belowTargetProducts =
    activeProducts.filter(isBelowTarget);

  const droppedProducts =
    activeProducts.filter(hasPriceDrop);

  const increasedProducts =
    activeProducts.filter(hasPriceIncrease);

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

    result = result.filter((item) =>
      matchesItemSearch(item, search)
    );

    return sortItems(result, sort);
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
            <EmptyState
              icon={PackageOpen}
              title="Sign in to view PriceWatch"
              description="Use the Login button in the top-right corner."
            />
          ) : forbidden ? (
            <EmptyState
              icon={PackageOpen}
              title="No data available"
              description="This Microsoft account does not have access to the PriceWatch data."
            />
          ) : error ? (
            <EmptyState
              icon={PackageOpen}
              title="Could not load products"
              description={error}
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
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

