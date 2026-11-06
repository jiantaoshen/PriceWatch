import Link from "next/link";
import type { Row } from "../lib/db";
import { money, text } from "../lib/format";
import { cx, ui } from "../lib/ui";

type ProductCardProps = {
  item: Row;
};

export function ProductCard({ item }: ProductCardProps) {
  const current =
    item.current_unit_price == null ? null : Number(item.current_unit_price);
  const target =
    item.target_unit_price == null ? null : Number(item.target_unit_price);
  const previous =
    item.previous_unit_price == null ? null : Number(item.previous_unit_price);

  const belowTarget = current != null && target != null && current <= target;
  const archived = Boolean(item.archived_at);
  const currency = text(item.currency) || "SEK";

  const changePercent =
    current != null && previous != null && previous > 0
      ? (((current - previous) / previous) * 100).toFixed(1)
      : null;

  return (
    <article
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-line",
        archived ? "bg-slate-50" : "bg-white",
      )}
    >
      <div
        className={cx(
          "h-1 shrink-0",
          belowTarget ? "bg-price-good" : "bg-line",
        )}
      />

      <div className="flex-1 px-5 pb-4 pt-5">
        <h3 className="mb-2 min-h-12 text-base font-semibold leading-snug">
          {text(item.name)}
        </h3>

        <div className="mb-7 flex flex-wrap gap-3 text-xs text-muted">
          <span>{item.sources} stores</span>
          <span>
            {archived
              ? "Archived"
              : item.tracking_enabled
                ? "Tracking ON"
                : "Tracking OFF"}
          </span>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Last known unit price
        </p>
        <p
          className={cx(
            "my-2 text-[28px] font-semibold tracking-tight",
            belowTarget && "text-price-good",
          )}
        >
          {money(item.current_unit_price, currency)}
        </p>

        <p className="mb-6 min-h-5 text-[13px] text-muted">
          {item.current_stores ? (
            <>
              Best at <strong className="font-semibold text-ink">{text(item.current_stores)}</strong>
            </>
          ) : (
            "Waiting for a price"
          )}
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0 rounded-xl border border-line p-3">
            <p className="mb-2 text-xs text-muted">Target</p>
            <strong className="text-sm font-semibold">
              {money(item.target_unit_price, currency)}
            </strong>
          </div>
          <div className="min-w-0 rounded-xl border border-line p-3">
            <p className="mb-2 text-xs text-muted">Previous</p>
            <strong className="text-sm font-semibold">
              {money(item.previous_unit_price, currency)}
            </strong>
            {changePercent !== null && (
              <p className={ui.small}>{changePercent}%</p>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
        <span className={cx(ui.tag, belowTarget ? ui.tagGood : ui.tagNeutral)}>
          {belowTarget ? "Below target" : archived ? "Archived" : "Monitoring"}
        </span>
        <Link
          href={`/items/${encodeURIComponent(text(item.id))}`}
          className="text-[13px] font-semibold text-brand hover:underline"
        >
          View details →
        </Link>
      </footer>
    </article>
  );
}
