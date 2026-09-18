"use client";

import {
  Activity,
  CalendarClock,
  Cloud,
  Package,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/items", label: "Items", icon: Package },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
];

export function SiteHeader() {
  const pathname = usePathname();
  const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_URL;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
              <Tag className="size-4" />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              PriceWatch Private
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {cloudUrl ? (
          <a
            href={cloudUrl}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            <Cloud className="size-4" />
            Cloud
          </a>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
            Local
          </span>
        )}
      </div>
    </header>
  );
}
