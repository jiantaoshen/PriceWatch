/** Display money and timestamps stored as text in SQLite. */
export function money(value: unknown, currency = "SEK"): string {
  if (value === null || value === undefined || value === "") return "—";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return `${amount.toLocaleString("sv-SE", {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function time(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));
  return Number.isNaN(date.valueOf())
    ? String(value)
    : date.toLocaleString("sv-SE");
}

export function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
