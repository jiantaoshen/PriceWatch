"use client";

import { ItemListToolbar } from "@/components/item-list-toolbar";
import type { ItemSort } from "@/lib/item-list";

export type SubscriptionSort = ItemSort;

export function SubscriptionToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SubscriptionSort;
  onSortChange: (value: SubscriptionSort) => void;
}) {
  return (
    <ItemListToolbar
      search={search}
      onSearchChange={onSearchChange}
      sort={sort}
      onSortChange={onSortChange}
      searchPlaceholder="Search subscriptions or providers…"
      actionLabel="Add subscription"
    />
  );
}
