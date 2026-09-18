export function formatMoney(
  value: number | null | undefined,
  currency = "SEK"
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

export function formatUnitPrice(
  value: number | null | undefined,
  currency = "SEK",
  unit?: string | null
) {
  if (value === null || value === undefined) {
    return "—";
  }

  const amount = formatMoney(
    value,
    currency
  );

  return unit
    ? `${amount}/${unit}`
    : amount;
}

export function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

export function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

export function formatRelativeDifference(
  current: number | null | undefined,
  reference: number | null | undefined,
  currency = "SEK"
) {
  if (
    current === null ||
    current === undefined ||
    reference === null ||
    reference === undefined
  ) {
    return null;
  }

  const difference =
    current - reference;

  if (difference === 0) {
    return "At target";
  }

  const formatted =
    new Intl.NumberFormat(
      "sv-SE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(
      Math.abs(difference)
    );

  return difference < 0
    ? `${formatted} ${currency} below`
    : `${formatted} ${currency} above`;
}