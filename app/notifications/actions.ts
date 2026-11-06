"use server";
// Send a sample desktop notification without creating a price alert event.
import { redirect } from "next/navigation";
import { execFileSync } from "node:child_process";
import path from "node:path";

export async function testNotificationAction() {
  let status = "sent";
  try {
    execFileSync(process.env.PRICEWATCH_PYTHON || "python",
      [path.join(process.cwd(), "scraper", "windows_alerts.py"), "--test"],
      { cwd: process.cwd(), timeout: 30000, encoding: "utf8" });
  } catch (error) {
    console.error("Windows notification test failed:", error instanceof Error ? error.message : "unknown");
    status = "error";
  }
  redirect(`/notifications?message=${status}`);
}
