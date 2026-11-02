// Local-only API: inspect or start one fixed Windows Task Scheduler task.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const run = promisify(execFile);
const taskName = "PriceWatchLocalScraper";

function allowedHost(request: Request): boolean {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost";
}

function blocked(request: Request, write: boolean): Response | undefined {
  if (!allowedHost(request)) {
    return Response.json({ error: "Local access only" }, { status: 403 });
  }
  if (process.platform !== "win32") {
    return Response.json({ error: "Windows Task Scheduler required" }, { status: 501 });
  }
  if (write) {
    // Reject cross-site requests: this route can start a local OS task.
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) {
      return Response.json({ error: "Forbidden origin" }, { status: 403 });
    }
  }
}

const inspect = String.raw`
$ErrorActionPreference = 'Stop'
$t = Get-ScheduledTask -TaskPath '\' -TaskName 'PriceWatchLocalScraper' -ErrorAction SilentlyContinue
if (-not $t) { '{"installed":false}'; exit 0 }
$i = Get-ScheduledTaskInfo -InputObject $t
[pscustomobject]@{
  installed = $true
  state = [string]$t.State
  nextRun = $i.NextRunTime.ToString('o')
  lastRun = $i.LastRunTime.ToString('o')
  lastResult = [int]$i.LastTaskResult
} | ConvertTo-Json -Compress
`;

export async function GET(request: Request) {
  const denied = blocked(request, false);
  if (denied) return denied;
  try {
    const { stdout } = await run("powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", inspect],
      { windowsHide: true, timeout: 15000 });
    return Response.json(JSON.parse(stdout.trim()),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Scheduler status error:", error);
    return Response.json({ error: "Cannot read scheduled task" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = blocked(request, true);
  if (denied) return denied;
  try {
    // No shell and no user-controlled command arguments.
    await run("schtasks.exe", ["/Run", "/TN", `\\${taskName}`],
      { windowsHide: true, timeout: 15000 });
    return Response.json({ ok: true, message: "Run requested" });
  } catch (error) {
    console.error("Scheduler launch error:", error);
    return Response.json({ error: "Failed to start task. Check that it is installed." },
      { status: 500 });
  }
}
