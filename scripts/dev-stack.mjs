import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, ".env.local");

function parseEnv(text) {
  const values = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;

    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    }

    values[key] = value;
  }

  return values;
}

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local in the repository root.");
    console.error("Copy .env.example to .env.local and fill in your local values.");
    process.exit(1);
  }

  const fileEnv = parseEnv(fs.readFileSync(envPath, "utf8"));
  return { ...fileEnv, ...process.env };
}

function assignIfPresent(target, key, value) {
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    target[key] = String(value);
  }
}

function requireValues(env, names, context) {
  const missing = names.filter((name) => !String(env[name] ?? "").trim());
  if (missing.length === 0) return;

  console.error(`Missing required ${context} values in .env.local:`);
  for (const name of missing) console.error(`  - ${name}`);
  process.exit(1);
}

function requireOneOf(env, names, context) {
  if (names.some((name) => String(env[name] ?? "").trim())) return;

  console.error(`Missing required ${context} value in .env.local.`);
  console.error(`Set one of: ${names.join(", ")}`);
  process.exit(1);
}

function buildWebEnv(source, part) {
  const env = { ...source };
  const apiUrl = source.WEB_API_URL || "http://localhost:5128";
  const frontendUrl = source.WEB_FRONTEND_URL || "http://localhost:3000";

  if (part !== "frontend") {
    requireValues(source, ["DATABASE_CONNECTION_STRING"], "web backend");
    requireOneOf(source, ["OWNER_SUB", "OWNER_OID"], "web backend owner identity");
  }

  if (part !== "backend" && part !== "migrate") {
    requireValues(
      source,
      ["WEB_MICROSOFT_CLIENT_ID", "WEB_API_SCOPE"],
      "web frontend"
    );
  }

  assignIfPresent(env, "ConnectionStrings__Database", source.DATABASE_CONNECTION_STRING);
  assignIfPresent(env, "Owner__Sub", source.OWNER_SUB);
  assignIfPresent(env, "Owner__Oid", source.OWNER_OID);
  assignIfPresent(env, "AzureAd__ClientId", source.API_MICROSOFT_CLIENT_ID);
  assignIfPresent(env, "AzureAd__TenantId", source.API_MICROSOFT_TENANT);

  env.ASPNETCORE_ENVIRONMENT = source.ASPNETCORE_ENVIRONMENT || "Development";
  env.ASPNETCORE_URLS = apiUrl;
  env.Frontend__Origin = frontendUrl;

  env.NEXT_PUBLIC_API_URL = apiUrl;
  env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID = source.WEB_MICROSOFT_CLIENT_ID || "";
  env.NEXT_PUBLIC_MICROSOFT_TENANT = source.WEB_MICROSOFT_TENANT || "consumers";
  env.NEXT_PUBLIC_API_SCOPE = source.WEB_API_SCOPE || "";
  env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI =
    source.WEB_MICROSOFT_REDIRECT_URI || `${frontendUrl.replace(/\/$/, "")}/redirect`;

  return env;
}

function buildPrivateEnv(source, part) {
  const env = { ...source };
  const apiUrl = source.PRIVATE_API_URL || "http://127.0.0.1:5188";
  const frontendUrl = source.PRIVATE_FRONTEND_URL || "http://localhost:3001";
  const cloudUrl = source.WEB_FRONTEND_URL || "http://localhost:3000";

  if (part !== "frontend") {
    requireValues(source, ["DATABASE_CONNECTION_STRING"], "private backend");
  }

  assignIfPresent(env, "ConnectionStrings__Database", source.DATABASE_CONNECTION_STRING);
  assignIfPresent(env, "Private__ListenUrl", apiUrl);
  assignIfPresent(env, "Private__FrontendOrigin", frontendUrl);
  assignIfPresent(env, "Private__PythonScript", source.PRIVATE_PYTHON_SCRIPT);
  assignIfPresent(env, "Private__Headless", source.PRIVATE_HEADLESS);
  assignIfPresent(
    env,
    "Private__SuspiciousChangeRatio",
    source.PRIVATE_SUSPICIOUS_CHANGE_RATIO
  );

  if (source.PRIVATE_PYTHON_EXECUTABLE) {
    const pythonExecutable = source.PRIVATE_PYTHON_EXECUTABLE;
    const looksLikePath =
      pythonExecutable.startsWith(".") ||
      pythonExecutable.includes("/") ||
      pythonExecutable.includes("\\");

    env.Private__PythonExecutable = looksLikePath
      ? path.resolve(repoRoot, pythonExecutable)
      : pythonExecutable;
  }

  env.ASPNETCORE_ENVIRONMENT = source.ASPNETCORE_ENVIRONMENT || "Development";
  env.ASPNETCORE_URLS = apiUrl;
  env.NEXT_PUBLIC_PRIVATE_API_URL = apiUrl;
  env.NEXT_PUBLIC_CLOUD_URL = cloudUrl;

  return env;
}

