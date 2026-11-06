import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

export const metadata = {
  title: "PriceWatch",
  description: "Private local price dashboard",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <SiteHeader />
        <main className="mx-auto min-h-[calc(100vh-122px)] max-w-7xl px-4 py-7 md:px-6 md:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
