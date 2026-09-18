"use client";

import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Radar,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SubscriptionFilter =
  | "active"
  | "archived"
  | "below-target"
  | "drops"
  | "increases"
  | "no-price";

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
  belowTarget,
  drops,
  increases,
  noPrice,
}: {
  activeFilter: SubscriptionFilter;
  onChange:
    (value: SubscriptionFilter) => void;
  active: number;
  archived: number;
  belowTarget: number;
  drops: number;
  increases: number;
  noPrice: number;
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
    {
      key: "below-target",
      label: "Below target",
      value: belowTarget,
      icon: Target,
    },
    {
      key: "drops",
      label: "Price drops",
      value: drops,
      icon: ArrowDownRight,
    },
    {
      key: "increases",
      label: "Price increases",
      value: increases,
      icon: ArrowUpRight,
    },
    {
      key: "no-price",
      label: "No price",
      value: noPrice,
      icon: CircleDollarSign,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <nav className="flex min-w-max items-stretch">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const selected =
            metric.key === activeFilter;

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() =>
                onChange(metric.key)
              }
              className={cn(
                "group flex min-w-[150px] items-center gap-3 border-r px-4 py-3 text-left transition-colors last:border-r-0",
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
    </div>
  );
}
