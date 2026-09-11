/**
 * File: components/products/ProductSummary.tsx
 * Purpose:
 *   Shows price-focused metrics for ACTIVE products only. Archived products are
 *   kept as a separate library and do not affect current target/review/movement counts.
 *
 * Main functions:
 *   - ProductSummary({ products, history, currentPeriod }): computes active metrics.
 *   - SummaryCard(props): renders one read-only dashboard metric card.
 *
 * Inputs:
 *   All merged products, compact history snapshots and current latest period.
 *
 * Outputs:
 *   Active, Archived, Total Target, Needs Review, Price Drops and Price Increases.
 */

import {
  AlertTriangle,
  Archive,
  Radar,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { getRecentHistoryComparison } from "@/utils/historyComparison";
import { getPriceMovement } from "@/utils/priceMovement";

import type { LucideIcon } from "lucide-react";
import type { HistoryDataFile, Product } from "@/types/product";


interface ProductSummaryProps {
  products: Product[];
  history: HistoryDataFile[];
  currentPeriod: string;
}

interface SummaryItem {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
}


export function ProductSummary({
  products,
  history,
  currentPeriod,
}: ProductSummaryProps) {
  const activeProducts = products.filter(product => product.archived_at === null);
  const archivedCount = products.length - activeProducts.length;
  const successfulProducts = activeProducts.filter(product => product.status === "success");

  const movementDirections = successfulProducts.map(product => {
    const comparison = getRecentHistoryComparison(
      product.product_id,
      history,
      currentPeriod,
    );

    return getPriceMovement(product.current_price, comparison.price).direction;
  });

  const items: SummaryItem[] = [
    {
      title: "Active",
      value: activeProducts.length,
      subtitle: "Currently tracked",
      icon: Radar,
    },
    {
      title: "Archived",
      value: archivedCount,
      subtitle: "No longer scraped",
      icon: Archive,
    },
    {
      title: "Total Target",
      value: activeProducts.filter(product => product.below_target === true).length,
      subtitle: "Below target",
      icon: Target,
    },
    {
      title: "Needs Review",
      value: activeProducts.filter(product =>
        product.status === "suspicious" || product.status === "failed"
      ).length,
      subtitle: "Suspicious or unavailable",
      icon: AlertTriangle,
    },
    {
      title: "Price Drops",
      value: movementDirections.filter(direction => direction === "down").length,
      subtitle: "Vs recent history",
      icon: TrendingDown,
    },
    {
      title: "Price Increases",
      value: movementDirections.filter(direction => direction === "up").length,
      subtitle: "Vs recent history",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
