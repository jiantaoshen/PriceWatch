/**
 * File: components/products/ProductPriceMovement.tsx
 * Purpose:
 *   Renders a consistent accepted-price movement indicator for total and unit
 *   prices. It visually distinguishes increases, decreases and unchanged prices.
 *
 * Main function:
 *   - ProductPriceMovement(props): displays the movement between current and
 *     previous accepted prices, including amount and percentage when available.
 *
 * Inputs:
 *   current, previous, currency, optional unit, compact display flag, and optional
 *   empty-state text.
 *
 * Outputs:
 *   Read-only inline UI. No price is calculated or persisted outside the shared
 *   getPriceMovement utility.
 */

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { formatPrice } from "@/utils/price";
import { getPriceMovement } from "@/utils/priceMovement";


interface ProductPriceMovementProps {
  current: number | null | undefined;
  previous: number | null | undefined;
  currency: string;
  unit?: string | null;
  compact?: boolean;
  emptyLabel?: string;
}


export function ProductPriceMovement({
  current,
  previous,
  currency,
  unit = null,
  compact = false,
  emptyLabel = "No previous price",
}: ProductPriceMovementProps) {
  const movement = getPriceMovement(current, previous);

  if (movement.direction === "unavailable") {
    return (
      <span className="text-[11px] text-muted-foreground/60">
        {emptyLabel}
      </span>
    );
  }

  if (movement.direction === "unchanged") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="size-3" />
        {compact ? "No change" : "No change since last check"}
      </span>
    );
  }

  const difference = Math.abs(movement.difference ?? 0);
  const percentage = movement.percentage == null
    ? null
    : Math.abs(movement.percentage);
  const priceDecimals = unit ? 4 : 2;
  const amountText = `${formatPrice(difference, priceDecimals)} ${currency}${unit ? `/${unit}` : ""}`;
  const percentageText = percentage == null
    ? ""
    : ` (${percentage.toLocaleString("sv-SE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%)`;
  const suffix = compact ? "" : " since last check";

  if (movement.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="size-3" />
        <span>{amountText}{percentageText}{suffix}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
      <TrendingUp className="size-3" />
      <span>{amountText}{percentageText}{suffix}</span>
    </span>
  );
}
