/**
 * File: components/subscriptions/SubscriptionFormDialog.tsx
 * Purpose:
 *   Creates or edits one recurring subscription with a small form independent
 *   from product scraper configuration.
 *
 * Main functions:
 *   - SubscriptionFormDialog(props): create/edit dialog.
 *   - handleSubmit(): validate fields and call create/update subscription API.
 *
 * Inputs:
 *   Optional existing Subscription and onSaved callback.
 *
 * Outputs:
 *   A saved Subscription and refreshed parent UI after API success.
 */

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  createSubscription,
  updateSubscription,
} from "@/services/subscriptionApi";

import type { BillingInterval, Subscription } from "@/services/subscriptionApi";


interface SubscriptionFormDialogProps {
  subscription?: Subscription;
  onSaved?: (subscription: Subscription) => void | Promise<void>;
}


export function SubscriptionFormDialog({
  subscription,
  onSaved,
}: SubscriptionFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = subscription !== undefined;

  function openDialog() {
    setName(subscription?.name ?? "");
    setPrice(subscription ? String(subscription.price) : "");
    setCurrency(subscription?.currency ?? "SEK");
    setInterval(subscription?.billing_interval ?? "monthly");
    setNextBillingDate(subscription?.next_billing_date ?? "");
    setNote(subscription?.note ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (saving) return;

    const trimmedName = name.trim();
    const parsedPrice = Number(price);

    if (!trimmedName) {
      setError("Subscription name is required.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    if (!currency.trim()) {
      setError("Currency is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const input = {
        name: trimmedName,
        price: parsedPrice,
        currency: currency.trim().toUpperCase(),
        billing_interval: interval,
        next_billing_date: nextBillingDate || null,
        note: note.trim() || null,
      };

      const saved = subscription
        ? await updateSubscription(subscription.id, input)
        : await createSubscription(input);

      await onSaved?.(saved);
      setOpen(false);
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to save subscription.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant={isEdit ? "outline" : "default"} onClick={openDialog}>
        {isEdit ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        {isEdit ? "Edit" : "Add subscription"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen && saving) return;
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit subscription" : "Add subscription"}</DialogTitle>
            <DialogDescription>
              Subscriptions are recurring expenses only. They are not connected to product scraping.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="subscription-name">Name</Label>
              <Input
                id="subscription-name"
                value={name}
                placeholder="Netflix, iCloud+, gym..."
                onChange={event => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="subscription-price">Price</Label>
                <Input
                  id="subscription-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={event => setPrice(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subscription-currency">Currency</Label>
                <Input
                  id="subscription-currency"
                  value={currency}
                  onChange={event => setCurrency(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Billing interval</Label>
                <Select value={interval} onValueChange={value => setInterval(value as BillingInterval)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subscription-next-date">Next billing date</Label>
                <Input
                  id="subscription-next-date"
                  type="date"
                  value={nextBillingDate}
                  onChange={event => setNextBillingDate(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subscription-note">Note</Label>
              <Textarea
                id="subscription-note"
                value={note}
                placeholder="Optional"
                onChange={event => setNote(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
              {saving ? "Saving..." : "Save subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
