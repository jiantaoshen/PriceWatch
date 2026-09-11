/**
 * File: components/products/ProductList.tsx
 * Purpose:
 *   Renders the product side of PriceWatch. Products are split only into Active
 *   and Archived scopes; subscriptions live in their own top-level application tab.
 *
 * Main function:
 *   - ProductList(props): composes product summary, Active/Archived tabs, filters,
 *     product cards, empty states, creation action and pagination.
 *
 * Inputs:
 *   Merged LatestDataFile, compact history, product selection and refresh callbacks.
 *
 * Outputs:
 *   Interactive product dashboard. Product creation stays scraper-oriented.
 */

import { Archive, SearchX } from "lucide-react";

import { ProductCard } from "@/components/products/ProductCard";
import { ProductCollectionTabs } from "@/components/products/ProductCollectionTabs";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ProductPagination } from "@/components/products/ProductPagination";
import { ProductSummary } from "@/components/products/ProductSummary";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useProductList } from "@/hooks/useProductList";

import type { HistoryDataFile, HistoryIndex, LatestDataFile, Product } from "@/types/product";


interface ProductListProps {
  data: LatestDataFile;
  history: HistoryIndex | null;
  historyData: HistoryDataFile[];
  onSelectProduct: (product: Product) => void;
  onRefresh: () => void | Promise<void>;
}


export function ProductList({
  data,
  history,
  historyData,
  onSelectProduct,
  onRefresh,
}: ProductListProps) {
  const list = useProductList(data.data, historyData, data.period);
  const hasProducts = data.data.length > 0;

  if (!hasProducts) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle>No products saved yet</CardTitle>
          <CardDescription>
            Add a product to start tracking prices.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex justify-center">
          <ProductFormDialog mode="create" onSaved={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <ProductSummary
        products={data.data}
        history={historyData}
        currentPeriod={data.period}
      />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Products
            </h2>

            <p className="text-sm text-muted-foreground">
              Track active products. Record your latest purchase, then archive anything you no longer want the scraper to check.
            </p>
          </div>

          {history && (
            <p className="text-sm text-muted-foreground">
              {history.periods.length}{" "}
              {history.periods.length === 1 ? "period" : "periods"} of history
            </p>
          )}
        </div>

        <ProductCollectionTabs
          value={list.collection}
          products={data.data}
          onChange={list.setCollection}
        />

        <Separator />

        <ProductFilters
          searchQuery={list.searchQuery}
          filter={list.filter}
          sort={list.sort}
          onSearchChange={list.setSearchQuery}
          onFilterChange={list.setFilter}
          onSortChange={list.setSort}
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {list.totalResults > 0
              ? `Showing ${list.pageStart + 1}-${list.pageEnd} of ${list.totalResults} ${list.collection} products`
              : `No matching ${list.collection} products`}
          </p>

          {list.collection === "active" && (
            <ProductFormDialog mode="create" onSaved={onRefresh} />
          )}
        </div>

        {list.products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.products.map(product => (
              <ProductCard
                key={product.product_id}
                product={product}
                historyComparison={
                  list.comparisonById.get(product.product_id) ?? {
                    period: null,
                    price: null,
                    unitPrice: null,
                  }
                }
                onClick={() => onSelectProduct(product)}
              />
            ))}
          </div>
        ) : (
          <CollectionEmptyState
            collection={list.collection}
            hasSearchOrPriceFilter={
              list.searchQuery.trim().length > 0 || list.filter !== "all"
            }
          />
        )}

        <ProductPagination
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.setPage}
        />
      </section>
    </div>
  );
}


function CollectionEmptyState({
  collection,
  hasSearchOrPriceFilter,
}: {
  collection: ReturnType<typeof useProductList>["collection"];
  hasSearchOrPriceFilter: boolean;
}) {
  if (hasSearchOrPriceFilter) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <SearchX className="size-5 text-muted-foreground" />
          <p className="mt-3 font-medium">No products found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try changing your search or price filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (collection === "archived") {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Archive className="size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing archived yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            When you buy something and no longer want to track it, record the purchase and archive the product.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <p className="font-medium">No active products</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Restore an archived product or add a new product to start tracking.
        </p>
      </CardContent>
    </Card>
  );
}
