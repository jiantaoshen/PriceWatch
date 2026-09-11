/**
 * File: components/products/ProductDetail.tsx
 * Purpose:
 *   Composes product detail for active and archived products. Active products show
 *   live scraper/review/offers; archived products preserve price history without
 *   pretending they are waiting for a scraper run.
 *
 * Main function:
 *   - ProductDetail(props): renders header, current stats, offers, charts and history.
 *
 * Inputs:
 *   Selected Product, compact history, current period and callbacks.
 *
 * Outputs:
 *   Product detail UI. Purchase/archive mutations are delegated to header actions.
 */

import { Play } from "lucide-react";

import { ProductDetailHeader } from "@/components/products/ProductDetailHeader";
import { ProductHistoryTable } from "@/components/products/ProductHistoryTable";
import { ProductOffers } from "@/components/products/ProductOffers";
import { ProductPriceChart } from "@/components/products/ProductPriceChart";
import { ProductPriceReview } from "@/components/products/ProductPriceReview";
import { ProductPriceStats } from "@/components/products/ProductPriceStats";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useProductHistory } from "@/hooks/useProductHistory";
import { getRecentHistoryComparison } from "@/utils/historyComparison";

import type { HistoryDataFile, Product } from "@/types/product";


interface ProductDetailProps {
  product: Product;
  history: HistoryDataFile[];
  currentPeriod: string;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
  onAskAi: () => void;
}


export function ProductDetail({
  product,
  history,
  currentPeriod,
  onBack,
  onRefresh,
  onAskAi,
}: ProductDetailProps) {
  const priceHistory = useProductHistory(product, history);
  const recentHistory = getRecentHistoryComparison(
    product.product_id,
    history,
    currentPeriod,
  );
  const unit = product.unit ?? null;
  const unitCurrency = unit ? `${product.currency}/${unit}` : product.currency;
  const isArchived = product.archived_at !== null;
  const isNotRun = product.status === "not_run";

  return (
    <div className="space-y-8">
      <ProductDetailHeader
        product={product}
        onBack={onBack}
        onRefresh={onRefresh}
        onAskAi={onAskAi}
      />

      {!isArchived && (
        <ProductPriceReview
          product={product}
          onResolved={onRefresh}
        />
      )}

      <Separator />

      {!isArchived && isNotRun ? (
        <NotRunState />
      ) : (
        <>
          {!isArchived && (
            <>
              <ProductPriceStats
                product={product}
                totalLow={priceHistory.totalLow}
                totalHigh={priceHistory.totalHigh}
                totalAverage={priceHistory.totalAverage}
                unitLow={priceHistory.unitLow}
                unitHigh={priceHistory.unitHigh}
                unitAverage={priceHistory.unitAverage}
                recentHistory={recentHistory}
              />

              <ProductOffers product={product} />
            </>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <ProductPriceChart
              title="Total price history"
              description={isArchived
                ? "Accepted prices recorded before this product was archived."
                : "Lowest total price recorded each period."}
              data={priceHistory.totalChartData}
              currency={product.currency}
              target={product.target_price}
            />

            <ProductPriceChart
              title="Unit price history"
              description={isArchived
                ? "Accepted unit prices recorded before this product was archived."
                : "Lowest unit price recorded each period."}
              data={priceHistory.unitChartData}
              currency={unitCurrency}
              target={product.target_unit_price ?? null}
            />
          </div>

          <ProductHistoryTable
            data={priceHistory.historyPoints}
            currency={product.currency}
            unit={unit}
          />
        </>
      )}
    </div>
  );
}


function NotRunState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-65 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Play className="size-5 text-muted-foreground" />
        </div>

        <h2 className="mt-4 text-lg font-semibold">No price data yet</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          This product has been added successfully but has not been included in a scraper run yet.
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Run the scraper to load prices, store offers, statistics and history.
        </p>
      </CardContent>
    </Card>
  );
}
