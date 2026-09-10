/**
 * File: utils/lifecycle.ts
 * Purpose:
 *   Shared formatting helpers for Owned / Subscription UI. Keeping lifecycle
 *   formatting here prevents product cards and detail pages from duplicating
 *   date and billing-label rules.
 *
 * Main functions:
 *   - formatLifecycleDate(value): formats an API yyyy-MM-dd date for display.
 *   - formatBillingInterval(value): returns a human-readable billing label.
 *   - formatBillingSuffix(value): returns /week, /month, /quarter or /year.
 *
 * Inputs:
 *   Nullable lifecycle date strings and BillingInterval values from ProductConfig.
 *
 * Outputs:
 *   Display-only strings. No product state is changed.
 */

import type { BillingInterval } from "@/services/productConfigApi";


export function formatLifecycleDate(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


export function formatBillingInterval(value: BillingInterval | null): string {
  if (!value) return "Not recorded";
  return value.charAt(0).toUpperCase() + value.slice(1);
}


export function formatBillingSuffix(value: BillingInterval | null): string {
  if (value === "weekly") return "/week";
  if (value === "monthly") return "/month";
  if (value === "quarterly") return "/quarter";
  if (value === "yearly") return "/year";
  return "";
}
