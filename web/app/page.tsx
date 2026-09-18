"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ProductCard } from "@/components/product-card";
import {
  ProductStatusNav,
} from "@/components/product-status-nav";
import {
  ProductSort,
  ProductToolbar,
} from "@/components/product-toolbar";
import { ProductsSkeleton } from "@/components/products-skeleton";
import { SiteHeader } from "@/components/site-header";
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
      const token =
        await getAccessToken();

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

  useEffect(() => {
    if (ready) {
      loadData().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  const products =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.itemType === "Product"
        ),
      [items]
    );

  const activeProducts =
    products.filter(
      (item) => !item.archivedAt
    );

  const archivedProducts =
    products.filter(
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

  const pendingProductIds =
    new Set(
      pendingReviews.map(
        (review) => review.itemId
      )
    );

  const reviewProducts =
    activeProducts.filter((item) =>
      pendingProductIds.has(item.id)
    );

  const filteredProducts =
    useMemo(() => {
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

      const query =
        search.trim().toLowerCase();

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
      activeProducts,
      archivedProducts,
      belowTargetProducts,
      reviewProducts,
      droppedProducts,
      increasedProducts,
    ]);

  return (
    <div className="min-h-screen bg-muted/15">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Products
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Compare normalized prices, watch targets,
              and keep archived purchases for later.
            </p>
          </div>

          <ProductStatusNav
            activeFilter={filter}
            onChange={setFilter}
            active={activeProducts.length}
            archived={
              archivedProducts.length
            }
            belowTarget={
              belowTargetProducts.length
            }
            needsReview={
              reviewProducts.length
            }
            drops={
              droppedProducts.length
            }
            increases={
              increasedProducts.length
            }
          />

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
          ) : filteredProducts.length ===
            0 ? (
            <EmptyProducts
              title="No products here"
              description="Try another status, change your search, or add a new product."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map(
                (item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                  />
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
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
