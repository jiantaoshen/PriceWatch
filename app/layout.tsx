// One shared PriceWatch shell; matches the original web's spacing and navigation.
import "./globals.css";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
export const metadata = { title: "PriceWatch", description: "Private local price dashboard" };
export default function Layout({ children }: { children: ReactNode }) {
  return(
    <html lang="zh">
      <body>
        <SiteHeader/>
        <main className="workspace">{children}</main>
      </body>
    </html>
  );
}
