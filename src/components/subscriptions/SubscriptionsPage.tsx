/**
 * File: components/subscriptions/SubscriptionsPage.tsx
 * Purpose:
 *   Owns the independent Subscriptions tab. It shows active monthly spending,
 *   lets users add/edit/cancel subscriptions and keeps cancelled records visible.
 *
 * Main function:
 *   - SubscriptionsPage(): loads subscriptions and renders summary, scope tabs and cards.
 *
 * Inputs:
 *   User actions plus /api/subscriptions data through useSubscriptions().
 *
 * Outputs:
 *   Standalone subscription management UI, completely separate from product scraper data.
 */

import { useState } from "react";
import { CreditCard } from "lucide-react";

import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { SubscriptionSummary } from "@/components/subscriptions/SubscriptionSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useSubscriptions } from "@/hooks/useSubscriptions";


type SubscriptionScope = "active" | "cancelled";


export function SubscriptionsPage() {
  const data = useSubscriptions();
  const [scope, setScope] = useState<SubscriptionScope>("active");

  if (data.loading) {
    return <div className="py-16 text-center text-muted-foreground">Loading subscriptions...</div>;
  }

  if (data.error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          {data.error}
        </CardContent>
      </Card>
    );
  }

  const visible = data.subscriptions
    .filter(item => scope === "active" ? item.is_active : !item.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeCount = data.subscriptions.filter(item => item.is_active).length;
  const cancelledCount = data.subscriptions.length - activeCount;

  return (
    <div className="space-y-8">
      <SubscriptionSummary subscriptions={data.subscriptions} />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage recurring expenses separately from product price tracking.
            </p>
          </div>

          <SubscriptionFormDialog onSaved={() => data.refresh()} />
        </div>

        <div className="flex gap-2 rounded-xl border bg-muted/25 p-2">
          <Button
            type="button"
            size="sm"
            variant={scope === "active" ? "secondary" : "ghost"}
            onClick={() => setScope("active")}
          >
            Active
            <span className="ml-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {activeCount}
            </span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={scope === "cancelled" ? "secondary" : "ghost"}
            onClick={() => setScope("cancelled")}
          >
            Cancelled
            <span className="ml-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {cancelledCount}
            </span>
          </Button>
        </div>

        {visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(subscription => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onChanged={() => data.refresh()}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <CreditCard className="size-7 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {scope === "active" ? "No active subscriptions" : "No cancelled subscriptions"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {scope === "active"
                  ? "Add a subscription to start tracking your recurring monthly spend."
                  : "Cancelled subscriptions stay here until you delete or reactivate them."}
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
