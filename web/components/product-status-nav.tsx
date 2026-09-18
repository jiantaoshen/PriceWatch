"use client";

import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductFilter } from "@/lib/types";

type Metric = {
  key: ProductFilter;
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
};

export function ProductStatusNav({
  activeFilter,
  onChange,
  active,
  archived,
  belowTarget,
  needsReview,
  drops,
  increases,
}: {
  activeFilter: ProductFilter;
  onChange: (value: ProductFilter) => void;
  active: number;
  archived: number;
  belowTarget: number;
  needsReview: number;
  drops: number;
  increases: number;
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
      icon: BadgeCheck,
    },
    {
      key: "needs-review",
      label: "Needs review",
      value: needsReview,
      icon: CircleAlert,
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
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
      <nav className="flex min-w-max items-center gap-1">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const selected = metric.key === activeFilter;

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => onChange(metric.key)}
              className={cn(
                "flex min-w-[142px] items-center justify-between gap-4 rounded-lg px-3.5 py-2.5 text-left transition-colors",
                selected
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground hover:bg-muted/70"
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    selected
                      ? "text-background/80"
                      : "text-muted-foreground"
                  )}
                />

                <span className="text-sm font-medium">
                  {metric.label}
                </span>
              </span>

              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                  selected
                    ? "bg-background/15 text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {metric.value}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
