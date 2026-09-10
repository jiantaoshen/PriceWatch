/**
 * File: components/products/ProductLifecycleCardInfo.tsx
 * Purpose:
 *   Adds lifecycle-specific context to a dashboard card while keeping price
 *   tracking as the main card content. Tracked products show recent price
 *   movement; Owned and Subscription products show the small amount of saved
 *   lifecycle information that matters at a glance.
 *
 * Main function:
 *   - ProductLifecycleCardInfo({ product }): renders one compact card status row.
 *
 * Inputs:
 *   A merged Product containing scraper prices and lifecycle fields.
 *
 * Outputs:
 *   Display-only lifecycle or price-change information.
 */

import { CalendarClock, PackageCheck, Repeat2, TrendingDown } from "lucide-react";

import { formatLifecycleDate, formatBillingSuffix } from "@/utils/lifecycle";
import { formatPrice } from "@/utils/price";

import type { Product } from "@/types/product";


interface ProductLifecycleCardInfoProps {
  product: Product;
}


export function ProductLifecycleCardInfo({ product }: ProductLifecycleCardInfoProps) {
  if (product.saved_type === "owned") {
    const purchaseText = product.purchase_price !== null
      ? `${formatPrice(product.purchase_price)} ${product.currency}`
      : "Price not recorded";

    const dateText = product.purchase_date
      ? formatLifecycleDate(product.purchase_date)
      : "Date not recorded";

    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <PackageCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            Bought for {purchaseText}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {dateText} · price tracking continues
          </p>
        </div>
      </div>
    );
  }

  if (product.saved_type === "subscription") {
    const paidText = product.subscription_price !== null
      ? `${formatPrice(product.subscription_price)} ${product.currency}${formatBillingSuffix(product.billing_interval)}`
      : "Payment not recorded";

    const nextText = product.next_billing_date
      ? `Next ${formatLifecycleDate(product.next_billing_date)}`
      : "Next billing not recorded";

    return (
      <div className="flex min-w-0 items-start gap-2.5">
        {product.next_billing_date ? (
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Repeat2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">You pay {paidText}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {nextText}
          </p>
        </div>
      </div>
    );
  }

  const current = product.current_price;
  const previous = product.previous_price;
  const hasDrop =
    product.status !== "not_run" &&
    current !== null &&
    previous !== null &&
    current < previous;

  if (hasDrop) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="size-3.5" />
        <span>
          {formatPrice(previous - current)} {product.currency} since last check
        </span>
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground/70">
      {product.status === "not_run"
        ? "Run scraper to get the first price"
        : "No recent price drop"}
    </span>
  );
}
