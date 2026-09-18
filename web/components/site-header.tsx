"use client";

import {
  CircleAlert,
  CreditCard,
  Package,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { cn } from "@/lib/utils";

const navigation = [
  {
    label: "Products",
    href: "/",
    icon: Package,
    isActive: (pathname: string) =>
      pathname === "/" ||
      pathname.startsWith("/items"),
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
    isActive: (pathname: string) =>
      pathname.startsWith("/subscriptions"),
  },
  {
    label: "Reviews",
    href: "/reviews",
    icon: CircleAlert,
    isActive: (pathname: string) =>
      pathname.startsWith("/reviews"),
  },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
          >
            <div className="flex size-9 items-center justify-center rounded-xl border bg-muted/40">
              <Tag className="size-4" />
            </div>

            <span className="hidden text-base font-semibold tracking-tight sm:inline">
              PriceWatch
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                item.isActive(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
