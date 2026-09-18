import type { ReactNode } from "react";

export function Page({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: ReactNode;
  help?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {help && <div className="mt-2 text-xs text-zinc-500">{help}</div>}
    </Card>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const classes = normalized === "success"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : normalized === "failed"
      ? "bg-red-50 text-red-700 ring-red-200"
      : normalized === "suspicious" || normalized === "partial" || normalized === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-zinc-100 text-zinc-700 ring-zinc-200";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${classes}`}>
      {value}
    </span>
  );
}

export const primaryButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50";

export const outlineButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50";
