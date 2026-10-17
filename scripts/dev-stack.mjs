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

function removeAppSecrets(env) {
  for (const key of [
    "DATABASE_CONNECTION_STRING",
    "ConnectionStrings__Database",
    "OWNER_SUB",
    "OWNER_OID",
    "API_MICROSOFT_CLIENT_ID",
    "API_MICROSOFT_TENANT",
    "AzureAd__ClientId",
    "AzureAd__TenantId",
    "PRIVATE_API_TOKEN",
    "Private__ApiToken",
    "EMAIL_ENABLED",
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_USE_SSL",
    "EMAIL_TIMEOUT_SECONDS",
    "EMAIL_USERNAME",
    "EMAIL_PASSWORD",
    "EMAIL_FROM",
    "EMAIL_TO",
    "Email__Enabled",
    "Email__SmtpHost",
    "Email__SmtpPort",
    "Email__UseSsl",
    "Email__TimeoutSeconds",
    "Email__Username",
    "Email__Password",
    "Email__From",
    "Email__To",
  ]) {
    delete env[key];
  }

  return env;
}

function buildWebEnvs(source, part) {
  const apiUrl = source.WEB_API_URL || "http://localhost:5128";
  const frontendUrl = source.WEB_FRONTEND_URL || "http://localhost:3000";
  const backendEnv = { ...process.env };
  const frontendEnv = removeAppSecrets({ ...process.env });

  if (part === "backend" || part === "all") {
    requireValues(source, ["DATABASE_CONNECTION_STRING"], "web backend");
    requireOneOf(source, ["OWNER_SUB", "OWNER_OID"], "web backend owner identity");
  }

  if (part === "migrate") {
    requireValues(source, ["DATABASE_CONNECTION_STRING"], "database migration");
  }

  if (part === "frontend" || part === "all") {
    requireValues(
      source,
      ["WEB_MICROSOFT_CLIENT_ID", "WEB_API_SCOPE"],
      "web frontend"
    );
  }

  if (part !== "frontend") {
    assignIfPresent(
      backendEnv,
      "ConnectionStrings__Database",
      source.DATABASE_CONNECTION_STRING
    );
    assignIfPresent(backendEnv, "Owner__Sub", source.OWNER_SUB);
    assignIfPresent(backendEnv, "Owner__Oid", source.OWNER_OID);
    assignIfPresent(
      backendEnv,
      "AzureAd__ClientId",
      source.API_MICROSOFT_CLIENT_ID
    );
    assignIfPresent(
      backendEnv,
      "AzureAd__TenantId",
      source.API_MICROSOFT_TENANT
    );

    backendEnv.ASPNETCORE_ENVIRONMENT =
      source.ASPNETCORE_ENVIRONMENT || "Development";
    backendEnv.ASPNETCORE_URLS = apiUrl;
    backendEnv.Frontend__Origin = frontendUrl;
  }

  if (part === "frontend" || part === "all") {
    frontendEnv.NEXT_PUBLIC_API_URL = apiUrl;
    frontendEnv.NEXT_PUBLIC_MICROSOFT_CLIENT_ID =
      source.WEB_MICROSOFT_CLIENT_ID || "";
    frontendEnv.NEXT_PUBLIC_MICROSOFT_TENANT =
      source.WEB_MICROSOFT_TENANT || "consumers";
    frontendEnv.NEXT_PUBLIC_API_SCOPE = source.WEB_API_SCOPE || "";
    frontendEnv.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI =
      source.WEB_MICROSOFT_REDIRECT_URI ||
      `${frontendUrl.replace(/\/$/, "")}/redirect`;
  }

  return {
    apiUrl,
    frontendUrl,
    backendEnv,
    frontendEnv,
  };
}

