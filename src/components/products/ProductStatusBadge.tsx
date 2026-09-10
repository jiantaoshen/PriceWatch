/**
 * File: components/products/ProductStatusBadge.tsx
 * Purpose:
 *   Shows scraper result state without confusing suspicious/failed products with
 *   products that have never run. Reviewable states use explicit user-facing text.
 *
 * Main function:
 *   - ProductStatusBadge({ status }): maps scraper status to a compact badge.
 *
 * Inputs:
 *   Product.status from latest.json / merged dashboard data.
 *
 * Outputs:
 *   A status badge, or null for normal successful results.
 */

import { AlertTriangle, CircleOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { Product } from "@/types/product";


interface ProductStatusBadgeProps {
  status: Product["status"];
}


export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  if (status === "not_run") {
    return (
      <Badge variant="outline" className="shrink-0 text-muted-foreground">
        Not run yet
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="shrink-0 gap-1">
        <CircleOff className="size-3" />
        Price unavailable
      </Badge>
    );
  }

  if (status === "suspicious") {
    return (
      <Badge variant="outline" className="shrink-0 gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3" />
        Review price
      </Badge>
    );
  }

  return null;
}
