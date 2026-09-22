"use client";

import { Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@pricewatch/ui/button";
import { Input } from "@pricewatch/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemSort } from "@/lib/item-list";

export type SubscriptionSort = Extract<
  ItemSort,
  "name" | "current-price"
>;

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
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search subscriptions…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="hidden size-4 text-muted-foreground sm:block" />

        <Select
          value={sort}
          onValueChange={(value) => onSortChange(value as SubscriptionSort)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="name">
              Name
            </SelectItem>

            <SelectItem value="current-price">
              Monthly price
            </SelectItem>
          </SelectContent>
        </Select>

        <Link
          href="/subscriptions/new"
          className={buttonVariants()}
        >
          <Plus className="size-4" />
          Add subscription
        </Link>
      </div>
    </div>
  );
}