function buildPrivateEnvs(source, part) {
  const apiUrl = source.PRIVATE_API_URL || "http://127.0.0.1:5188";
  const frontendUrl = source.PRIVATE_FRONTEND_URL || "http://127.0.0.1:3001";
  const cloudUrl = source.WEB_FRONTEND_URL || "http://localhost:3000";
  const apiToken = String(source.PRIVATE_API_TOKEN || "").trim();
  const requiresApiToken = part !== "run-once";

  if (requiresApiToken && (!apiToken || apiToken.length < 32)) {
    console.error("Missing or weak private API token in .env.local.");
    console.error("Set PRIVATE_API_TOKEN to at least 32 characters.");
    process.exit(1);
  }

  const backendEnv = { ...process.env };
  const frontendEnv = removeAppSecrets({ ...process.env });

  if (part !== "frontend") {
    requireValues(source, ["DATABASE_CONNECTION_STRING"], "private backend");

    assignIfPresent(
      backendEnv,
      "ConnectionStrings__Database",
      source.DATABASE_CONNECTION_STRING
    );
    assignIfPresent(backendEnv, "Private__ListenUrl", apiUrl);
    assignIfPresent(backendEnv, "Private__ApiToken", apiToken);
    assignIfPresent(
      backendEnv,
      "Private__PythonScript",
      source.PRIVATE_PYTHON_SCRIPT
    );
    assignIfPresent(backendEnv, "Private__Headless", source.PRIVATE_HEADLESS);
    assignIfPresent(
      backendEnv,
      "Private__SuspiciousChangeRatio",
      source.PRIVATE_SUSPICIOUS_CHANGE_RATIO
    );

    assignIfPresent(backendEnv, "Email__Enabled", source.EMAIL_ENABLED);
    assignIfPresent(backendEnv, "Email__SmtpHost", source.EMAIL_SMTP_HOST);
    assignIfPresent(backendEnv, "Email__SmtpPort", source.EMAIL_SMTP_PORT);
    assignIfPresent(backendEnv, "Email__UseSsl", source.EMAIL_USE_SSL);
    assignIfPresent(
      backendEnv,
      "Email__TimeoutSeconds",
      source.EMAIL_TIMEOUT_SECONDS
    );
    assignIfPresent(backendEnv, "Email__Username", source.EMAIL_USERNAME);
    assignIfPresent(backendEnv, "Email__Password", source.EMAIL_PASSWORD);
    assignIfPresent(backendEnv, "Email__From", source.EMAIL_FROM);
    assignIfPresent(backendEnv, "Email__To", source.EMAIL_TO);

    if (source.PRIVATE_PYTHON_EXECUTABLE) {
      const pythonExecutable = source.PRIVATE_PYTHON_EXECUTABLE;
      const looksLikePath =
        pythonExecutable.startsWith(".") ||
        pythonExecutable.includes("/") ||
        pythonExecutable.includes("\\");

      backendEnv.Private__PythonExecutable = looksLikePath
        ? path.resolve(repoRoot, pythonExecutable)
        : pythonExecutable;
    }

    backendEnv.ASPNETCORE_ENVIRONMENT =
      source.ASPNETCORE_ENVIRONMENT || "Development";
    backendEnv.ASPNETCORE_URLS = apiUrl;

    // The Private API uses these values when creating a Windows scheduled task.
    // The task launches this Node entry point again so every run reloads the
    // repository-root .env.local instead of depending on dotnet user-secrets.
    backendEnv.Private__RepoRoot = repoRoot;
    backendEnv.Private__NodeExecutable = process.execPath;
    backendEnv.Private__LauncherScript = path.join(
      repoRoot,
      "scripts",
      "dev-stack.mjs"
    );
  }

  if (part !== "backend" && part !== "run-once") {
    // Only pass the private proxy configuration to the Next.js server.
    // Database credentials and other backend-only values from .env.local are
    // intentionally not copied into the frontend process environment.
    frontendEnv.PRIVATE_API_URL = apiUrl;
    frontendEnv.PRIVATE_FRONTEND_URL = frontendUrl;
    frontendEnv.PRIVATE_API_TOKEN = apiToken;
    frontendEnv.NEXT_PUBLIC_CLOUD_URL = cloudUrl;
  }

  return {
    apiUrl,
    frontendUrl,
    backendEnv,
    frontendEnv,
  };
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

function runPrivateOnce(env) {
  startProcess(
    "private-run-once",
    "dotnet",
    [
      "run",
      "--no-launch-profile",
      "--project",
      "src/PriceWatch.Private",
      "--",
      "--run-once",
    ],
    env
  );
}

const [target, part = "all"] = process.argv.slice(2);

if (!(
  ["web", "private"].includes(target) &&
  ["all", "frontend", "backend", "migrate", "run-once"].includes(part) &&
  !(target === "private" && part === "migrate") &&
  !(target === "web" && part === "run-once")
)) {
  console.error(
    "Usage: node scripts/dev-stack.mjs <web|private> <all|frontend|backend>"
  );
  console.error("       node scripts/dev-stack.mjs web migrate");
  console.error("       node scripts/dev-stack.mjs private run-once");
  process.exit(1);
}

const sourceEnv = loadLocalEnv();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (target === "web") {
  const {
    apiUrl,
    frontendUrl,
    backendEnv,
    frontendEnv,
  } = buildWebEnvs(sourceEnv, part);

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
      backendEnv
    );
  } else {
    console.log("PriceWatch web local development");
    console.log(`  frontend: ${frontendUrl}`);
    console.log(`  api:      ${apiUrl}`);

    if (part !== "frontend") {
      startBackend("src/PriceWatch.WebApi", backendEnv, "web-api");
    }
    if (part !== "backend") {
      startFrontend("web", frontendEnv, "web");
    }
  }
} else {
  const {
    apiUrl,
    frontendUrl,
    backendEnv,
    frontendEnv,
  } = buildPrivateEnvs(sourceEnv, part);

  if (part === "run-once") {
    console.log("PriceWatch private scheduled run");
    runPrivateOnce(backendEnv);
  } else {
    console.log("PriceWatch private local development");
    console.log(`  frontend: ${frontendUrl}`);
    console.log(`  api:      ${apiUrl}`);

    if (part !== "frontend") {
      startBackend("src/PriceWatch.Private", backendEnv, "private-api");
    }
    if (part !== "backend") {
      startFrontend("pricewatch-private-web", frontendEnv, "private-web");
    }
  }
}
