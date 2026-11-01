# PriceWatch Local — migration in progress

PriceWatch is a **personal, Windows-local price tracker**. The agreed target architecture is **one Next.js website**, **one SQLite database**, and the **existing independently scheduled scraper**. The user opens the website only when needed; **Windows Task Scheduler** runs the scraper even if the website is closed.

> **Status (2026-11-01): Phase 1 — SQLite data migration.** This repository is a snapshot from before the migration. The current applications still use **Neon/PostgreSQL**, separate `web` and `private-web` sites, and .NET API services. **Do not remove Neon or point the existing runtime at the exported SQLite staging file yet.** The owner's local working copy may also contain ESLint upgrades not present in this ZIP.
>
> Decisions and staged acceptance gates: [DESIGN.md](DESIGN.md). Step-by-step database migration: [docs/SQLITE_MIGRATION.md](docs/SQLITE_MIGRATION.md).

## Target architecture

```text
Browser → Next.js local website (127.0.0.1:3000)
                         |
                   SQLite database
                         ^
                         |
             lightweight .NET scraper runner
                         |
               existing Python/Playwright
                         ^
                         |
                 Windows Task Scheduler
```

- SQLite is the **eventual single source of truth**. No Neon/cloud sync is planned.
- The existing Python scraping/extraction code stays intact; only its data integration is migrated later.
- The crawler is an independent process, scheduled by **Windows Task Scheduler** and not dependent on the website running.
- No separate domain allowlist will be added. Keep the scraper's existing network guard and input validation.
- SQLite **WAL is deferred**; v1 starts with default journaling and a bounded busy timeout.
- Merge the former public and private web functions into one local interface after the data migration is verified.
- Remove cloud authentication, cloud deployments and redundant APIs **after** a successful cutover, not before.

## Phase 1: migrate data from Neon/PostgreSQL to SQLite

The migration utility in this repository creates a **new, verified, staging SQLite file** from a read-only, repeatable-read PostgreSQL snapshot. It preserves the eight current business tables, keys, history, dates and exact text representations of decimals. It **does not** alter the original PostgreSQL database or enable SQLite in the .NET services yet.

Requirements for this one-time export: Python 3.10+ and `psycopg` (separate from the scraper dependencies).

```powershell
python -m pip install "psycopg[binary]"
# Enter the PostgreSQL URI from Neon privately; don't commit or paste it in logs.
$secureDsn = Read-Host 'Legacy PostgreSQL URI (hidden)' -AsSecureString
$env:PRICEWATCH_LEGACY_PG_DSN = [System.Net.NetworkCredential]::new('', $secureDsn).Password

python scripts/migrate_postgres_to_sqlite.py --out data/pricewatch-staging.sqlite3
python scripts/migrate_postgres_to_sqlite.py --verify data/pricewatch-staging.sqlite3

Remove-Item Env:PRICEWATCH_LEGACY_PG_DSN
```

**Important:** The connection must be a PostgreSQL URI or a DSN understood by `psycopg`; the existing `.NET/Npgsql` `Host=...;Port=...` connection string is **not interchangeable**. If possible, use a database role limited to `SELECT` on the business tables. The script additionally uses a **read-only database transaction**. If the output file exists, the utility refuses to overwrite it. Save the data and its backups outside Git.

Full prerequisite, data validation, rollback, privacy and cutover details are in [docs/SQLITE_MIGRATION.md](docs/SQLITE_MIGRATION.md). **The uploaded archive does not contain the owner's Neon data**, so no real records have been copied in this snapshot.

## Repository layout (currently present)

```text
src/PriceWatch.Core/       Shared business rules (retain)
src/PriceWatch.Data/       EF Core model + PostgreSQL migrations (SQLite provider later)
src/PriceWatch.WebApi/     Existing public API (retire later)
src/PriceWatch.Private/    Scraper orchestration / local API (slim later)
web/                       Existing main Next.js site (target merger destination)
private-web/               Existing operator site (merge later)
packages/                  Shared frontend packages
scraper/                   Existing Python / Playwright worker (retain)
scripts/migrate_postgres_to_sqlite.py  Read-only Neon -> SQLite data staging
```

## Current legacy stack: development commands

Until application cutover, the snapshot still requires .NET 10, Node.js/npm, Python/Playwright, and a PostgreSQL database. You can keep using the existing development launchers with your **current** PostgreSQL configuration:

```powershell
npm ci
Copy-Item .env.example .env.local
# Configure the existing DATABASE_CONNECTION_STRING in .env.local.
npm run dev:web:all        # http://localhost:3000 + public .NET API
npm run dev:private:all    # http://localhost:3001 + local .NET API
```

The repository launcher maps `.env.local` to the existing applications; direct `dotnet run` does not automatically load those values.

Existing individual commands:

```powershell
npm run dev:web
npm run dev:web:api
npm run dev:private
npm run dev:private:api
npm run private:run-once
npm run db:update           # PostgreSQL migrations ONLY; not for SQLite staging
```

> The legacy web and private app builds may fail until existing CSS imports from `shadcn/tailwind.css` are resolved. This is separate from SQLite migration. Do not assume the target one-site architecture is already implemented.

### Scraper dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scraper\requirements.txt
.\.venv\Scripts\python.exe -m playwright install firefox
```

Do not change the Windows Task Scheduler job as part of the **data-export phase**. Switch its DB connection only after the .NET SQLite runner and end-to-end verification are ready.

## Validation

```powershell
python -m unittest discover -s tests/sqlite_migration -v
python scripts/migrate_postgres_to_sqlite.py --verify data/pricewatch-staging.sqlite3
npm run lint
npm run build:web
npm run build:private
dotnet test PriceWatch.slnx
```

The SQLite verification command requires a previously exported staging file. Existing frontend/build tests can fail for unrelated preexisting issues; **do not interpret such failures as evidence that the migration succeeded or failed**. .NET SQLite-specific integration tests are part of Phase 2.

## Safety and operational limits

- Bind the final single web service to **127.0.0.1**, not a public network interface. Keep same-origin checks on any mutating local endpoint.
- Keep the Playwright network guard (localhost/private-address blocking) even without a user-maintained domain allowlist.
- Use a single consistent local SQLite path for the UI and worker after cutover; don't copy live databases casually.
- Use short transactions, configure SQLite busy retries, and introduce WAL only if warranted by observed usage.
- Back up SQLite consistently and confirm restore capability before deleting Neon. Never commit connection strings, `.env.local`, `.db` files or data exports.
- The planned reduction of cloud services and authentication only takes effect **after** all existing product management, price history, review and scheduled-scrape workflows are validated.
