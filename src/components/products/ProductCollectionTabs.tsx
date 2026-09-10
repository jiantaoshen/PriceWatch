/**
 * File: components/products/ProductCollectionTabs.tsx
 * Purpose:
 *   Provides the main lifecycle navigation for the PriceWatch product library.
 *   Users can switch between all saved products, tracking-only products, owned
 *   products and subscriptions without leaving the price-tracking dashboard.
 *
 * Main function:
 *   - ProductCollectionTabs(props): renders four lifecycle scope buttons with counts.
 *
 * Inputs:
 *   Current ProductCollection value, all merged Product records, and a change callback.
 *
 * Outputs:
 *   Calls onChange(nextCollection) when the user selects a lifecycle scope.
 */

import { Eye, Layers3, PackageCheck, Repeat2 } from "lucide-react";

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
  const counts = {
    all: products.length,
    tracked: products.filter(product => product.saved_type === "tracked").length,
    owned: products.filter(product => product.saved_type === "owned").length,
    subscription: products.filter(product => product.saved_type === "subscription").length,
  };

  const items: {
    value: ProductCollection;
    label: string;
    count: number;
    icon: typeof Layers3;
  }[] = [
    { value: "all", label: "All", count: counts.all, icon: Layers3 },
    { value: "tracked", label: "Tracking", count: counts.tracked, icon: Eye },
    { value: "owned", label: "Owned", count: counts.owned, icon: PackageCheck },
    { value: "subscription", label: "Subscriptions", count: counts.subscription, icon: Repeat2 },
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
