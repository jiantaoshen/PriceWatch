/**
 * File: services/productConfigApi.ts
 * Purpose:
 *   Typed frontend client for scraper-oriented product configuration plus the
 *   lightweight purchase/archive lifecycle. Subscriptions are intentionally
 *   handled by a separate service and API.
 *
 * Main functions:
 *   - fetchProductConfigs(): load active + archived products.
 *   - fetchProductConfig(id): load one product config.
 *   - createProductConfig(input): create an active tracked product.
 *   - updateProductConfig(id, input): update scraper settings only.
 *   - recordProductPurchase(id, input): save the latest purchase reference.
 *   - archiveProduct(id): move a product to Archived.
 *   - restoreProduct(id): return an archived product to active tracking.
 *   - deleteProductConfig(id): permanently delete a product.
 *
 * Inputs:
 *   ProductConfigInput for scraper settings and RecordProductPurchaseInput for
 *   purchase/archive actions.
 *
 * Outputs:
 *   Current-schema ProductConfig objects using snake_case API field names.
 */

import { apiJson, jsonRequest } from "@/services/api";


const PRODUCTS_URL = "/api/product-config";


export interface ProductSource {
  store: string;
  url: string;
  scraping_enabled: boolean;
  manual_price: number | null;
  unit_quantity: number | null;
  note: string | null;
}


export interface ProductConfig {
  id: string;
  name: string;
  scraping_enabled: boolean;
  comparison_quantity: number | null;
  sources: ProductSource[];
  target_price: number;
  target_unit_price: number | null;
  unit: string | null;
  currency: string;

  last_purchase_price: number | null;
  last_purchase_date: string | null;
  archived_at: string | null;
}


export interface ProductSourceInput {
  store: string;
  url: string;
  scraping_enabled: boolean;
  manual_price: number | null;
  unit_quantity: number | null;
  note: string | null;
}


export interface ProductConfigInput {
  name: string;
  scraping_enabled: boolean;
  comparison_quantity: number | null;
  sources: ProductSourceInput[];
  target_price: number;
  target_unit_price: number | null;
  unit: string | null;
  currency: string;
}


export interface RecordProductPurchaseInput {
  last_purchase_price: number | null;
  last_purchase_date: string | null;
  archive_after_purchase: boolean;
}


export async function fetchProductConfigs(): Promise<ProductConfig[]> {
  const products = await apiJson<ProductConfig[]>(PRODUCTS_URL, {
    cache: "no-store",
  });

  if (!Array.isArray(products)) {
    throw new Error("Invalid product configuration response.");
  }

  return products;
}


export async function fetchProductConfig(id: string): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
}


export async function createProductConfig(
  input: ProductConfigInput,
): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    PRODUCTS_URL,
    jsonRequest("POST", input),
  );
}


export async function updateProductConfig(
  id: string,
  input: ProductConfigInput,
): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    jsonRequest("PUT", input),
  );
}


export async function recordProductPurchase(
  id: string,
  input: RecordProductPurchaseInput,
): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/purchase`,
    jsonRequest("POST", input),
  );
}


export async function archiveProduct(id: string): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/archive`,
    jsonRequest("POST", {}),
  );
}


export async function restoreProduct(id: string): Promise<ProductConfig> {
  return await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/restore`,
    jsonRequest("POST", {}),
  );
}


export async function deleteProductConfig(id: string): Promise<void> {
  await apiJson<void>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
