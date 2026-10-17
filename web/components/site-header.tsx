"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { AuthButton } from "@/components/auth-button";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const navigation = [
  {
    label: "Products",
    href: "/",
    isActive: (
      pathname: string
    ) =>
      pathname === "/" ||
      pathname.startsWith(
        "/items"
      ),
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    isActive: (
      pathname: string
    ) =>
      pathname.startsWith(
        "/subscriptions"
      ),
  },
  {
    label: "Reviews",
    href: "/reviews",
    isActive: (
      pathname: string
    ) =>
      pathname.startsWith(
        "/reviews"
      ),
  },
];

type ReviewCountState = {
  accountId: string;
  count: number | null;
};

export function SiteHeader() {
  const pathname =
    usePathname();

  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [
    reviewCount,
    setReviewCount,
  ] =
    useState<ReviewCountState | null>(
      null
    );

  const pendingReviews =
    ready &&
    account &&
    reviewCount?.accountId ===
      account.homeAccountId
      ? reviewCount.count
      : null;

  useEffect(() => {
    if (!ready || !account) {
      return;
    }

    let cancelled = false;

    const accountId =
      account.homeAccountId;

    async function loadReviewCount() {
      try {
        const token =
          await getAccessToken();

        const result =
          await apiFetch<{
            count: number;
          }>(
            "/api/reviews/pending/count",
            token.accessToken
          );

        if (!cancelled) {
          setReviewCount({
            accountId,
            count: result.count,
          });
        }
      } catch {
        if (!cancelled) {
          setReviewCount({
            accountId,
            count: null,
          });
        }
      }
    }

    void loadReviewCount();

    const onReviewsChanged =
      () => {
        void loadReviewCount();
      };

    window.addEventListener(
      "pricewatch:reviews-changed",
      onReviewsChanged
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "pricewatch:reviews-changed",
        onReviewsChanged
      );
    };
  }, [
    ready,
    account,
    getAccessToken,
    pathname,
  ]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <Link
            href="/"
            className="shrink-0 text-base font-semibold tracking-tight"
          >
            PriceWatch
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {navigation.map(
              (item) => {
                const active =
                  item.isActive(
                    pathname
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
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
                    <span>
                      {
                        item.label
                      }
                    </span>

                    {item.href ===
                      "/reviews" &&
                      pendingReviews !==
                        null && (
                        <span className="rounded-md bg-muted-foreground/10 px-1.5 py-0.5 text-xs tabular-nums">
                          {
                            pendingReviews
                          }
                        </span>
                      )}
                  </Link>
                );
              }
            )}
          </nav>
        </div>

        <div className="shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}