/**
 * Shared Tailwind utility groups.
 *
 * The source of truth for colors and fonts is app/globals.css (@theme).
 * Small groups here keep JSX readable without reviving legacy CSS selectors.
 */
export const ui = {
  pageHeading:
    "mb-6 flex flex-col items-start justify-between gap-4 " +
    "md:flex-row md:items-end",
  pageTitle: "mb-2 text-3xl font-semibold tracking-tight text-ink",
  sectionTitle: "mb-4 text-lg font-semibold text-ink",
  eyebrow:
    "mb-2 text-[11px] font-bold uppercase tracking-widest text-brand",
  subtitle: "max-w-3xl text-sm leading-6 text-muted",
  muted: "text-sm text-muted",
  small: "text-xs leading-5 text-muted",
  panel: "mb-5 rounded-xl border border-line bg-white p-5 md:p-[22px]",
  twoColumns: "grid grid-cols-1 gap-5 md:grid-cols-2",
  form: "flex flex-col gap-4",
  compactForm: "flex flex-col gap-3",
  label: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
  checkboxLabel:
    "inline-flex items-center gap-2 text-[13px] font-semibold",
  field: [
    "w-full rounded-lg border border-[#cdd9e7] bg-white",
    "px-3 py-2.5 text-sm text-ink outline-none",
    "focus:border-brand focus:ring-2 focus:ring-[#b5cce6]",
    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
  ].join(" "),
  checkbox: "size-4 shrink-0 accent-brand",
  button: [
    "inline-flex cursor-pointer items-center justify-center gap-1.5",
    "rounded-lg border border-brand bg-brand px-4 py-2.5",
    "text-[13px] font-semibold text-white no-underline transition-colors",
    "hover:border-brand-dark hover:bg-brand-dark",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  secondaryButton: [
    "inline-flex cursor-pointer items-center justify-center gap-1.5",
    "rounded-lg border border-line bg-white px-4 py-2.5",
    "text-[13px] font-semibold text-ink no-underline transition-colors",
    "hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  dangerButton: [
    "inline-flex cursor-pointer items-center justify-center",
    "rounded-lg border border-red-200 bg-white px-4 py-2.5",
    "text-[13px] font-semibold text-red-700 transition-colors",
    "hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  buttonRow: "flex flex-wrap items-center gap-2.5",
  note: "mb-5 rounded-lg border p-4 text-[13px] leading-6",
  infoNote: "border-line bg-[#f3f7fc] text-[#344968]",
  errorNote: "border-red-200 bg-red-50 text-red-800",
  successNote: "border-green-200 bg-green-50 text-green-800",
  empty: [
    "rounded-xl border border-dashed border-line px-6 py-10",
    "text-center text-sm text-muted",
  ].join(" "),
  tableWrap: "overflow-x-auto",
  table: "w-full border-collapse text-left text-[13px]",
  th: [
    "whitespace-nowrap border-b border-line px-2.5 py-3",
    "text-xs font-semibold text-muted",
  ].join(" "),
  td: "border-b border-slate-100 px-2.5 py-3 align-top",
  metricGrid:
    "mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4",
  metric: "rounded-xl border border-line bg-white p-4.5",
  metricLabel: "text-xs text-muted",
  metricValue:
    "mt-2 text-[26px] font-semibold tracking-tight text-ink",
  tag: [
    "inline-flex items-center rounded-md px-2 py-1",
    "text-xs font-medium",
  ].join(" "),
  tagNeutral: "bg-slate-100 text-muted",
  tagGood: "bg-green-50 text-green-800",
  tagWarn: "bg-amber-50 text-amber-800",
  tagBad: "bg-red-50 text-red-800",
} as const;

/** Combine a static utility group with optional state-specific classes. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
