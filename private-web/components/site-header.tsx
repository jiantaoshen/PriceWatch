"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@pricewatch/ui/badge";
import { buttonVariants } from "@pricewatch/ui/button";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/items", label: "Items" },
  { href: "/runs", label: "Runs" },
  { href: "/schedule", label: "Schedule" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_URL;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            PriceWatch Private
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => {
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
            Cloud
          </a>
        ) : (
          <Badge variant="secondary" className="shrink-0">Local</Badge>
        )}
      </div>
    </header>
  );
}
