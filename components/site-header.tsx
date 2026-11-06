"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../lib/ui";

const tabs = [
  { href: "/", title: "Products" },
  { href: "/subscriptions", title: "Subscriptions" },
  { href: "/runs", title: "Scrape runs" },
  { href: "/notifications", title: "Notifications" },
  { href: "/schedule", title: "Schedule" },
];

const navLink =
  "inline-flex shrink-0 items-center rounded-lg px-3 py-2.5 text-sm " +
  "font-semibold no-underline transition-colors hover:bg-soft hover:text-ink";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="shrink-0 text-[17px] font-bold tracking-tight text-ink no-underline"
        >
          PriceWatch
        </Link>

        <nav
          aria-label="Main navigation"
          className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto"
        >
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/" || pathname.startsWith("/items")
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  navLink,
                  active
                    ? "bg-[#f0f4f9] text-ink"
                    : "text-muted",
                )}
              >
                {tab.title}
              </Link>
            );
          })}
        </nav>

        <span className="shrink-0 rounded-lg border border-line bg-[#edf4fc] px-2.5 py-1.5 text-xs font-semibold text-brand">
          Local · SQLite
        </span>
      </div>
    </header>
  );
}
