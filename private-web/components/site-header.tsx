"use client";

import { Activity, CalendarClock, Cloud, Package, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@pricewatch/ui/badge";
import { buttonVariants } from "@pricewatch/ui/button";

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
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-muted">
              <Tag className="size-4" />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">PriceWatch Private</span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "sm",
                    className: "shrink-0",
                  })}
                >
                  <Icon />
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
            className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
          >
            <Cloud />
            Cloud
          </a>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            Local
          </Badge>
        )}
      </div>
    </header>
  );
}
