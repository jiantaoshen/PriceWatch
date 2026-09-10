/**
 * File: components/products/ProductCard.tsx
 * Purpose:
 *   Renders one dashboard product card with total/unit price winners, target
 *   status, scraper health, and the user's lifecycle state.
 *
 * Main functions:
 *   - ProductCard({ product, onClick }): clickable dashboard card.
 *   - PriceBlock(...): reusable total/unit price section.
 *   - TotalTargetBadge(...): total-price target state.
 *   - UnitTargetBadge(...): unit-price target state.
 *
 * Inputs:
 *   Merged Product object from useAppData and an onClick callback.
 *
 * Outputs:
 *   A Card button that opens product details.
 */

import { Check, Minus, Store } from "lucide-react";

import { ProductLifecycleBadge } from "@/components/products/ProductLifecycleBadge";
import { ProductLifecycleCardInfo } from "@/components/products/ProductLifecycleCardInfo";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { formatPrice } from "@/utils/price";

import type { Product } from "@/types/product";


interface ProductCardProps {
  product: Product;
  onClick: () => void;
}


export function ProductCard({ product, onClick }: ProductCardProps) {
  const currentPrice = product.current_price;
  const currentUnitPrice = product.current_unit_price ?? null;
  const totalStore = product.store ?? null;
  const unitStore = product.unit_store ?? null;
  const unit = product.unit ?? null;
  const offers = product.offers ?? [];
  const unitTarget = product.target_unit_price ?? null;
  const isNotRun = product.status === "not_run";
  const needsReview = product.status === "suspicious" || product.status === "failed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full w-full text-left"
      aria-label={`View ${product.name}`}
    >
      <Card className="h-full min-h-80 gap-0 overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
        <CardHeader className="min-h-23 border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="line-clamp-2 text-[15px] leading-5">
                {product.name}
              </CardTitle>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Store className="size-3.5" />

                <span>
                  {isNotRun
                    ? "Waiting for first run"
                    : product.status === "failed"
                      ? "Latest price check needs attention"
                      : `${offers.length} ${offers.length === 1 ? "store" : "stores"}`}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <ProductLifecycleBadge savedType={product.saved_type} />
              <ProductStatusBadge status={product.status} />
            </div>
          </div>
        </CardHeader>


        <CardContent className="grid flex-1 grid-cols-2 p-0">
          <PriceBlock
            label="Lowest Total"
            price={currentPrice}
            currency={product.currency}
            store={totalStore}
            target={product.target_price}
          />

          <PriceBlock
            label="Lowest Unit"
            price={currentUnitPrice}
            currency={product.currency}
            unit={unit}
            store={unitStore}
            target={unitTarget}
            borderLeft
          />
        </CardContent>


        <div className="min-h-14 border-t px-5 py-3">
          <ProductLifecycleCardInfo product={product} />
        </div>


        <CardFooter className="min-h-15 gap-2 border-t px-5 py-3">
          {isNotRun ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Minus className="size-3" />
              Waiting for first run
            </Badge>
          ) : needsReview ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Open product to review price.</span>
              {product.previous_price !== null && (
                <span>Last accepted: {formatPrice(product.previous_price)} {product.currency}</span>
              )}
            </div>
          ) : (
            <>
              <TotalTargetBadge
                currentPrice={currentPrice}
                belowTarget={product.below_target}
              />

              <UnitTargetBadge
                currentUnitPrice={currentUnitPrice}
                targetUnitPrice={unitTarget}
                belowTarget={product.unit_below_target}
              />
            </>
          )}
        </CardFooter>
      </Card>
    </button>
  );
}


function PriceBlock({
  label,
  price,
  currency,
  unit,
  store,
  target,
  borderLeft = false,
}: {
  label: string;
  price: number | null;
  currency: string;
  unit?: string | null;
  store: string | null;
  target: number | null;
  borderLeft?: boolean;
}) {
  return (
    <div className={`min-w-0 px-5 py-5 ${borderLeft ? "border-l" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <div className="mt-2 min-h-8.5">
        {price !== null ? (
          <p className="truncate text-xl font-bold tracking-tight tabular-nums">
            {formatPrice(price)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {currency}{unit ? `/${unit}` : ""}
            </span>
          </p>
        ) : (
          <p className="text-xl font-medium text-muted-foreground">—</p>
        )}
      </div>

      <div className="mt-2 min-h-5">
        {store ? (
          <p className="truncate text-xs font-medium">{store}</p>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </div>

      <div className="mt-2 min-h-5">
        {target !== null ? (
          <p className="text-[11px] text-muted-foreground">
            Target {formatPrice(target)} {currency}{unit ? `/${unit}` : ""}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">No target</p>
        )}
      </div>
    </div>
  );
}


function TotalTargetBadge({
  currentPrice,
  belowTarget,
}: {
  currentPrice: number | null;
  belowTarget: boolean | null;
}) {
  if (currentPrice === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="size-3" />
        No total price
      </Badge>
    );
  }

  if (belowTarget === true) {
    return (
      <Badge className="gap-1">
        <Check className="size-3" />
        Below total
      </Badge>
    );
  }

  return <Badge variant="outline">Above total</Badge>;
}


function UnitTargetBadge({
  currentUnitPrice,
  targetUnitPrice,
  belowTarget,
}: {
  currentUnitPrice: number | null;
  targetUnitPrice: number | null;
  belowTarget: boolean | null | undefined;
}) {
  if (targetUnitPrice === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Unit target off
      </Badge>
    );
  }

  if (currentUnitPrice === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="size-3" />
        No unit price
      </Badge>
    );
  }

  if (belowTarget === true) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" />
        Below unit
      </Badge>
    );
  }

  return <Badge variant="outline">Above unit</Badge>;
}