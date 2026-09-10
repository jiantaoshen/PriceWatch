/**
 * File: components/products/MarkAsPurchasedDialog.tsx
 * Purpose:
 *   Provides the smallest possible UI for marking a tracked product as Owned.
 *   Purchase price defaults to the current scraper price and purchase date defaults
 *   to the user's local date, so most users can confirm without typing anything.
 *
 * Main functions:
 *   - MarkAsPurchasedDialog(props): lifecycle dialog component.
 *   - handleSubmit(): validates optional price and calls markProductOwned().
 *   - localToday(): returns YYYY-MM-DD using local calendar values.
 *
 * Inputs:
 *   Product ID/name/default raw offer price/currency and existing purchase values.
 *
 * Outputs:
 *   Updated ProductConfig through onSaved after POST .../mark-owned succeeds.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

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

import { markProductOwned } from "@/services/productConfigApi";

import type { ProductConfig } from "@/services/productConfigApi";


interface MarkAsPurchasedDialogProps {
  productId: string;
  productName: string;
  currency: string;
  defaultPrice: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  isOwned?: boolean;
  onSaved?: (product: ProductConfig) => void | Promise<void>;
}


export function MarkAsPurchasedDialog({
  productId,
  productName,
  currency,
  defaultPrice,
  purchasePrice,
  purchaseDate,
  isOwned = false,
  onSaved,
}: MarkAsPurchasedDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  function openDialog() {
    setPrice(numberToInput(purchasePrice ?? defaultPrice));
    setDate(purchaseDate ?? localToday());
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

      const product = await markProductOwned(productId, {
        purchase_price: parsedPrice,
        purchase_date: date || null,
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
        <CheckCircle2 data-icon="inline-start" />
        {isOwned ? "Edit purchase" : "Mark as purchased"}
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
            <DialogTitle>{isOwned ? "Edit purchase" : "Mark as purchased"}</DialogTitle>
            <DialogDescription>
              Save optional purchase details for {productName}. Price tracking can continue normally.
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
              {saving ? "Saving..." : "Save purchase"}
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
