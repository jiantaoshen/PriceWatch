/**
 * File: components/subscriptions/SubscriptionCard.tsx
 * Purpose:
 *   Displays one independent subscription, its recurring charge, monthly equivalent,
 *   next billing date and active/cancelled actions.
 *
 * Main functions:
 *   - SubscriptionCard(props): renders subscription information and actions.
 *   - handleStatusChange(): activate/cancel the subscription.
 *   - handleDelete(): permanently delete the record after confirmation.
 *
 * Inputs:
 *   Subscription plus onChanged callback.
 *
 * Outputs:
 *   Subscription API mutations and a refreshed parent list.
 */

import { useState } from "react";
import { CalendarDays, PauseCircle, PlayCircle, Trash2 } from "lucide-react";

import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  activateSubscription,
  cancelSubscription,
  deleteSubscription,
} from "@/services/subscriptionApi";
import { billingLabel, billingSuffix, monthlyEquivalent } from "@/utils/subscription";
import { formatPrice } from "@/utils/price";

import type { Subscription } from "@/services/subscriptionApi";


interface SubscriptionCardProps {
  subscription: Subscription;
  onChanged: () => void | Promise<void>;
}


export function SubscriptionCard({
  subscription,
  onChanged,
}: SubscriptionCardProps) {
  const [working, setWorking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange() {
    if (working) return;

    try {
      setWorking(true);
      setError(null);
      if (subscription.is_active) {
        await cancelSubscription(subscription.id);
      }
      else {
        await activateSubscription(subscription.id);
      }
      await onChanged();
    }
    catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to update subscription.");
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
      await deleteSubscription(subscription.id);
      await onChanged();
      setDeleteOpen(false);
    }
    catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to delete subscription.");
    }
    finally {
      setWorking(false);
    }
  }

  const monthly = monthlyEquivalent(subscription.price, subscription.billing_interval);

  return (
    <Card className={!subscription.is_active ? "opacity-70" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{subscription.name}</CardTitle>
            {subscription.note && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {subscription.note}
              </p>
            )}
          </div>

          <Badge variant={subscription.is_active ? "secondary" : "outline"}>
            {subscription.is_active ? "Active" : "Cancelled"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatPrice(subscription.price)} {subscription.currency}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {billingSuffix(subscription.billing_interval)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {billingLabel(subscription.billing_interval)} · ≈ {formatPrice(monthly)} {subscription.currency}/month
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          <span>
            {subscription.next_billing_date
              ? `Next billing ${formatDate(subscription.next_billing_date)}`
              : "Next billing date not set"}
          </span>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
        <SubscriptionFormDialog
          subscription={subscription}
          onSaved={onChanged}
        />

        <Button type="button" variant="outline" disabled={working} onClick={() => void handleStatusChange()}>
          {subscription.is_active
            ? <PauseCircle data-icon="inline-start" />
            : <PlayCircle data-icon="inline-start" />}
          {subscription.is_active ? "Cancel" : "Reactivate"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={working}
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      </CardFooter>

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
            <DialogTitle>Delete subscription?</DialogTitle>
            <DialogDescription>
              This permanently removes {subscription.name}. Use Cancel instead if you only stopped paying for it.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={working} onClick={() => setDeleteOpen(false)}>
              Keep
            </Button>
            <Button type="button" variant="destructive" disabled={working} onClick={() => void handleDelete()}>
              {working ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
