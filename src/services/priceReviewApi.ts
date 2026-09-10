/**
 * File: services/priceReviewApi.ts
 * Purpose:
 *   Typed client for resolving suspicious/unavailable prices from the product
 *   detail page without weakening the scraper's anomaly detection.
 *
 * Main functions:
 *   - acceptSuspiciousPrice(id): trust the currently detected suspicious price.
 *   - setManualSourcePrice(id, input): switch one source to persistent manual mode.
 *
 * Inputs:
 *   Product ID and, for manual mode, source URL + actual package price.
 *
 * Outputs:
 *   API mutation result. The caller refreshes dashboard/latest data afterwards.
 */

import { apiJson, jsonRequest } from "@/services/api";

import type { ProductConfig } from "@/services/productConfigApi";


const PRODUCTS_URL = "/api/product-config";


export interface SetManualSourcePriceInput {
  source_url: string;
  manual_price: number;
}


export async function acceptSuspiciousPrice(id: string): Promise<void> {
  await apiJson<unknown>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/price-review/accept`,
    jsonRequest("POST", {}),
  );
}


export function setManualSourcePrice(
  id: string,
  input: SetManualSourcePriceInput,
): Promise<ProductConfig> {
  return apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/price-review/manual`,
    jsonRequest("POST", input),
  );
}
