"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { ProductStatusNav } from "@/components/product-status-nav";
import { ItemListToolbar } from "@/components/product-list-toolbar";
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
  type ItemSort,
} from "@/lib/item-list";
import type { ItemListItem, ProductFilter } from "@/lib/types";

async function fetchProductsData(accessToken: string) {
  return apiFetch<ItemListItem[]>("/api/items?includeArchived=true", accessToken);
}

export default function HomePage() {
  const { ready, account, getAccessToken } = useAuth();

  const [items, setItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ItemSort>("name");
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

        return fetchProductsData(token.accessToken);
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

  async function restoreItem(id: string) {
    setRestoringId(id);
    setError(null);

    try {
      const token = await getAccessToken();

      await apiFetch<void>(`/api/items/${id}/restore`, token.accessToken, { method: "POST" });

      setItems(await fetchProductsData(token.accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoringId(null);
    }
  }

  const products = items.filter((item) => item.itemType === "Product");
  const activeProducts = products.filter(isActiveItem);
  const archivedProducts = products.filter(isArchivedItem);
  const belowTargetProducts = activeProducts.filter(isBelowTarget);
  const droppedProducts = activeProducts.filter(hasPriceDrop);
  const increasedProducts = activeProducts.filter(hasPriceIncrease);

  let visibleProducts = activeProducts;

  if (filter === "archived") visibleProducts = archivedProducts;
  if (filter === "below-target") visibleProducts = belowTargetProducts;
  if (filter === "drops") visibleProducts = droppedProducts;
  if (filter === "increases") visibleProducts = increasedProducts;

  const filteredProducts = sortItems(
    visibleProducts.filter((item) => matchesItemSearch(item, search)),
    sort
  );

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
        drops={droppedProducts.length}
        increases={increasedProducts.length}
      />

      {filter === "archived" && (
        <div className="rounded-xl border border-dashed bg-muted/25 px-4 py-3 text-sm">
          <div>
            <div className="font-medium">Archived products keep their data.</div>
            <div className="mt-0.5 text-muted-foreground">
              Sources, history, purchase data, and the last known price remain available. Restore makes the product
              active again, but tracking stays disabled until you enable it yourself.
            </div>
          </div>
        </div>
      )}

      <ItemListToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: "name", label: "Name" },
          { value: "current-price", label: "Current price" },
          { value: "target-gap", label: "Target gap" },
          { value: "last-checked", label: "Last checked" },
        ]}
        searchPlaceholder="Search products or stores…"
        actionLabel="Add product"
        actionHref="/items/new"
      />

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filteredProducts.length}</span>{" "}
        {filteredProducts.length === 1 ? "product" : "products"}
      </p>

      {!ready ? (
        <ProductsSkeleton />
      ) : !account ? (
        <EmptyState
          title="Sign in to view PriceWatch"
          description="Use the Login button in the top-right corner."
        />
      ) : loading ? (
        <ProductsSkeleton />
      ) : forbidden ? (
        <EmptyState
          title="No data available"
          description="This Microsoft account does not have access to the PriceWatch data."
        />
      ) : error ? (
        <EmptyState title="Could not load products" description={error} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={filter === "archived" ? "No archived products" : "No products here"}
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
              onRestore={item.archivedAt ? restoreItem : undefined}
              restoring={restoringId === item.id}
            />
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}
