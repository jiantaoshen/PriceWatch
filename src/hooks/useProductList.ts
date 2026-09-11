/**
 * File: hooks/useProductList.ts
 * Purpose:
 *   Centralizes Active/Archived product scope, search, price filters, sorting and
 *   pagination. Recent price movement compares current accepted price with the
 *   newest older compact history result.
 *
 * Main function:
 *   - useProductList(products, history, currentPeriod): derives the visible page,
 *     recent-history comparison map and all dashboard list state setters.
 *
 * Inputs:
 *   Merged Product[], compact HistoryDataFile[] and current latest period.
 *
 * Outputs:
 *   Paginated products, comparisonById and collection/filter/sort/search state.
 */

import { useMemo, useState } from "react";

import { getRecentHistoryComparison } from "@/utils/historyComparison";
import { getPriceMovement } from "@/utils/priceMovement";

import type { RecentHistoryComparison } from "@/utils/historyComparison";
import type { HistoryDataFile, Product } from "@/types/product";


export type ProductCollection = "active" | "archived";

export type ProductFilter =
  | "all"
  | "belowTarget"
  | "unitBelowTarget"
  | "priceDrops";

export type ProductSort =
  | "name"
  | "priceLow"
  | "priceHigh"
  | "unitPriceLow"
  | "unitPriceHigh"
  | "biggestDrop";


const PRODUCTS_PER_PAGE = 12;


export function useProductList(
  products: Product[],
  history: HistoryDataFile[],
  currentPeriod: string,
) {
  const [collection, setCollectionState] = useState<ProductCollection>("active");
  const [searchQuery, setSearchQueryState] = useState("");
  const [filter, setFilterState] = useState<ProductFilter>("all");
  const [sort, setSortState] = useState<ProductSort>("name");
  const [page, setPage] = useState(1);

  const comparisonById = useMemo(() => {
    return new Map<string, RecentHistoryComparison>(
      products.map(product => [
        product.product_id,
        getRecentHistoryComparison(product.product_id, history, currentPeriod),
      ]),
    );
  }, [products, history, currentPeriod]);

  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products
      .filter(product =>
        matchesCollection(product, collection) &&
        matchesSearch(product, query) &&
        matchesFilter(product, filter, comparisonById.get(product.product_id))
      )
      .sort((a, b) => compareProducts(a, b, sort, comparisonById));
  }, [products, collection, searchQuery, filter, sort, comparisonById]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageEnd = Math.min(pageStart + PRODUCTS_PER_PAGE, visibleProducts.length);
  const paginatedProducts = visibleProducts.slice(pageStart, pageEnd);

  function setCollection(value: ProductCollection) {
    setCollectionState(value);
    setPage(1);
  }

  function setSearchQuery(value: string) {
    setSearchQueryState(value);
    setPage(1);
  }

  function setFilter(value: ProductFilter) {
    setFilterState(value);
    setPage(1);
  }

  function setSort(value: ProductSort) {
    setSortState(value);
    setPage(1);
  }

  return {
    products: paginatedProducts,
    comparisonById,
    collection,
    setCollection,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    sort,
    setSort,
    page: currentPage,
    setPage,
    totalPages,
    totalResults: visibleProducts.length,
    pageStart,
    pageEnd,
  };
}


function matchesCollection(product: Product, collection: ProductCollection): boolean {
  return collection === "archived"
    ? product.archived_at !== null
    : product.archived_at === null;
}


function matchesSearch(product: Product, query: string): boolean {
  if (!query) return true;

  return (
    product.name.toLowerCase().includes(query) ||
    product.store?.toLowerCase().includes(query) === true ||
    product.unit_store?.toLowerCase().includes(query) === true ||
    (product.offers ?? []).some(
      offer =>
        offer.store?.toLowerCase().includes(query) === true ||
        offer.note?.toLowerCase().includes(query) === true,
    )
  );
}


function matchesFilter(
  product: Product,
  filter: ProductFilter,
  comparison: RecentHistoryComparison | undefined,
): boolean {
  if (filter === "belowTarget") return product.below_target === true;
  if (filter === "unitBelowTarget") return product.unit_below_target === true;

  if (filter === "priceDrops") {
    return (
      product.status === "success" &&
      getPriceMovement(
        product.current_price,
        comparison?.price ?? null,
      ).direction === "down"
    );
  }

  return true;
}


function compareProducts(
  a: Product,
  b: Product,
  sort: ProductSort,
  comparisonById: Map<string, RecentHistoryComparison>,
): number {
  if (sort === "name") return a.name.localeCompare(b.name);

  if (sort === "priceLow") {
    return nullablePrice(a.current_price, Infinity) - nullablePrice(b.current_price, Infinity);
  }

  if (sort === "priceHigh") {
    return nullablePrice(b.current_price, -Infinity) - nullablePrice(a.current_price, -Infinity);
  }

  if (sort === "unitPriceLow") {
    return nullablePrice(a.current_unit_price, Infinity) - nullablePrice(b.current_unit_price, Infinity);
  }

  if (sort === "unitPriceHigh") {
    return nullablePrice(b.current_unit_price, -Infinity) - nullablePrice(a.current_unit_price, -Infinity);
  }

  if (sort === "biggestDrop") {
    return dropAmount(b, comparisonById) - dropAmount(a, comparisonById);
  }

  return 0;
}


function dropAmount(
  product: Product,
  comparisonById: Map<string, RecentHistoryComparison>,
): number {
  if (product.status !== "success") return -Infinity;

  const comparison = comparisonById.get(product.product_id);
  const movement = getPriceMovement(product.current_price, comparison?.price ?? null);
  return movement.direction === "down" ? movement.absoluteChange : -Infinity;
}


function nullablePrice(value: number | null, fallback: number): number {
  return value === null ? fallback : value;
}
