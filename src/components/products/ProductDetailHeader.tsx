/**
 * File: components/products/ProductDetailHeader.tsx
 * Purpose:
 *   Renders the product detail page header, scraper status, lifecycle badge,
 *   winner store information, current price and all product actions.
 *
 * Main function:
 *   - ProductDetailHeader(props): detail header UI.
 *
 * Inputs:
 *   Merged Product plus navigation/refresh/Ask AI callbacks.
 *
 * Outputs:
 *   Header UI and action callbacks to ProductDetail.
 */

import { ArrowLeft, ExternalLink, Store } from "lucide-react";

import { ProductDetailActions } from "@/components/products/ProductDetailActions";
import { ProductLifecycleBadge } from "@/components/products/ProductLifecycleBadge";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";

import { formatPrice } from "@/utils/price";

import type { Product } from "@/types/product";


interface ProductDetailHeaderProps {
  product: Product;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
  onAskAi: () => void;
}


export function ProductDetailHeader({
  product,
  onBack,
  onRefresh,
  onAskAi,
}: ProductDetailHeaderProps) {
  const offers = product.offers ?? [];
  const totalStore = product.store ?? null;
  const unitStore = product.unit_store ?? null;
  const unit = product.unit ?? null;
  const isNotRun = product.status === "not_run";


  async function handleDeleted() {
    await onRefresh();
    onBack();
  }


  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2"
      >
        <ArrowLeft />
        Dashboard
      </Button>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.name}
            </h1>

            <ProductLifecycleBadge savedType={product.saved_type} />
            <ProductStatusBadge status={product.status} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Store className="size-4" />

              {isNotRun
                ? "Waiting for first run"
                : `${offers.length} ${offers.length === 1 ? "store" : "stores"}`}
            </span>

            {totalStore && (
              <span>
                Lowest total:{" "}
                <strong className="text-foreground">{totalStore}</strong>
              </span>
            )}

            {unitStore && (
              <span>
                Lowest unit:{" "}
                <strong className="text-foreground">{unitStore}</strong>
              </span>
            )}
          </div>

          <div className="mt-4">
            <ProductDetailActions
              product={product}
              onUpdated={onRefresh}
              onDeleted={handleDeleted}
              onAskAi={onAskAi}
            />
          </div>
        </div>

        <div className="shrink-0 lg:text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lowest total
          </p>

          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {product.current_price !== null
              ? formatPrice(product.current_price)
              : "—"}

            {product.current_price !== null && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {product.currency}
              </span>
            )}
          </p>

          {isNotRun && (
            <p className="mt-2 text-sm text-muted-foreground">
              No price data yet
            </p>
          )}

          {!isNotRun && product.current_unit_price != null && (
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {formatPrice(product.current_unit_price, 4)}{" "}
              {product.currency}
              {unit ? `/${unit}` : ""}
            </p>
          )}

          {!isNotRun && product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "mt-1 px-0",
              })}
            >
              Open offer
              <ExternalLink data-icon="inline-end" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
