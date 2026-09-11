/**
 * File: utils/priceMovement.ts
 * Purpose:
 *   Provides one shared calculation for accepted price movement so product cards,
 *   detail statistics, filters and history views can use the same up/down/unchanged
 *   semantics without storing derived movement fields in history JSON.
 *
 * Main functions:
 *   - getPriceMovement(current, previous): calculates direction, signed difference
 *     and signed percentage change between two accepted prices.
 *
 * Inputs:
 *   Current and previous numeric prices. Either value may be null/undefined when
 *   no accepted comparison is available.
 *
 * Outputs:
 *   A PriceMovement object with direction, difference and percentage. Missing
 *   comparisons return direction="unavailable" rather than inventing a movement.
 */

import { numbersEqual } from "@/utils/price";

export type PriceMovementDirection =
  | "up"
  | "down"
  | "unchanged"
  | "unavailable";

export interface PriceMovement {
  direction: PriceMovementDirection;
  difference: number | null;
  percentage: number | null;
}

export function getPriceMovement(
  current: number | null | undefined,
  previous: number | null | undefined,
): PriceMovement {
  if (current == null || previous == null) {
    return {
      direction: "unavailable",
      difference: null,
      percentage: null,
    };
  }

  const difference = current - previous;

  if (numbersEqual(current, previous)) {
    return {
      direction: "unchanged",
      difference: 0,
      percentage: 0,
    };
  }

  return {
    direction: difference > 0 ? "up" : "down",
    difference,
    percentage:
      previous === 0
        ? null
        : (difference / previous) * 100,
  };
}
