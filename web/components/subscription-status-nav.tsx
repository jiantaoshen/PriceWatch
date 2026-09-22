"use client";

import {
  Archive,
  CircleDollarSign,
  Radar,
} from "lucide-react";

import { formatMoney } from "@pricewatch/shared/format";
import { cn } from "@/lib/utils";

export type SubscriptionFilter =
  | "active"
  | "archived";

type Metric = {
  key: SubscriptionFilter;
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
};

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
  const metrics: Metric[] = [
    {
      key: "active",
      label: "Active",
      value: active,
      icon: Radar,
    },
    {
      key: "archived",
      label: "Archived",
      value: archived,
      icon: Archive,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="flex min-w-max items-stretch justify-between">
        <nav className="flex items-stretch">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const selected = metric.key === activeFilter;

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => onChange(metric.key)}
                className={cn(
                  "group flex min-w-[150px] items-center gap-3 border-r px-4 py-3 text-left transition-colors",
                  selected
                    ? "bg-foreground text-background"
                    : "hover:bg-muted/60"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    selected
                      ? "text-background"
                      : "text-muted-foreground"
                  )}
                />

                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-medium">
                    {metric.label}
                  </span>

                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      selected
                        ? "text-background/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {metric.value}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-[220px] items-center justify-end gap-3 px-5 py-3">
          <CircleDollarSign className="size-4 text-muted-foreground" />

          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              Monthly total
            </div>

            <div className="font-semibold tabular-nums">
              {formatMoney(monthlyTotal, currency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}