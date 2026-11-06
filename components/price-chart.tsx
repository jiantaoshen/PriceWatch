import type { Row } from "../lib/db";
import { money, time } from "../lib/format";
import { ui } from "../lib/ui";

type PriceChartProps = {
  points: Row[];
  target: unknown;
  currency: string;
};

/** A tiny dependency-free stepped chart; all chart logic is unchanged. */
export function PriceChart({ points, target, currency }: PriceChartProps) {
  const values = points
    .map((point) => Number(point.unit_price))
    .filter(Number.isFinite);

  if (values.length === 0) {
    return <div className={ui.empty}>No lowest-price history yet.</div>;
  }

  const targetPrice = target == null ? null : Number(target);
  const bounded = targetPrice == null ? values : [...values, targetPrice];
  const min = Math.min(...bounded);
  const max = Math.max(...bounded);
  const lower = min === max ? min - 1 : min - (max - min) * 0.12;
  const upper = min === max ? max + 1 : max + (max - min) * 0.12;

  const x = (index: number) => 75 + (index * 790) / Math.max(values.length - 1, 1);
  const y = (value: number) => 235 - ((value - lower) / (upper - lower)) * 205;

  let path = `M ${x(0)} ${y(values[0])}`;
  for (let index = 1; index < values.length; index++) {
    path += ` H ${x(index)} V ${y(values[index])}`;
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <svg
        viewBox="0 0 900 275"
        role="img"
        aria-label="Best price history trend"
        preserveAspectRatio="xMidYMid meet"
        className="max-h-[340px] min-w-[450px] w-full"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const price = lower + (upper - lower) * fraction;

          return (
            <g key={fraction}>
              <line
                x1="75"
                y1={y(price)}
                x2="865"
                y2={y(price)}
                stroke="#dce8f5"
                strokeDasharray="3 5"
              />
              <text
                x="64"
                y={y(price) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#5f6c84"
              >
                {price.toFixed(1)}
              </text>
            </g>
          );
        })}

        {targetPrice != null && (
          <g>
            <line
              x1="75"
              x2="865"
              y1={y(targetPrice)}
              y2={y(targetPrice)}
              stroke="#a16207"
              strokeDasharray="8 6"
            />
            <text
              x="860"
              y={y(targetPrice) - 8}
              textAnchor="end"
              fontSize="12"
              fill="#a16207"
            >
              Target
            </text>
          </g>
        )}

        <path
          d={path}
          stroke="#5576a3"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        <circle
          cx={x(values.length - 1)}
          cy={y(values[values.length - 1])}
          r="4"
          fill="#5576a3"
        />
        <text x="75" y="260" fill="#5f6c84" fontSize="12">
          {time(points[0]?.recorded_at)}
        </text>
        <text
          x="865"
          y="260"
          fill="#5f6c84"
          fontSize="12"
          textAnchor="end"
        >
          {time(points[points.length - 1]?.recorded_at)}
        </text>
      </svg>

      <p className={ui.small}>
        Latest best: {money(values[values.length - 1], currency)}
      </p>
    </div>
  );
}
