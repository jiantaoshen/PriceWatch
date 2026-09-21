import type { ItemListItem } from "@/lib/types";

export type ItemSort =
  | "name"
  | "current-price"
  | "target-gap"
  | "last-checked";

export function isActiveItem(item: ItemListItem) {
  return !item.archivedAt;
}

export function isArchivedItem(item: ItemListItem) {
  return Boolean(item.archivedAt);
}

export function isBelowTarget(item: ItemListItem) {
  return (
    item.currentUnitPrice !== null &&
    item.targetUnitPrice !== null &&
    item.currentUnitPrice <= item.targetUnitPrice
  );
}

export function hasPriceDrop(item: ItemListItem) {
  return (
    item.currentUnitPrice !== null &&
    item.previousUnitPrice !== null &&
    item.currentUnitPrice < item.previousUnitPrice
  );
}

export function hasPriceIncrease(item: ItemListItem) {
  return (
    item.currentUnitPrice !== null &&
    item.previousUnitPrice !== null &&
    item.currentUnitPrice > item.previousUnitPrice
  );
}

export function matchesItemSearch(
  item: ItemListItem,
  search: string
) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(query) ||
    item.currentStore?.toLowerCase().includes(query) === true
  );
}

export function sortItems(
  items: ItemListItem[],
  sort: ItemSort
) {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "current-price":
        return compareNullableNumbers(
          a.currentUnitPrice,
          b.currentUnitPrice
        );

      case "target-gap":
        return compareNullableNumbers(
          targetGap(a),
          targetGap(b)
        );

      case "last-checked":
        return compareNullableDates(
          b.lastCheckedAt,
          a.lastCheckedAt
        );

      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

function targetGap(item: ItemListItem) {
  if (
    item.currentUnitPrice === null ||
    item.targetUnitPrice === null
  ) {
    return null;
  }

  return item.currentUnitPrice - item.targetUnitPrice;
}

function compareNullableNumbers(
  a: number | null,
  b: number | null
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareNullableDates(
  a: string | null,
  b: string | null
) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  return (
    new Date(a).getTime() -
    new Date(b).getTime()
  );
}
