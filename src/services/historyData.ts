/**
 * File: services/historyData.ts
 * Purpose:
 *   Loads the compact accepted-price history used for charts and statistics.
 *   History intentionally contains no product names, offers, targets or scraper status.
 *
 * Main functions:
 *   - fetchHistoryIndex(): load available history period IDs.
 *   - fetchHistoryPeriod(period): load one compact HistoryDataFile.
 *
 * Inputs:
 *   Optional history period string for fetchHistoryPeriod().
 *
 * Outputs:
 *   Promise<HistoryIndex> or Promise<HistoryDataFile>.
 */

import { apiJson, apiJsonOr } from "@/services/api";

import type { HistoryDataFile, HistoryIndex } from "@/types/product";


const HISTORY_URL = "/api/history";


export function fetchHistoryIndex(): Promise<HistoryIndex> {
  return apiJsonOr<HistoryIndex>(HISTORY_URL, { periods: [] });
}


export function fetchHistoryPeriod(period: string): Promise<HistoryDataFile> {
  return apiJson<HistoryDataFile>(
    `${HISTORY_URL}/${encodeURIComponent(period)}`,
    { cache: "no-store" },
  );
}
