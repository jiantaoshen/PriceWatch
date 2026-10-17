"use client";

import { cn } from "@/lib/utils";
import type { ProductFilter } from "@/lib/types";

export function ProductStatusNav({
  activeFilter,
  onChange,
  active,
  archived,
  belowTarget,
  drops,
  increases,
}: {
  activeFilter: ProductFilter;
  onChange: (value: ProductFilter) => void;
  active: number;
  archived: number;
  belowTarget: number;
  drops: number;
  increases: number;
}) {
  const metrics: Array<{ key: ProductFilter; label: string; value: number }> = [
    { key: "active", label: "Active", value: active },
    { key: "archived", label: "Archived", value: archived },
    { key: "below-target", label: "Below target", value: belowTarget },
    { key: "drops", label: "Price drops", value: drops },
    { key: "increases", label: "Price increases", value: increases },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
      <nav className="flex min-w-max items-center gap-1">
        {metrics.map((metric) => {
          const selected = metric.key === activeFilter;

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => onChange(metric.key)}
              className={cn(
                "flex min-w-[132px] items-center justify-between gap-4 rounded-lg px-3.5 py-2.5 text-left transition-colors",
                selected
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground hover:bg-muted/70"
              )}
            >
              <span className="text-sm font-medium">{metric.label}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                  selected ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"
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
