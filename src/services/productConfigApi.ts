/**
 * File: services/productConfigApi.ts
 * Purpose:
 *   Typed frontend client for product configuration and product lifecycle APIs.
 *   Normal add/edit requests remain scraper-only; ownership/subscription changes
 *   use dedicated action endpoints so lifecycle data cannot be erased by editing.
 *
 * Main functions:
 *   - fetchProductConfigs(): load all saved products.
 *   - fetchProductConfig(id): load one saved product for the edit dialog.
 *   - createProductConfig(input): create a tracked product.
 *   - updateProductConfig(id, input): update scraper settings only.
 *   - markProductOwned(id, input): mark a product as purchased.
 *   - markProductSubscription(id, input): mark a product as a subscription.
 *   - markProductTracked(id): clear lifecycle data and return to tracking-only.
 *   - deleteProductConfig(id): delete the saved product.
 *
 * Inputs:
 *   ProductConfigInput for scraper settings and small lifecycle action payloads.
 *
 * Outputs:
 *   Normalized ProductConfig objects using snake_case API field names.
 */

import { apiJson, jsonRequest } from "@/services/api";


const PRODUCTS_URL = "/api/product-config";


export type SavedType = "tracked" | "owned" | "subscription";
export type BillingInterval = "weekly" | "monthly" | "quarterly" | "yearly";


export interface ProductSource {
  store: string;
  url: string;
  scraping_enabled?: boolean;
  manual_price?: number | null;
  unit_quantity: number | null;
  note: string | null;
}


export interface ProductConfig {
  id: string;
  name: string;
  saved_type: SavedType;
  scraping_enabled?: boolean;
  comparison_quantity?: number | null;
  sources: ProductSource[];
  target_price: number;
  target_unit_price: number | null;
  unit: string | null;
  currency: string;

  purchase_price: number | null;
  purchase_date: string | null;

  subscription_price: number | null;
  billing_interval: BillingInterval | null;
  next_billing_date: string | null;

  // Legacy compatibility only.
  url?: string;
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


export interface MarkProductOwnedInput {
  purchase_price: number | null;
  purchase_date: string | null;
}


export interface MarkSubscriptionInput {
  subscription_price: number | null;
  billing_interval: BillingInterval | null;
  next_billing_date: string | null;
}


export async function fetchProductConfigs(): Promise<ProductConfig[]> {
  const products = await apiJson<ProductConfig[]>(PRODUCTS_URL, {
    cache: "no-store",
  });

  if (!Array.isArray(products)) {
    throw new Error("Invalid product configuration response.");
  }

  return products.map(normalizeProduct);
}


export async function fetchProductConfig(id: string): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );

  return normalizeProduct(product);
}


export async function createProductConfig(
  input: ProductConfigInput,
): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    PRODUCTS_URL,
    jsonRequest("POST", input),
  );

  return normalizeProduct(product);
}


export async function updateProductConfig(
  id: string,
  input: ProductConfigInput,
): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    jsonRequest("PUT", input),
  );

  return normalizeProduct(product);
}


export async function markProductOwned(
  id: string,
  input: MarkProductOwnedInput,
): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/mark-owned`,
    jsonRequest("POST", input),
  );

  return normalizeProduct(product);
}


export async function markProductSubscription(
  id: string,
  input: MarkSubscriptionInput,
): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/mark-subscription`,
    jsonRequest("POST", input),
  );

  return normalizeProduct(product);
}


export async function markProductTracked(id: string): Promise<ProductConfig> {
  const product = await apiJson<ProductConfig>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}/mark-tracked`,
    jsonRequest("POST", {}),
  );

  return normalizeProduct(product);
}


export async function deleteProductConfig(id: string): Promise<void> {
  await apiJson<void>(
    `${PRODUCTS_URL}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}


function normalizeProduct(product: ProductConfig): ProductConfig {
  const raw = product as ProductConfig & {
    Id?: string;
    product_id?: string;
    productId?: string;
    savedType?: SavedType;
  };

  const id =
    product.id ??
    raw.Id ??
    raw.product_id ??
    raw.productId;

  if (!id) {
    throw new Error(`Product "${product.name}" has no ID.`);
  }

  return {
    ...product,
    id,
    saved_type: product.saved_type ?? raw.savedType ?? "tracked",
    purchase_price: product.purchase_price ?? null,
    purchase_date: product.purchase_date ?? null,
    subscription_price: product.subscription_price ?? null,
    billing_interval: product.billing_interval ?? null,
    next_billing_date: product.next_billing_date ?? null,
  };
}
