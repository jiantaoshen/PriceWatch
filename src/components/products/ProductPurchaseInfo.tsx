/**
 * File: components/products/ProductPurchaseInfo.tsx
 * Purpose:
 *   Displays the user's latest purchase reference in one compact line without
 *   creating a purchase-history section or permanent "Owned" state.
 *
 * Main function:
 *   - ProductPurchaseInfo({ product }): renders last purchase price/date if present.
 *
 * Inputs:
 *   Product.last_purchase_price/date and currency.
 *
 * Outputs:
 *   Lightweight read-only text for product card/header surfaces.
 */

import { ShoppingBag } from "lucide-react";

import { formatPrice } from "@/utils/price";

import type { Product } from "@/types/product";


export function ProductPurchaseInfo({ product }: { product: Product }) {
  if (product.last_purchase_price === null && product.last_purchase_date === null) {
    return null;
  }

  const price = product.last_purchase_price !== null
    ? `${formatPrice(product.last_purchase_price)} ${product.currency}`
    : "price not recorded";

  const date = formatDate(product.last_purchase_date);

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <ShoppingBag className="size-3.5 shrink-0" />
      <span className="truncate">
        Last bought {price}{date ? ` · ${date}` : ""}
      </span>
    </span>
  );
}


function formatDate(value: string | null): string {
  if (!value) return "";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
