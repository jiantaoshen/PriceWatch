/**
 * File: components/products/ProductSummary.tsx
 * Purpose:
 *   Gives a price-focused overview of the complete saved-product library.
 *   Lifecycle counts live in ProductCollectionTabs, while these cards continue
 *   showing the PriceWatch signals that matter across every saved product.
 *
 * Main function:
 *   - ProductSummary({ products }): computes and renders dashboard price metrics.
 *
 * Inputs:
 *   All merged Product records.
 *
 * Outputs:
 *   Four read-only summary cards: saved products, total targets, unit targets and drops.
 */

import { Package, Target, TrendingDown, Weight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { LucideIcon } from "lucide-react";
import type { Product } from "@/types/product";


interface ProductSummaryProps {
  products: Product[];
}

interface SummaryItem {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
}


export function ProductSummary({ products }: ProductSummaryProps) {
  const items: SummaryItem[] = [
    {
      title: "Saved",
      value: products.length,
      subtitle: "Across all lifecycle states",
      icon: Package,
    },
    {
      title: "Total Target",
      value: products.filter(product => product.below_target === true).length,
      subtitle: "Below target",
      icon: Target,
    },
    {
      title: "Unit Target",
      value: products.filter(product => product.unit_below_target === true).length,
      subtitle: "Below unit target",
      icon: Weight,
    },
    {
      title: "Price Drops",
      value: products.filter(product => {
        const current = product.current_price;
        const previous = product.previous_price;

        return current !== null && previous !== null && current < previous;
      }).length,
      subtitle: "Since last check",
      icon: TrendingDown,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(item => (
        <SummaryCard key={item.title} {...item} />
      ))}
    </div>
  );
}


function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: SummaryItem) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
