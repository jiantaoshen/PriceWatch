/**
 * File: components/products/ProductLifecycleSummary.tsx
 * Purpose:
 *   Shows the lifecycle information that matters after a product becomes Owned
 *   or Subscription, without replacing the normal PriceWatch price statistics,
 *   offers and history experience.
 *
 * Main function:
 *   - ProductLifecycleSummary({ product }): renders an Owned or Subscription panel.
 *
 * Inputs:
 *   A merged Product containing saved_type plus optional purchase/subscription data.
 *
 * Outputs:
 *   A compact lifecycle Card for Owned/Subscription products; null for Tracked products.
 */

import { PackageCheck, Repeat2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import {
  formatBillingInterval,
  formatBillingSuffix,
  formatLifecycleDate,
} from "@/utils/lifecycle";
import { formatPrice } from "@/utils/price";

import type { Product } from "@/types/product";


interface ProductLifecycleSummaryProps {
  product: Product;
}


export function ProductLifecycleSummary({ product }: ProductLifecycleSummaryProps) {
  if (product.saved_type === "tracked") return null;

  if (product.saved_type === "owned") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(0,1fr))] lg:items-center">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <PackageCheck className="size-4" />
            </div>

            <div>
              <p className="font-medium">Owned product</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Your purchase is saved separately from scraper prices, so PriceWatch can keep monitoring the market after you buy.
              </p>
            </div>
          </div>

          <LifecycleValue
            label="Purchase price"
            value={
              product.purchase_price !== null
                ? `${formatPrice(product.purchase_price)} ${product.currency}`
                : "Not recorded"
            }
          />

          <LifecycleValue
            label="Purchase date"
            value={formatLifecycleDate(product.purchase_date)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Repeat2 className="size-4" />
          </div>

          <div>
            <p className="font-medium">Subscription</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              What you actually pay is kept separate from the public price being scraped and tracked.
            </p>
          </div>
        </div>

        <LifecycleValue
          label="You pay"
          value={
            product.subscription_price !== null
              ? `${formatPrice(product.subscription_price)} ${product.currency}${formatBillingSuffix(product.billing_interval)}`
              : "Not recorded"
          }
        />

        <LifecycleValue
          label="Billing"
          value={formatBillingInterval(product.billing_interval)}
        />

        <LifecycleValue
          label="Next billing"
          value={formatLifecycleDate(product.next_billing_date)}
        />
      </CardContent>
    </Card>
  );
}


function LifecycleValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium tabular-nums">{value}</p>
    </div>
  );
}
