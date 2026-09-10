/**
 * File: components/products/ProductList.tsx
 * Purpose:
 *   Renders the main PriceWatch product library. The page keeps price tracking
 *   central while adding practical lifecycle navigation for Tracking, Owned and
 *   Subscription products.
 *
 * Main function:
 *   - ProductList(props): composes summary, lifecycle tabs, search/price filters,
 *     product cards, empty states, creation action and pagination.
 *
 * Inputs:
 *   Latest merged DataFile, history index, product selection callback and refresh callback.
 *
 * Outputs:
 *   Interactive dashboard UI. Product creation is delegated to ProductFormDialog.
 */

import { PackageCheck, Repeat2, SearchX } from "lucide-react";

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

import type { DataFile, HistoryIndex, Product } from "@/types/product";


interface ProductListProps {
  data: DataFile;
  history: HistoryIndex | null;
  onSelectProduct: (product: Product) => void;
  onRefresh: () => void | Promise<void>;
}


export function ProductList({
  data,
  history,
  onSelectProduct,
  onRefresh,
}: ProductListProps) {
  const list = useProductList(data.data);
  const hasProducts = data.data.length > 0;


  if (!hasProducts) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle>No products saved yet</CardTitle>
          <CardDescription>
            Add a product to start tracking prices. You can mark it as owned or a subscription later.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex justify-center">
          <ProductFormDialog
            mode="create"
            onSaved={onRefresh}
          />
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-8">
      <ProductSummary products={data.data} />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Saved products
            </h2>

            <p className="text-sm text-muted-foreground">
              Keep tracking prices after you buy, and monitor recurring subscriptions in the same place.
            </p>
          </div>

          {history && (
            <p className="text-sm text-muted-foreground">
              {history.periods.length}{" "}
              {history.periods.length === 1 ? "week" : "weeks"} of history
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
              ? `Showing ${list.pageStart + 1}-${list.pageEnd} of ${list.totalResults} ${collectionLabel(list.collection)}`
              : `No matching ${collectionLabel(list.collection)}`}
          </p>

          <ProductFormDialog
            mode="create"
            onSaved={onRefresh}
          />
        </div>

        {list.products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.products.map(product => (
              <ProductCard
                key={product.product_id}
                product={product}
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

  if (collection === "owned") {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <PackageCheck className="size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing marked as owned yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Open a tracked product and choose “Mark as purchased”. Price tracking can keep running after the purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (collection === "subscription") {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Repeat2 className="size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">No subscriptions saved yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Open a tracked product and mark it as a subscription to save what you actually pay and the next billing date.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <p className="font-medium">No tracking-only products</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Owned products and subscriptions can still continue using the scraper.
        </p>
      </CardContent>
    </Card>
  );
}


function collectionLabel(collection: ReturnType<typeof useProductList>["collection"]): string {
  if (collection === "tracked") return "tracking products";
  if (collection === "owned") return "owned products";
  if (collection === "subscription") return "subscriptions";
  return "products";
}
