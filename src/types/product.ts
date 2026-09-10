/**
 * File: types/product.ts
 * Purpose:
 *   Defines frontend product data returned by scraper snapshots after it has been
 *   merged with persistent ProductConfig lifecycle data.
 *
 * Main types:
 *   - ProductOffer: one store offer from the scraper.
 *   - Product: dashboard/detail product including price + lifecycle fields.
 *   - LatestDataFile: full latest scraper snapshot used by dashboard/detail UI.
 *   - PriceHistoryEntry / HistoryDataFile: compact accepted price time series.
 *   - HistoryIndex: available history periods.
 *
 * Inputs:
 *   /api/latest (full scraper state), /api/history (compact price history),
 *   and /api/product-config responses.
 *
 * Outputs:
 *   Shared TypeScript types used by product cards, details, history and AI picker.
 */

import type { BillingInterval, SavedType } from "@/services/productConfigApi";


export interface ProductOffer {
  store: string;
  url: string;
  price: number;
  price_source: "scrape" | "manual";
  unit_quantity: number | null;
  comparison_price: number | null;
  unit_price: number | null;
  note: string | null;
}


export interface ProductError {
  type: string;
  message: string;
}


export interface Product {
  product_id: string;
  name: string;

  // Cheapest total / comparison-total winner.
  url: string;
  store: string | null;
  target_price: number;
  current_price: number | null;
  previous_price: number | null;
  below_target: boolean | null;
  difference: number | null;

  // Cheapest unit-price winner. It may come from a different source.
  unit: string | null;
  unit_url: string | null;
  unit_store: string | null;
  target_unit_price: number | null;
  current_unit_price: number | null;
  previous_unit_price: number | null;
  unit_below_target: boolean | null;
  unit_difference: number | null;

  // Scraper / comparison configuration.
  comparison_quantity: number | null;
  currency: string;
  offers: ProductOffer[];
  error: ProductError | null;

  // Audit fields emitted by the current scraper schema.
  reviewed_by_user: boolean;
  review_method: "confirmed" | "manual" | null;
  reviewed_at: string | null;

  status:
    | "not_run"
    | "success"
    | "failed"
    | "suspicious";

  // User lifecycle data merged from ProductConfig.
  saved_type: SavedType;
  purchase_price: number | null;
  purchase_date: string | null;
  subscription_price: number | null;
  billing_interval: BillingInterval | null;
  next_billing_date: string | null;
}


export interface LatestDataFile {
  period: string;
  generated_at: string;
  data: Product[];
}


export interface PriceHistoryEntry {
  product_id: string;
  current_price: number;
  current_unit_price: number | null;
}


export interface HistoryDataFile {
  period: string;
  generated_at: string;
  data: PriceHistoryEntry[];
}


export interface HistoryIndex {
  periods: string[];
}
