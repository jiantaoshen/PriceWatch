"use client";
// Keep the original top navigation, now linking public and private local tabs.
import Link from "next/link";
import { usePathname } from "next/navigation";
const tabs = [
  { href: "/", title: "Products" },
  { href: "/subscriptions", title: "Subscriptions" },
  { href: "/reviews", title: "Reviews" },
  { href: "/runs", title: "Scrape runs" },
  { href: "/email", title: "Email alerts" },
  { href: "/schedule", title: "Schedule" },
];
export function SiteHeader() {
  const current = usePathname();
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/">PriceWatch</Link>
    <nav className="top-nav" aria-label="Main navigation">
      {tabs.map(t => {
        const active = t.href === "/" ? current === "/" || current.startsWith("/items") : current.startsWith(t.href);
        return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>{t.title}</Link>;
      })}
    </nav><span className="local-badge">Local · SQLite</span>
  </div></header>;
}
