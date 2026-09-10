/**
 * File: components/products/ProductPriceReview.tsx
 * Purpose:
 *   Presents a clear recovery workflow when the scraper reports a suspicious
 *   price or cannot obtain a price. Suspicious prices can be confirmed as real;
 *   both suspicious and failed products can switch one source to manual price.
 *
 * Main functions:
 *   - ProductPriceReview(props): warning/recovery panel shown on product detail.
 *   - handleConfirm(): accepts the current suspicious candidate into history.
 *   - openManualDialog(): loads ProductConfig sources for manual selection.
 *   - handleManualSubmit(): saves a trusted manual package price and reruns scraper.
 *
 * Inputs:
 *   Merged Product plus onResolved callback used to refresh app data.
 *
 * Outputs:
 *   API mutations through priceReviewApi and scraperApi; refreshed product state.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  PencilLine,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { fetchProductConfig } from "@/services/productConfigApi";
import {
  acceptSuspiciousPrice,
  setManualSourcePrice,
} from "@/services/priceReviewApi";
import {
  runScraper,
  waitForScraperCompletion,
} from "@/services/scraperApi";
import { formatPrice } from "@/utils/price";

import type { ProductConfig } from "@/services/productConfigApi";
import type { Product } from "@/types/product";


interface ProductPriceReviewProps {
  product: Product;
  onResolved: () => void | Promise<void>;
}


export function ProductPriceReview({
  product,
  onResolved,
}: ProductPriceReviewProps) {
  const [confirming, setConfirming] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [applyingManual, setApplyingManual] = useState(false);
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSuspicious = product.status === "suspicious";
  const isFailed = product.status === "failed";

  if (!isSuspicious && !isFailed) {
    return null;
  }

  const changePercent = getChangePercent(
    product.current_price,
    product.previous_price,
  );
  const detectedPackagePrice = getDetectedPackagePrice(product, product.url);


  async function handleConfirm() {
    if (!isSuspicious || confirming) return;

    try {
      setConfirming(true);
      setError(null);
      await acceptSuspiciousPrice(product.product_id);
      await onResolved();
    }
    catch (exception) {
      setError(getErrorMessage(exception, "Failed to confirm the detected price."));
    }
    finally {
      setConfirming(false);
    }
  }


  async function openManualDialog() {
    try {
      setLoadingConfig(true);
      setError(null);

      const loaded = await fetchProductConfig(product.product_id);
      const defaultSource = chooseDefaultSourceUrl(product, loaded);
      const defaultPrice = getDetectedPackagePrice(product, defaultSource);

      setConfig(loaded);
      setSourceUrl(defaultSource);
      setManualPrice(defaultPrice === null ? "" : String(defaultPrice));
      setManualOpen(true);
    }
    catch (exception) {
      setError(getErrorMessage(exception, "Failed to load product sources."));
    }
    finally {
      setLoadingConfig(false);
    }
  }


  async function handleManualSubmit() {
    if (applyingManual) return;

    const parsed = Number(manualPrice.replace(",", "."));

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Manual price must be greater than 0.");
      return;
    }

    if (!sourceUrl) {
      setError("Choose the store/source this manual price belongs to.");
      return;
    }

    try {
      setApplyingManual(true);
      setError(null);

      await setManualSourcePrice(product.product_id, {
        source_url: sourceUrl,
        manual_price: parsed,
      });

      // Re-run immediately so the manual source is normalized by the same
      // unit/comparison logic as scraped sources and the UI resolves naturally.
      await runScraper();
      await waitForScraperCompletion();
      await onResolved();

      setManualOpen(false);
    }
    catch (exception) {
      setError(getErrorMessage(
        exception,
        "Manual price was not fully applied. If it was saved, use Run now to refresh prices.",
      ));
    }
    finally {
      setApplyingManual(false);
    }
  }


  return (
    <>
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" />
            </div>

            <div className="min-w-0">
              <h2 className="font-semibold">
                {isSuspicious ? "Price needs your confirmation" : "Price unavailable"}
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {isSuspicious
                  ? "The scraper found a large price change and deliberately did not add it to accepted history. Confirm it if the detected price is real, or enter a manual price instead."
                  : "The latest scraper run could not obtain a usable price. The product remains visible so you can inspect the error or provide a manual price."}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {product.current_price !== null && (
                  <ReviewValue
                    label={
                      product.comparison_quantity != null
                        ? "Detected comparable total"
                        : "Detected"
                    }
                    value={`${formatPrice(product.current_price)} ${product.currency}`}
                  />
                )}

                {product.comparison_quantity != null && detectedPackagePrice !== null && (
                  <ReviewValue
                    label="Detected package"
                    value={`${formatPrice(detectedPackagePrice)} ${product.currency}`}
                  />
                )}

                {product.previous_price !== null && (
                  <ReviewValue
                    label="Last accepted"
                    value={`${formatPrice(product.previous_price)} ${product.currency}`}
                  />
                )}

                {changePercent !== null && (
                  <ReviewValue
                    label="Change"
                    value={`${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%`}
                  />
                )}
              </div>

              {product.error?.message && (
                <p className="mt-3 rounded-md border bg-background/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {product.error.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {isSuspicious && (
              <Button
                type="button"
                disabled={confirming || loadingConfig}
                onClick={() => void handleConfirm()}
              >
                {confirming ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <CheckCircle2 data-icon="inline-start" />
                )}
                {confirming ? "Confirming..." : "Confirm detected price"}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={confirming || loadingConfig}
              onClick={() => void openManualDialog()}
            >
              {loadingConfig ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <PencilLine data-icon="inline-start" />
              )}
              Manual price
            </Button>

            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                Open offer
                <ExternalLink data-icon="inline-end" />
              </a>
            )}
          </div>
        </div>

        {error && !manualOpen && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>

      <Dialog
        open={manualOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && applyingManual) return;
          setManualOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Use a manual price</DialogTitle>
            <DialogDescription>
              Choose the store and enter its actual package price. That source will use manual mode until you enable scraping again in Edit Product.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Store / source</Label>

              <Select
                value={sourceUrl}
                onValueChange={value => {
                  setSourceUrl(value ?? "");
                  const detected = getDetectedPackagePrice(product, value ?? "");
                  setManualPrice(detected === null ? "" : String(detected));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose source" />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {(config?.sources ?? []).map(source => (
                      <SelectItem key={source.url} value={source.url}>
                        {source.store}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="review-manual-price">
                Actual package price ({product.currency})
              </Label>

              <Input
                id="review-manual-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={manualPrice}
                onChange={event => setManualPrice(event.target.value)}
                placeholder="e.g. 1000"
              />

              {product.comparison_quantity != null && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Enter the store's real package price, not the normalized comparison total. PriceWatch will calculate unit and comparison prices again.
                </p>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              After saving, PriceWatch will automatically run the checker once. User-entered manual prices are trusted and are not rejected by the large-change suspicious-price rule.
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={applyingManual}
              onClick={() => setManualOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={applyingManual || !sourceUrl}
              onClick={() => void handleManualSubmit()}
            >
              {applyingManual && (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              )}
              {applyingManual ? "Applying & checking..." : "Save manual price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ReviewValue({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-muted-foreground">{label}: </span>
      <strong className="font-semibold text-foreground">{value}</strong>
    </span>
  );
}


function getChangePercent(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}


function chooseDefaultSourceUrl(
  product: Product,
  config: ProductConfig,
): string {
  if (product.url && config.sources.some(source => source.url === product.url)) {
    return product.url;
  }

  return config.sources[0]?.url ?? "";
}


function getDetectedPackagePrice(
  product: Product,
  sourceUrl: string,
): number | null {
  const offer = (product.offers ?? []).find(item => item.url === sourceUrl);

  if (offer?.price != null) {
    return offer.price;
  }

  // current_price is an actual package price only when comparison normalization
  // is disabled. With comparison_quantity it may represent a normalized total.
  if (product.comparison_quantity == null && sourceUrl === product.url) {
    return product.current_price;
  }

  return null;
}


function getErrorMessage(exception: unknown, fallback: string): string {
  return exception instanceof Error ? exception.message : fallback;
}
