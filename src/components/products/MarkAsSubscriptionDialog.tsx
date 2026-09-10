/**
 * File: components/products/MarkAsSubscriptionDialog.tsx
 * Purpose:
 *   Lets a user mark a saved product as a subscription with only the information
 *   that is useful in v1: actual paid price, billing interval, and next billing date.
 *
 * Main functions:
 *   - MarkAsSubscriptionDialog(props): lifecycle dialog component.
 *   - handleSubmit(): validates optional price and calls markProductSubscription().
 *
 * Inputs:
 *   Product ID/name/default raw offer price/currency and existing subscription data.
 *
 * Outputs:
 *   Updated ProductConfig through onSaved after POST .../mark-subscription succeeds.
 */

import { useState } from "react";
import { Repeat2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { markProductSubscription } from "@/services/productConfigApi";

import type {
  BillingInterval,
  ProductConfig,
} from "@/services/productConfigApi";


const BILLING_OPTIONS: { label: string; value: BillingInterval }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];


interface MarkAsSubscriptionDialogProps {
  productId: string;
  productName: string;
  currency: string;
  defaultPrice: number | null;
  subscriptionPrice: number | null;
  billingInterval: BillingInterval | null;
  nextBillingDate: string | null;
  isSubscription?: boolean;
  onSaved?: (product: ProductConfig) => void | Promise<void>;
}


export function MarkAsSubscriptionDialog({
  productId,
  productName,
  currency,
  defaultPrice,
  subscriptionPrice,
  billingInterval,
  nextBillingDate,
  isSubscription = false,
  onSaved,
}: MarkAsSubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  function openDialog() {
    setPrice(numberToInput(subscriptionPrice ?? defaultPrice));
    setInterval(billingInterval ?? "monthly");
    setNextDate(nextBillingDate ?? "");
    setError(null);
    setOpen(true);
  }


  async function handleSubmit() {
    if (saving) return;

    const parsedPrice = parseOptionalPositiveNumber(price);
    if (parsedPrice === "invalid") {
      setError("Subscription price must be greater than 0, or left empty.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const product = await markProductSubscription(productId, {
        subscription_price: parsedPrice,
        billing_interval: interval,
        next_billing_date: nextDate || null,
      });

      await onSaved?.(product);
      setOpen(false);
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to save subscription information.",
      );
    }
    finally {
      setSaving(false);
    }
  }


  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog}>
        <Repeat2 data-icon="inline-start" />
        {isSubscription ? "Edit subscription" : "Mark as subscription"}
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
            <DialogTitle>
              {isSubscription ? "Edit subscription" : "Mark as subscription"}
            </DialogTitle>
            <DialogDescription>
              Save what you actually pay for {productName}. The scraper can keep tracking the public price.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="subscription-price">You pay ({currency})</Label>
              <Input
                id="subscription-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={price}
                onChange={event => setPrice(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Billing interval</Label>
              <Select
                items={BILLING_OPTIONS}
                value={interval}
                onValueChange={value => {
                  const option = BILLING_OPTIONS.find(item => item.value === value);
                  if (option) setInterval(option.value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose billing interval" />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {BILLING_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="next-billing-date">Next billing date</Label>
              <Input
                id="next-billing-date"
                type="date"
                value={nextDate}
                onChange={event => setNextDate(event.target.value)}
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
              {saving ? "Saving..." : "Save subscription"}
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
