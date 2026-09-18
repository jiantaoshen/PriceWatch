import Link from "next/link";
import { Tag } from "lucide-react";
import { AuthButton } from "@/components/auth-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
        >
          <div className="flex size-9 items-center justify-center rounded-xl border bg-muted/40">
            <Tag className="size-4" />
          </div>

          <span className="text-base font-semibold tracking-tight">
            PriceWatch
          </span>
        </Link>

        <AuthButton />
      </div>
    </header>
  );
}