const children = new Set();
let shuttingDown = false;

function stopChild(child) {
  if (!child?.pid || child.killed) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) stopChild(child);
  process.exit(exitCode);
}

function startProcess(label, command, args, env, options = {}) {
  console.log(`\n[${label}] ${command} ${args.join(" ")}`);

  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: options.shell ?? false,
  });

  children.add(child);

  child.on("error", (error) => {
    console.error(`[${label}] Failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    if (signal) {
      console.error(`[${label}] exited because of signal ${signal}.`);
      shutdown(1);
      return;
    }

    if (code !== 0) {
      console.error(`[${label}] exited with code ${code}.`);
      shutdown(code ?? 1);
      return;
    }

    if (children.size > 0) {
      console.log(`[${label}] stopped; stopping the remaining process.`);
      shutdown(0);
    }
  });

  return child;
}

function startFrontend(workspace, env, label) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  startProcess(
    label,
    npmCommand,
    ["run", "dev", `--workspace=${workspace}`],
    env,
    { shell: process.platform === "win32" }
  );
}

function startBackend(projectPath, env, label) {
  startProcess(
    label,
    "dotnet",
    ["run", "--no-launch-profile", "--project", projectPath],
    env
  );
}

const [target, part = "all"] = process.argv.slice(2);

if (!(
  ["web", "private"].includes(target) &&
  ["all", "frontend", "backend", "migrate"].includes(part) &&
  !(target === "private" && part === "migrate")
)) {
  console.error(
    "Usage: node scripts/dev-stack.mjs <web|private> <all|frontend|backend>"
  );
  console.error(
    "       node scripts/dev-stack.mjs web migrate"
  );
  process.exit(1);
}

const sourceEnv = loadLocalEnv();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (target === "web") {
  const env = buildWebEnv(sourceEnv, part);

  if (part === "migrate") {
    console.log("PriceWatch database migration");
    startProcess(
      "ef",
      "dotnet",
      [
        "ef",
        "database",
        "update",
        "--project",
        "src/PriceWatch.Data",
        "--startup-project",
        "src/PriceWatch.WebApi",
      ],
      env
    );
  } else {
    console.log("PriceWatch web local development");
    console.log(`  frontend: ${env.WEB_FRONTEND_URL || "http://localhost:3000"}`);
    console.log(`  api:      ${env.WEB_API_URL || "http://localhost:5128"}`);

    if (part !== "frontend") {
      startBackend("src/PriceWatch.WebApi", env, "web-api");
    }
    if (part !== "backend") {
      startFrontend("web", env, "web");
    }
  }
} else {
  const env = buildPrivateEnv(sourceEnv, part);

  console.log("PriceWatch private local development");
  console.log(`  frontend: ${env.PRIVATE_FRONTEND_URL || "http://localhost:3001"}`);
  console.log(`  api:      ${env.PRIVATE_API_URL || "http://127.0.0.1:5188"}`);

  if (part !== "frontend") {
    startBackend("src/PriceWatch.Private", env, "private-api");
  }
  if (part !== "backend") {
    startFrontend("pricewatch-private-web", env, "private-web");
  }
}
