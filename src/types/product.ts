/**
 * File: types/product.ts
 * Purpose:
 *   Defines scraper product data after it has been merged with persistent
 *   ProductConfig purchase/archive context. Subscription types do not live here.
 *
 * Main types:
 *   - ProductOffer: one source offer from latest.json.
 *   - Product: dashboard/detail product with price + last-purchase/archive fields.
 *   - LatestDataFile: latest scraper attempt snapshot.
 *   - PriceHistoryEntry / HistoryDataFile: compact accepted price history.
 *   - HistoryIndex: available history periods.
 *
 * Inputs:
 *   /api/latest, /api/history and /api/product-config responses.
 *
 * Outputs:
 *   Shared frontend product types used by dashboard, detail and AI picker.
 */


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

  url: string;
  store: string | null;
  target_price: number;
  current_price: number | null;
  previous_price: number | null;
  below_target: boolean | null;
  difference: number | null;

  unit: string | null;
  unit_url: string | null;
  unit_store: string | null;
  target_unit_price: number | null;
  current_unit_price: number | null;
  previous_unit_price: number | null;
  unit_below_target: boolean | null;
  unit_difference: number | null;

  comparison_quantity: number | null;
  currency: string;
  offers: ProductOffer[];
  error: ProductError | null;

  reviewed_by_user: boolean;
  review_method: "confirmed" | "manual" | null;
  reviewed_at: string | null;

  status:
    | "not_run"
    | "success"
    | "failed"
    | "suspicious";

  // Lightweight user context from ProductConfig.
  last_purchase_price: number | null;
  last_purchase_date: string | null;
  archived_at: string | null;
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
