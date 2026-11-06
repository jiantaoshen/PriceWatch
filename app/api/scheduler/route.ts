// Loopback-only API to one fixed, application-owned Windows Scheduled Task.
// Never accept arbitrary executable paths, task names, PowerShell, or commands from HTTP.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exec = promisify(execFile);
const script = path.resolve(process.cwd(), "scripts", "manage-scheduler.ps1");
const validOperations = new Set(["save", "run", "stop", "enable", "disable", "remove"]);
const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

type ScheduleCommand = {
  operation: string;
  at?: string;
  frequency?: string;
  days?: string[];
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: responseHeaders });
}

function localHost(value: string | null): boolean {
  if (!value || value.includes(",") || value.includes("/") || value.includes("@") || value.includes("\\") || /\s/.test(value)) return false;
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch { return false; }
}

function blocked(request: Request, write: boolean): Response | null {
  // A hostname-only check of request.url is insufficient behind proxies.
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!localHost(host) || !localHost(new URL(request.url).host) ||
      (forwardedHost !== null && forwardedHost.toLowerCase() !== host?.toLowerCase())) {
    return json({ error: "This app can only be controlled on localhost." }, 403);
  }
  if (process.platform !== "win32") {
    return json({ error: "Windows Task Scheduler is only available on Windows." }, 501);
  }
  if (write) {
    const origin = request.headers.get("origin");
    const expected = `http://${host}`;
    const fetchSite = request.headers.get("sec-fetch-site");
    if (origin !== expected || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) {
      return json({ error: "Cross-origin scheduler operations are blocked." }, 403);
    }
  }
  return null;
}

async function invoke(args: string[]): Promise<Response> {
  // Launch PowerShell directly, not via cmd.exe or a shell. All argument values
  // are literals or validated enums/times/days; the script path is fixed.
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows",
    "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  try {
    const { stdout } = await exec(powershell,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", script, ...args],
      { cwd: process.cwd(), windowsHide: true, timeout: 30_000, maxBuffer: 256 * 1024 });
    const result: unknown = JSON.parse(stdout.trim());
    if (!result || typeof result !== "object" || Array.isArray(result) ||
        typeof (result as { installed?: unknown }).installed !== "boolean") {
      throw new Error("Unexpected Windows Task Scheduler response");
    }
    return json(result);
  } catch (error) {
    const details = error as { stderr?: string; killed?: boolean; code?: unknown; message?: string };
    console.error("Scheduler operation failed:", details.message);
    const stderr = (typeof details.stderr === "string" ? details.stderr : "").trim();
    // The PowerShell helper emits a single plain-language diagnostic on failure.
    const message = stderr ? stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0].slice(0, 400)
      : details.killed ? "Windows Task Scheduler did not respond in time."
      : "Scheduler operation failed. Check Windows permissions, Python and the database.";
    return json({ error: message }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const denied = blocked(request, false);
  return denied || invoke(["-Operation", "status"]);
}

export async function POST(request: Request): Promise<Response> {
  const denied = blocked(request, true);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected JSON request." }, 415);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 2_048) return json({ error: "Request too large." }, 413);

  let command: ScheduleCommand;
  try {
    const raw = await request.text();
    if (raw.length > 2_048) return json({ error: "Request too large." }, 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid payload");
    command = body as ScheduleCommand;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (typeof command.operation !== "string" || !validOperations.has(command.operation)) {
    return json({ error: "Unknown scheduler operation." }, 400);
  }
  const keys = Object.keys(command);
  if (keys.some(key => !["operation", "at", "frequency", "days"].includes(key))) {
    return json({ error: "Unsupported scheduler setting." }, 400);
  }
  if (command.operation !== "save") {
    if (keys.length !== 1) return json({ error: "Unexpected operation parameters." }, 400);
    return invoke(["-Operation", command.operation]);
  }
  if (typeof command.at !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.at) ||
      (command.frequency !== "daily" && command.frequency !== "weekly")) {
    return json({ error: "Select a valid time and recurrence." }, 400);
  }
  if (!Array.isArray(command.days) || !command.days.every((day): day is string => typeof day === "string") ||
      command.days.length > 7 || (command.frequency === "weekly" && command.days.length === 0) ||
      new Set(command.days).size !== command.days.length ||
      command.days.some(day => !validDays.includes(day as typeof validDays[number]))) {
    return json({ error: "Choose valid weekdays." }, 400);
  }
  return invoke(["-Operation", "save", "-At", command.at,
    "-Frequency", command.frequency, "-Days", (command.days[0] ? command.days.join(",") : "Monday")]);
}
