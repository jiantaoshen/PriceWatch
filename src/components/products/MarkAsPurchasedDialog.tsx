/**
 * File: components/products/MarkAsPurchasedDialog.tsx
 * Purpose:
 *   Records the user's latest purchase reference without creating an "Owned"
 *   state or purchase-history UI. An active product can optionally be archived
 *   immediately after purchase so the scraper stops checking it.
 *
 * Main functions:
 *   - MarkAsPurchasedDialog(props): renders the purchase action/dialog.
 *   - handleSubmit(): validates price/date and calls recordProductPurchase().
 *   - localToday(): returns the user's local YYYY-MM-DD date.
 *
 * Inputs:
 *   Product ID/name/currency, default raw winning offer price, existing last
 *   purchase values, archive state and optional onSaved callback.
 *
 * Outputs:
 *   Updated ProductConfig after POST /api/product-config/{id}/purchase.
 */

import { useState } from "react";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
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

import { recordProductPurchase } from "@/services/productConfigApi";

import type { ProductConfig } from "@/services/productConfigApi";


interface MarkAsPurchasedDialogProps {
  productId: string;
  productName: string;
  currency: string;
  defaultPrice: number | null;
  lastPurchasePrice: number | null;
  lastPurchaseDate: string | null;
  isArchived: boolean;
  onSaved?: (product: ProductConfig) => void | Promise<void>;
}


export function MarkAsPurchasedDialog({
  productId,
  productName,
  currency,
  defaultPrice,
  lastPurchasePrice,
  lastPurchaseDate,
  isArchived,
  onSaved,
}: MarkAsPurchasedDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [archiveAfterPurchase, setArchiveAfterPurchase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPurchase = lastPurchasePrice !== null || lastPurchaseDate !== null;

  function openDialog() {
    setPrice(numberToInput(lastPurchasePrice ?? defaultPrice));
    setDate(lastPurchaseDate ?? localToday());
    setArchiveAfterPurchase(false);
    setError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (saving) return;

    const parsedPrice = parseOptionalPositiveNumber(price);
    if (parsedPrice === "invalid") {
      setError("Purchase price must be greater than 0, or left empty.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const product = await recordProductPurchase(productId, {
        last_purchase_price: parsedPrice,
        last_purchase_date: date || null,
        archive_after_purchase: !isArchived && archiveAfterPurchase,
      });

      await onSaved?.(product);
      setOpen(false);
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to save purchase information.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog}>
        <ShoppingBag data-icon="inline-start" />
        {hasPurchase ? "Edit last purchase" : "Bought"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen && saving) return;
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasPurchase ? "Edit last purchase" : "Record purchase"}</DialogTitle>
            <DialogDescription>
              Save only your most recent purchase reference for {productName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="purchase-price">Purchase price ({currency})</Label>
              <Input
                id="purchase-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={price}
                onChange={event => setPrice(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="purchase-date">Purchase date</Label>
              <Input
                id="purchase-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </div>

            {!isArchived && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={archiveAfterPurchase}
                  onChange={event => setArchiveAfterPurchase(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">Stop tracking and archive</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    Keep the product and its history, but exclude it from future scraper runs.
                  </span>
                </span>
              </label>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? "Saving..." : archiveAfterPurchase ? "Save & archive" : "Save purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function numberToInput(value: number | null): string {
  return value === null ? "" : String(value);
}


function parseOptionalPositiveNumber(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return "invalid";
  return parsed;
}


function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
