export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatUnitPrice(
  value: number | null | undefined,
  currency: string,
  unit: string | null
) {
  if (value === null || value === undefined) return "—";

  const amount = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

  return `${amount} ${currency}${unit ? `/${unit}` : ""}`;
}
