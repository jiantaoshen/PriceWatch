"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUnitPrice } from "@pricewatch/shared/format";
import type { PriceHistoryPoint } from "@/lib/types";

export function PriceHistoryChart({
  history,
  targetUnitPrice,
  currency,
  unit,
}: {
  history: PriceHistoryPoint[];
  targetUnitPrice: number | null;
  currency: string;
  unit: string | null;
}) {
  if (history.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No lowest-price history yet.
      </div>
    );
  }

  const data = history.map((point) => ({
    timestamp: new Date(point.recordedAt).getTime(),
    unitPrice: point.unitPrice,
    stores: point.stores,
  }));

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />

          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) =>
              new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(new Date(value))
            }
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />

          <YAxis
            width={72}
            tickFormatter={(value) =>
              new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(value)
            }
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;

              const point = payload[0].payload as {
                unitPrice: number;
                stores: string[];
              };

              return (
                <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                  <div className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(Number(label)))}
                  </div>
                  <div className="mt-1 font-medium">
                    {formatUnitPrice(point.unitPrice, currency, unit)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {point.stores.join(", ")}
                  </div>
                </div>
              );
            }}
          />

          {targetUnitPrice !== null && (
            <ReferenceLine
              y={targetUnitPrice}
              stroke="currentColor"
              strokeDasharray="6 6"
              opacity={0.45}
              label={{ value: "Target", position: "insideTopRight" }}
            />
          )}

          <Line
            type="stepAfter"
            dataKey="unitPrice"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
