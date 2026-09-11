/**
 * File: components/subscriptions/SubscriptionSummary.tsx
 * Purpose:
 *   Summarizes recurring subscription spending. Totals include active subscriptions
 *   only and are grouped by currency because PriceWatch does not perform FX conversion.
 *
 * Main function:
 *   - SubscriptionSummary({ subscriptions }): renders active count, monthly total
 *     and annual equivalent totals by currency.
 *
 * Inputs:
 *   Full Subscription[] collection.
 *
 * Outputs:
 *   Read-only summary cards for the Subscriptions tab.
 */

import { CalendarDays, CreditCard, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { monthlyTotalsByCurrency } from "@/utils/subscription";
import { formatPrice } from "@/utils/price";

import type { Subscription } from "@/services/subscriptionApi";


export function SubscriptionSummary({ subscriptions }: { subscriptions: Subscription[] }) {
  const active = subscriptions.filter(item => item.is_active);
  const totals = [...monthlyTotalsByCurrency(subscriptions).entries()]
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active subscriptions</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{active.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {subscriptions.length - active.length} cancelled
              </p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
              <CreditCard className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Monthly total</p>
              <Totals values={totals} multiplier={1} suffix="/month" />
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <WalletCards className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Annual equivalent</p>
              <Totals values={totals} multiplier={12} suffix="/year" />
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <CalendarDays className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function Totals({
  values,
  multiplier,
  suffix,
}: {
  values: [string, number][];
  multiplier: number;
  suffix: string;
}) {
  if (values.length === 0) {
    return (
      <>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">0</p>
        <p className="mt-1 text-xs text-muted-foreground">No active recurring cost</p>
      </>
    );
  }

  if (values.length === 1) {
    const [currency, value] = values[0];
    return (
      <>
        <p className="mt-2 truncate text-3xl font-semibold tracking-tight tabular-nums">
          {formatPrice(value * multiplier)}
          <span className="ml-1 text-sm font-medium text-muted-foreground">{currency}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
      </>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {values.map(([currency, value]) => (
        <p key={currency} className="font-semibold tabular-nums">
          {formatPrice(value * multiplier)} {currency}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>
        </p>
      ))}
    </div>
  );
}
