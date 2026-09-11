/**
 * File: utils/historyComparison.ts
 * Purpose:
 *   Resolves the dashboard/detail movement baseline from compact accepted history.
 *   Recent movement intentionally compares the current accepted scraper price with
 *   the newest OLDER history period, never with latest.previous_price from the
 *   immediately preceding scraper attempt.
 *
 * Main functions:
 *   - getRecentHistoryComparison(productId, history, currentPeriod): finds the
 *     newest historical result for the product whose period is older than the
 *     current latest period.
 *
 * Inputs:
 *   - productId: stable ProductConfig/product_id identifier.
 *   - history: compact HistoryDataFile[] loaded from /api/history/{period}.
 *   - currentPeriod: latest.json period (ISO date, for example 2026-09-07).
 *
 * Outputs:
 *   - RecentHistoryComparison containing the matched history period, total price
 *     and unit price. Null values mean no older accepted history is available.
 */

import type { HistoryDataFile } from "@/types/product";


export interface RecentHistoryComparison {
  period: string | null;
  price: number | null;
  unitPrice: number | null;
}


const EMPTY_COMPARISON: RecentHistoryComparison = {
  period: null,
  price: null,
  unitPrice: null,
};


export function getRecentHistoryComparison(
  productId: string,
  history: HistoryDataFile[],
  currentPeriod: string,
): RecentHistoryComparison {
  const orderedHistory = [...history].sort(
    (a, b) => b.period.localeCompare(a.period),
  );

  for (const snapshot of orderedHistory) {
    // History for the same current weekly period is updated by the latest scraper
    // run, so comparing against it would usually compare the current price to itself.
    // Recent movement therefore uses the newest strictly older period.
    if (currentPeriod && snapshot.period >= currentPeriod) {
      continue;
    }

    const entry = snapshot.data.find(
      candidate => candidate.product_id === productId,
    );

    if (!entry) continue;

    return {
      period: snapshot.period,
      price: entry.current_price,
      unitPrice: entry.current_unit_price ?? null,
    };
  }

  return EMPTY_COMPARISON;
}
