import Link from "next/link";
import type { Row } from "../lib/db";
import { text } from "../lib/format";
import { listItems } from "../lib/queries";
import { cx, ui } from "../lib/ui";
import { PageHeading } from "./page-heading";
import { ProductCard } from "./product-card";

type ProductListProps = {
  filter: string;
  search: string;
  sort?: string;
};

function isBelowTarget(item: Row): boolean {
  return (
    item.current_unit_price != null &&
    item.target_unit_price != null &&
    Number(item.current_unit_price) <= Number(item.target_unit_price)
  );
}

function isPriceDrop(item: Row): boolean {
  return (
    item.current_unit_price != null &&
    item.previous_unit_price != null &&
    Number(item.current_unit_price) < Number(item.previous_unit_price)
  );
}

function isPriceIncrease(item: Row): boolean {
  return (
    item.current_unit_price != null &&
    item.previous_unit_price != null &&
    Number(item.current_unit_price) > Number(item.previous_unit_price)
  );
}

export function ProductList({
  filter,
  search,
  sort = "name",
}: ProductListProps) {
  const all = listItems();
  const active = all.filter((item) => !item.archived_at);

  const counts = {
    active: active.length,
    archived: all.length - active.length,
    below: active.filter(isBelowTarget).length,
    drops: active.filter(isPriceDrop).length,
    increases: active.filter(isPriceIncrease).length,
  };

  const selected = all.filter((item) => {
    if (filter === "archived") return Boolean(item.archived_at);
    if (item.archived_at) return false;

    switch (filter) {
      case "below":
        return isBelowTarget(item);
      case "drops":
        return isPriceDrop(item);
      case "increases":
        return isPriceIncrease(item);
      default:
        return true;
    }
  });

  const query = search.toLowerCase();
  const visible = selected.filter((item) =>
    `${text(item.name)} ${text(item.current_stores)}`
      .toLowerCase()
      .includes(query),
  );

  visible.sort((a, b) => {
    if (sort === "price") {
      return (
        Number(a.current_unit_price ?? Infinity) -
        Number(b.current_unit_price ?? Infinity)
      );
    }

    if (sort === "gap") {
      return (
        Number(a.current_unit_price ?? Infinity) -
        Number(a.target_unit_price ?? 0) -
        (Number(b.current_unit_price ?? Infinity) -
          Number(b.target_unit_price ?? 0))
      );
    }

    return text(a.name).localeCompare(text(b.name));
  });

  const filters = [
    { id: "active", label: "Active", count: counts.active },
    { id: "below", label: "Below target", count: counts.below },
    { id: "drops", label: "Price drops", count: counts.drops },
    { id: "increases", label: "Price increases", count: counts.increases },
    { id: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <>
      <PageHeading
        title="Products"
        description="Compare normalized prices, watch targets, and keep archived items for later."
        action={
          <Link href="/items/new" className={ui.button}>
            + Add product
          </Link>
        }
      />

      <nav aria-label="Item filters" className="mb-5 flex flex-wrap gap-2">
        {filters.map(({ id, label, count }) => (
          <Link
            key={id}
            href={`/?filter=${id}`}
            className={cx(
              "rounded-lg border border-line px-3 py-2 text-[13px] font-semibold no-underline",
              filter === id
                ? "bg-[#edf3f9] text-ink"
                : "bg-white text-muted hover:bg-soft hover:text-ink",
            )}
          >
            {label} · {count}
          </Link>
        ))}
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          action="/"
          method="get"
          className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-nowrap"
        >
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search products or stores…"
            aria-label="Search items"
            className={cx(ui.field, "min-w-0 sm:max-w-[420px]")}
          />
          <select
            name="sort"
            defaultValue={sort}
            aria-label="Sort items"
            className={cx(ui.field, "w-auto min-w-40")}
          >
            <option value="name">Name</option>
            <option value="price">Current price</option>
            <option value="gap">Target gap</option>
          </select>
          <button type="submit" className={ui.secondaryButton}>
            Apply
          </button>
        </form>
      </div>

      <p className={cx(ui.small, "mb-4")}>
        Showing {visible.length} product
        {visible.length === 1 ? "" : "s"}
      </p>

      {visible.length > 0 ? (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ProductCard key={text(item.id)} item={item} />
          ))}
        </section>
      ) : (
        <div className={ui.empty}>
          No matching products. Add a product or change the filter.
        </div>
      )}
    </>
  );
}
