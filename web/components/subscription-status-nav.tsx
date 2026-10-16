"use client";

import { formatMoney } from "@pricewatch/shared/format";
import { cn } from "@/lib/utils";

export type SubscriptionFilter = "active" | "archived";

export function SubscriptionStatusNav({
  activeFilter,
  onChange,
  active,
  archived,
  monthlyTotal,
  currency,
}: {
  activeFilter: SubscriptionFilter;
  onChange: (value: SubscriptionFilter) => void;
  active: number;
  archived: number;
  monthlyTotal: number;
  currency: string;
}) {
  const metrics: Array<{ key: SubscriptionFilter; label: string; value: number }> = [
    { key: "active", label: "Active", value: active },
    { key: "archived", label: "Archived", value: archived },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="flex min-w-max items-stretch justify-between">
        <nav className="flex items-stretch">
          {metrics.map((metric) => {
            const selected = metric.key === activeFilter;

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => onChange(metric.key)}
                className={cn(
                  "flex min-w-[150px] items-baseline gap-2 border-r px-4 py-3 text-left transition-colors",
                  selected ? "bg-foreground text-background" : "hover:bg-muted/60"
                )}
              >
                <span className="text-sm font-medium">{metric.label}</span>
                <span className={cn("text-xs tabular-nums", selected ? "text-background/70" : "text-muted-foreground")}>
                  {metric.value}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-[220px] px-5 py-3 text-right">
          <div className="text-xs text-muted-foreground">Monthly total</div>
          <div className="font-semibold tabular-nums">{formatMoney(monthlyTotal, currency)}</div>
        </div>
      </div>
    </div>
  );
}
