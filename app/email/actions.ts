"use server";
// Email form actions: save SMTP settings, then optionally send an explicit test.
import { redirect } from "next/navigation";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { databasePath } from "../../lib/db";
import { saveEmailSettings } from "../../lib/email-settings";
export async function saveSettingsAction(form:FormData) {
  saveEmailSettings(form);
  redirect("/email?message=saved");
}
export async function testEmailAction() {
  let status="sent";
  try {
    execFileSync(process.env.PRICEWATCH_PYTHON || "python",
      [path.join(process.cwd(), "scraper", "mail_alerts.py"), "--test"],
      {cwd:process.cwd(),timeout:30000,encoding:"utf8",env:{...process.env,PRICEWATCH_SQLITE_PATH:databasePath()}});
  } catch(error) {
    console.error("Email test failed:", error instanceof Error ? error.message : "unknown");
    status="error";
  }
  redirect(`/email?message=${status}`);
}
