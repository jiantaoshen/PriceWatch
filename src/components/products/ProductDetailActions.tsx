/**
 * File: components/products/ProductDetailActions.tsx
 * Purpose:
 *   Provides product actions for the simplified lifecycle: edit scraper config,
 *   record latest purchase, archive/restore, Ask AI and permanent delete.
 *
 * Main functions:
 *   - ProductDetailActions(props): renders active/archived actions.
 *   - handleArchive(): archives the product without deleting data/history.
 *   - handleRestore(): restores the product to active scraper tracking.
 *   - handleDelete(): permanently removes ProductConfig.
 *
 * Inputs:
 *   Merged Product and parent refresh/delete/AI callbacks.
 *
 * Outputs:
 *   Product API mutations plus parent refresh/navigation callbacks.
 */

import { useState } from "react";
import { Archive, Bot, RotateCcw, Trash2 } from "lucide-react";

import { MarkAsPurchasedDialog } from "@/components/products/MarkAsPurchasedDialog";
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
  archiveProduct,
  deleteProductConfig,
  restoreProduct,
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isArchived = product.archived_at !== null;
  const actualWinnerPrice = getActualWinnerPrice(product);

  async function handleArchive() {
    if (working) return;

    try {
      setWorking(true);
      setError(null);
      await archiveProduct(product.product_id);
      await onUpdated?.();
      setArchiveOpen(false);
    }
    catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to archive product.");
    }
    finally {
      setWorking(false);
    }
  }

  async function handleRestore() {
    if (working) return;

    try {
      setWorking(true);
      setError(null);
      await restoreProduct(product.product_id);
      await onUpdated?.();
    }
    catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to restore product.");
    }
    finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (working) return;

    try {
      setWorking(true);
      setError(null);
      await deleteProductConfig(product.product_id);
      await onDeleted?.();
      setDeleteOpen(false);
    }
    catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to delete product.");
    }
    finally {
      setWorking(false);
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

        <MarkAsPurchasedDialog
          productId={product.product_id}
          productName={product.name}
          currency={product.currency}
          defaultPrice={actualWinnerPrice}
          lastPurchasePrice={product.last_purchase_price}
          lastPurchaseDate={product.last_purchase_date}
          isArchived={isArchived}
          onSaved={onUpdated}
        />

        {isArchived ? (
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={() => void handleRestore()}
          >
            <RotateCcw data-icon="inline-start" />
            {working ? "Restoring..." : "Restore tracking"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={() => {
              setError(null);
              setArchiveOpen(true);
            }}
          >
            <Archive data-icon="inline-start" />
            Archive
          </Button>
        )}

        <Button type="button" variant="outline" onClick={onAskAi}>
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

      {error && !archiveOpen && !deleteOpen && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Dialog
        open={archiveOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && working) return;
          setArchiveOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive product?</DialogTitle>
            <DialogDescription>
              {product.name} will stay saved with its purchase/history data, but future scraper runs will skip it.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={working} onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={working} onClick={() => void handleArchive()}>
              <Archive data-icon="inline-start" />
              {working ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && working) return;
          setDeleteOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-medium text-foreground">{product.name}</span> from product configuration.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={working} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={working} onClick={() => void handleDelete()}>
              <Trash2 data-icon="inline-start" />
              {working ? "Deleting..." : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function getActualWinnerPrice(product: Product): number | null {
  const offers = product.offers ?? [];

  const byUrl = product.url
    ? offers.find(offer => offer.url === product.url)
    : undefined;
  if (byUrl) return byUrl.price;

  const byStore = product.store
    ? offers.find(offer => offer.store === product.store)
    : undefined;
  if (byStore) return byStore.price;

  return product.comparison_quantity == null
    ? product.current_price
    : null;
}
