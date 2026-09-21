"use client";

import {
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemSort } from "@/lib/item-list";

const sortOptions: Array<{
  value: ItemSort;
  label: string;
}> = [
  { value: "name", label: "Name" },
  { value: "current-price", label: "Current price" },
  { value: "target-gap", label: "Target gap" },
  { value: "last-checked", label: "Last checked" },
];

export function ItemListToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  searchPlaceholder,
  actionLabel,
  actionHref = "/items/new",
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: ItemSort;
  onSortChange: (value: ItemSort) => void;
  searchPlaceholder: string;
  actionLabel: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={search}
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="hidden size-4 text-muted-foreground sm:block" />

        <Select
          value={sort}
          onValueChange={(value) =>
            onSortChange(value as ItemSort)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Link
          href={actionHref}
          className={buttonVariants()}
        >
          <Plus className="size-4" />
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
