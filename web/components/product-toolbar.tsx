"use client";

import {
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  buttonVariants,
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductSort =
  | "name"
  | "current-price"
  | "target-gap"
  | "last-checked";

export function ProductToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: ProductSort;
  onSortChange:
    (value: ProductSort) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={search}
          onChange={(event) =>
            onSearchChange(
              event.target.value
            )
          }
          placeholder="Search products or stores…"
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <SlidersHorizontal className="hidden size-4 text-muted-foreground sm:block" />

        <Select
          value={sort}
          onValueChange={(value) =>
            onSortChange(
              value as ProductSort
            )
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="name">
              Name
            </SelectItem>

            <SelectItem value="current-price">
              Current price
            </SelectItem>

            <SelectItem value="target-gap">
              Target gap
            </SelectItem>

            <SelectItem value="last-checked">
              Last checked
            </SelectItem>
          </SelectContent>
        </Select>

        <Link
          href="/"
          className={buttonVariants()}
        >
          Products
        </Link>
      </div>
    </div>
  );
}
