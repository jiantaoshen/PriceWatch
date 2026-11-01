# PriceWatch Local · Phase 2: SQLite scraper data layer

## Scope

This patch changes **only the Private .NET scraper host's persistence** to use the existing SQLite snapshot. The Python/Playwright worker and the Windows Task Scheduler registration/trigger pattern are unchanged. PostgreSQL remains in the public WebApi until a later phase. No WAL mode or new scheduler is introduced.

**Based on the earlier uploaded PriceWatch ZIP, not your later local ESLint/package edits.** Overlay only the included source files, and inspect your local diff before adopting changes.

### Safety and data boundaries

1. Keep Neon and `data/pricewatch-staging.sqlite3` unchanged as your fallback. Do not point the running scraper at the staging snapshot.
2. Stop or disable the existing Windows scheduled task for the cutover until you finish the SQLite check. Windows Task Scheduler will still be used afterward.
3. Copy the verified staging file to `data/pricewatch.sqlite3`. Do not use the old migration `--verify` after the running database receives new rows; its one-time content-hash audit is intended for the immutable snapshot.
4. In the **project root** `.env.local`, add `PRICEWATCH_SQLITE_PATH=data/pricewatch.sqlite3`. Leave your Neon connection variable untouched until all other apps have migrated.
5. Use an absolute canonical path internally; the launcher resolves the relative path against project root. No `EnsureCreated`, `Migrate` or WAL setup is invoked on the data file.
6. Keep the database ignored by Git, and back up it when no scraper is running. This patch assumes the database schema produced by the original Python migration script, which stores UUIDs, timestamps and decimal values as TEXT, including ordinary columns previously computed by PostgreSQL.

### Commands (PowerShell, from project root)

```powershell
# Pause the existing Task Scheduler task before cutover.
# Also stop the private API if it is running.

New-Item -ItemType Directory -Force .\data | Out-Null
if (Test-Path .\data\pricewatch.sqlite3) {
    throw "Runtime SQLite database already exists; refusing to overwrite it."
}
Copy-Item .\data\pricewatch-staging.sqlite3 .\data\pricewatch.sqlite3 -ErrorAction Stop
notepad .env.local
# Add: PRICEWATCH_SQLITE_PATH=data/pricewatch.sqlite3

# Check runtime mapping without scraping or writing:
node scripts/dev-stack.mjs private check-sqlite

# Run C# tests (no network scraping):
dotnet test tests/PriceWatch.Tests/PriceWatch.Tests.csproj

# Only after the read-only check and tests succeed, manually run once:
node scripts/dev-stack.mjs private run-once

# Then inspect the local result, re-enable Windows Task Scheduler task
# and let it invoke the SAME `private run-once` entrypoint.
```

### What changed

- `PriceWatch.Private` uses `Microsoft.EntityFrameworkCore.Sqlite` and opens the existing file in `ReadWrite` (not create) mode.
- `PriceWatchDbContext` converts GUIDs to lowercase TEXT, UTC timestamps to ISO 8601 and decimal values to invariant TEXT. For SQLite only, it explicitly recalculates stored unit-price fields in .NET at save time; the PostgreSQL database had generated columns but the imported snapshot deliberately does not. No floating-point database division is used to calculate stored unit prices.
- `SqliteScrapeLock` holds an exclusive OS file handle next to the DB for one scheduled or on-demand run. No Neon advisory lock is needed. Windows Scheduler's existing `MultipleInstances IgnoreNew` setting remains.
- `private check-sqlite` performs a read-only provider/model/SQLite health check before any scrape.
- The email-alert numeric comparison is performed in .NET to avoid lexicographic string comparison on SQLite's exact TEXT decimal fields.

### Limits and required validation

- **Not compiled or integration-tested here**: this environment does not have the .NET SDK or your live SQLite file. Verify on Windows before enabling the scheduled task.
- The original SQL staging schema is a byte-preserving import, *not* an EF SQLite schema migration. This patch targets it directly; verify real runs, identity/ID mappings, computed price fields, and foreign keys with your data.
- Existing `web` and `PriceWatch.WebApi` still use Neon. Do not turn Neon off yet.
- A database copied earlier is a point-in-time snapshot; if Neon changed after export, sync the newest records before cutover.
- No WAL mode is enabled. SQLite uses its existing journal mode; writes serialize. DB busy timeout is set to 5 seconds.
- Do not run old and new workers in parallel against different backends during the cutover; they will diverge.
- `PriceWatch.Private` HTTP API still requires the existing local token for interactive mode. `--check-sqlite` and `--run-once` do not expose an HTTP listener.
