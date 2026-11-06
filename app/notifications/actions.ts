"use server";

// A sample notification must not create a price-alert event in SQLite.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { redirect } from "next/navigation";

export async function testNotificationAction() {
  let status = "sent";

  try {
    execFileSync(
      process.env.PRICEWATCH_PYTHON || "python",
      [path.join(process.cwd(), "scraper", "windows_alerts.py"), "--test"],
      {
        cwd: process.cwd(),
        timeout: 30_000,
        encoding: "utf8",
      },
    );
  } catch (error) {
    console.error(
      "Windows notification test failed:",
      error instanceof Error ? error.message : "unknown",
    );
    status = "error";
  }

  redirect(`/notifications?message=${status}`);
}
