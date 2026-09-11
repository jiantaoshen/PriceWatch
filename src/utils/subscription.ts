/**
 * File: utils/subscription.ts
 * Purpose:
 *   Provides deterministic billing normalization for the independent subscription
 *   dashboard. No currency conversion is attempted.
 *
 * Main functions:
 *   - monthlyEquivalent(price, interval): normalize one charge to average monthly cost.
 *   - monthlyTotalsByCurrency(items): sum ACTIVE subscriptions by currency.
 *   - billingSuffix(interval): compact display suffix.
 *
 * Inputs:
 *   Subscription prices, billing intervals and active status.
 *
 * Outputs:
 *   Monthly equivalent numbers and display labels used by subscription UI.
 */

import type { BillingInterval, Subscription } from "@/services/subscriptionApi";


export function monthlyEquivalent(
  price: number,
  interval: BillingInterval,
): number {
  if (interval === "weekly") return price * 52 / 12;
  if (interval === "quarterly") return price / 3;
  if (interval === "yearly") return price / 12;
  return price;
}


export function monthlyTotalsByCurrency(
  items: Subscription[],
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const item of items) {
    if (!item.is_active) continue;

    const current = totals.get(item.currency) ?? 0;
    totals.set(
      item.currency,
      current + monthlyEquivalent(item.price, item.billing_interval),
    );
  }

  return totals;
}


export function billingSuffix(interval: BillingInterval): string {
  if (interval === "weekly") return "/week";
  if (interval === "quarterly") return "/quarter";
  if (interval === "yearly") return "/year";
  return "/month";
}


export function billingLabel(interval: BillingInterval): string {
  if (interval === "weekly") return "Weekly";
  if (interval === "quarterly") return "Quarterly";
  if (interval === "yearly") return "Yearly";
  return "Monthly";
}
