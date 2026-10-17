"use client";

import Link from "next/link";
import { buttonVariants } from "@pricewatch/ui/button";
import { Input } from "@pricewatch/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ItemListToolbar<TSort extends string>({
  search,
  onSearchChange,
  sort,
  onSortChange,
  sortOptions,
  searchPlaceholder,
  actionLabel,
  actionHref,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: TSort;
  onSortChange: (value: TSort) => void;
  sortOptions: ReadonlyArray<{ value: TSort; label: string }>;
  searchPlaceholder: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="flex-1"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(value) => onSortChange(value as TSort)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Link href={actionHref} className={buttonVariants()}>
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
