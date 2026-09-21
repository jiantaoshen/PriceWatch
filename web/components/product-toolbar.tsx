"use client";

import { ItemListToolbar } from "@/components/item-list-toolbar";
import type { ItemSort } from "@/lib/item-list";

export type ProductSort = ItemSort;

export function ProductToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: ProductSort;
  onSortChange: (value: ProductSort) => void;
}) {
  return (
    <ItemListToolbar
      search={search}
      onSearchChange={onSearchChange}
      sort={sort}
      onSortChange={onSortChange}
      searchPlaceholder="Search products or stores…"
      actionLabel="Add product"
    />
  );
}
