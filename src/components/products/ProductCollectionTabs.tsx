/**
 * File: components/products/ProductCollectionTabs.tsx
 * Purpose:
 *   Switches the product dashboard between active PriceWatch items and archived
 *   products. Subscriptions are intentionally not part of this product collection.
 *
 * Main function:
 *   - ProductCollectionTabs(props): renders Active / Archived tabs with counts.
 *
 * Inputs:
 *   Current ProductCollection, all merged Product records and onChange callback.
 *
 * Outputs:
 *   Calls onChange(nextCollection) when the user selects a product scope.
 */

import { Archive, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ProductCollection } from "@/hooks/useProductList";
import type { Product } from "@/types/product";


interface ProductCollectionTabsProps {
  value: ProductCollection;
  products: Product[];
  onChange: (value: ProductCollection) => void;
}


export function ProductCollectionTabs({
  value,
  products,
  onChange,
}: ProductCollectionTabsProps) {
  const activeCount = products.filter(product => product.archived_at === null).length;
  const archivedCount = products.length - activeCount;

  const items = [
    { value: "active" as const, label: "Active", count: activeCount, icon: Radar },
    { value: "archived" as const, label: "Archived", count: archivedCount, icon: Archive },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/25 p-2">
      {items.map(item => {
        const Icon = item.icon;
        const active = value === item.value;

        return (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={active ? "secondary" : "ghost"}
            className={active ? "shadow-sm" : "text-muted-foreground"}
            onClick={() => onChange(item.value)}
          >
            <Icon data-icon="inline-start" />
            {item.label}
            <span className="ml-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
