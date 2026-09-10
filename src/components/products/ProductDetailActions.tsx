/**
 * File: components/products/ProductDetailActions.tsx
 * Purpose:
 *   Central action bar for one product. It keeps edit/delete/Ask AI actions and
 *   adds the lightweight lifecycle actions: mark purchased, mark subscription,
 *   and return an Owned/Subscription item to tracking-only.
 *
 * Main functions:
 *   - ProductDetailActions(props): renders actions appropriate for saved_type.
 *   - handleDelete(): deletes ProductConfig and notifies the parent.
 *   - handleMarkTracked(): clears lifecycle fields but keeps scraper configuration.
 *
 * Inputs:
 *   Full Product object plus refresh/delete/Ask AI callbacks.
 *
 * Outputs:
 *   API mutations through productConfigApi and parent refresh callbacks.
 */

import { useState } from "react";
import { Bot, RotateCcw, Trash2 } from "lucide-react";

import { MarkAsPurchasedDialog } from "@/components/products/MarkAsPurchasedDialog";
import { MarkAsSubscriptionDialog } from "@/components/products/MarkAsSubscriptionDialog";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  deleteProductConfig,
  markProductTracked,
} from "@/services/productConfigApi";

import type { Product } from "@/types/product";


interface ProductDetailActionsProps {
  product: Product;
  onUpdated?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
  onAskAi: () => void;
}


export function ProductDetailActions({
  product,
  onUpdated,
  onDeleted,
  onAskAi,
}: ProductDetailActionsProps) {
  const [trackOnlyOpen, setTrackOnlyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingTracked, setIsMarkingTracked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTracked = product.saved_type === "tracked";
  const isOwned = product.saved_type === "owned";
  const isSubscription = product.saved_type === "subscription";
  const actualWinnerPrice = getActualWinnerPrice(product);


  async function handleDelete() {
    if (isDeleting) return;

    try {
      setError(null);
      setIsDeleting(true);

      await deleteProductConfig(product.product_id);
      await onDeleted?.();
      setDeleteOpen(false);
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to delete product.",
      );
    }
    finally {
      setIsDeleting(false);
    }
  }


  async function handleMarkTracked() {
    if (isMarkingTracked) return;

    try {
      setError(null);
      setIsMarkingTracked(true);

      await markProductTracked(product.product_id);
      await onUpdated?.();
      setTrackOnlyOpen(false);
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to return product to tracking-only.",
      );
    }
    finally {
      setIsMarkingTracked(false);
    }
  }


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProductFormDialog
          mode="edit"
          productId={product.product_id}
          onSaved={onUpdated}
        />

        {isTracked && (
          <>
            <MarkAsPurchasedDialog
              productId={product.product_id}
              productName={product.name}
              currency={product.currency}
              defaultPrice={actualWinnerPrice}
              purchasePrice={product.purchase_price}
              purchaseDate={product.purchase_date}
              onSaved={onUpdated}
            />

            <MarkAsSubscriptionDialog
              productId={product.product_id}
              productName={product.name}
              currency={product.currency}
              defaultPrice={actualWinnerPrice}
              subscriptionPrice={product.subscription_price}
              billingInterval={product.billing_interval}
              nextBillingDate={product.next_billing_date}
              onSaved={onUpdated}
            />
          </>
        )}

        {isOwned && (
          <MarkAsPurchasedDialog
            productId={product.product_id}
            productName={product.name}
            currency={product.currency}
            defaultPrice={actualWinnerPrice}
            purchasePrice={product.purchase_price}
            purchaseDate={product.purchase_date}
            isOwned
            onSaved={onUpdated}
          />
        )}

        {isSubscription && (
          <MarkAsSubscriptionDialog
            productId={product.product_id}
            productName={product.name}
            currency={product.currency}
            defaultPrice={actualWinnerPrice}
            subscriptionPrice={product.subscription_price}
            billingInterval={product.billing_interval}
            nextBillingDate={product.next_billing_date}
            isSubscription
            onSaved={onUpdated}
          />
        )}

        {!isTracked && (
          <Button
            type="button"
            variant="outline"
            disabled={isMarkingTracked}
            onClick={() => {
              setError(null);
              setTrackOnlyOpen(true);
            }}
          >
            <RotateCcw data-icon="inline-start" />
            Tracking only
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onAskAi}
        >
          <Bot data-icon="inline-start" />
          Ask AI
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setError(null);
            setDeleteOpen(true);
          }}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      </div>

      {error && !deleteOpen && !trackOnlyOpen && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Dialog
        open={trackOnlyOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && isMarkingTracked) return;
          setTrackOnlyOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return to tracking only?</DialogTitle>
            <DialogDescription>
              Price tracking will continue, but saved purchase or subscription details for {product.name} will be cleared.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isMarkingTracked}
              onClick={() => setTrackOnlyOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isMarkingTracked}
              onClick={() => void handleMarkTracked()}
            >
              <RotateCcw data-icon="inline-start" />
              {isMarkingTracked ? "Updating..." : "Tracking only"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && isDeleting) return;

          setDeleteOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>

            <DialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                {product.name}
              </span>{" "}
              from your product configuration.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 data-icon="inline-start" />
              {isDeleting ? "Deleting..." : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function getActualWinnerPrice(product: Product): number | null {
  // With comparison_quantity enabled, product.current_price is a normalized
  // comparison total, not necessarily the package price the user would pay.
  // Prefer the winning offer's raw package price for lifecycle defaults.
  const offers = product.offers ?? [];

  const byUrl = product.url
    ? offers.find(offer => offer.url === product.url)
    : undefined;

  if (byUrl) return byUrl.price;

  const byStore = product.store
    ? offers.find(offer => offer.store === product.store)
    : undefined;

  if (byStore) return byStore.price;

  // current_price is safe as an actual price only when no comparison quantity
  // normalization is configured. Otherwise leave the default blank rather than
  // pre-filling a potentially misleading purchase/subscription amount.
  return product.comparison_quantity == null
    ? product.current_price
    : null;
}
