# PriceWatch: PostgreSQL / Neon → SQLite data migration (Phase 1)

**Status:** An import tool and staging schema have been implemented. **Actual Neon data has not been imported**, because the uploaded project archive contains no access credentials or database contents. The running .NET/Next.js code is still PostgreSQL-based.

This phase creates a **new SQLite staging copy**. It does not switch web/API/scraper database providers, migrate EF Core migrations, remove authentication, change Windows Task Scheduler, or deactivate Neon. Those are later, separately tested phases.

## Scope

- Preserve all eight business tables: `tracked_items`, `item_sources`, `scrape_runs`, `scrape_results`, `price_history`, `best_price_states`, `best_price_state_sources`, `price_alert_events`.
- Preserve UUIDs, long IDs, current and historical prices, scrape/review states, timestamps, archived sources and alert delivery history.
- The source is read only, with a single PostgreSQL `REPEATABLE READ` snapshot. No source schema is changed, no source rows are deleted, and the source isn't locked for writes by the script.
- Destination is **new** `data/pricewatch-staging.sqlite3`, ignored by Git. The script refuses to overwrite an existing output and only publishes the file after successful validation.
- Numeric/decimal values are copied to SQLite **TEXT** columns to preserve their exact representation. PostgreSQL computed columns are copied as stored values into staging. This staging schema is **not the final EF Core SQLite application schema**.
- Uses SQLite's default rollback journal; **does not enable WAL**.

## Before the export

1. Make an independent Neon backup or snapshot and record the source's approximate item and price-history counts. Treat the backup as sensitive data.
2. Keep the existing apps connected to Neon; don't change `.env.local` or scheduled-task settings yet.
3. You can reuse the existing `DATABASE_CONNECTION_STRING` in your local `.env.local` (Npgsql-style `Host=...;Database=...;Username=...;Password=...;SSL Mode=Require`). The importer now converts it automatically for psycopg. It also accepts a PostgreSQL URI (`postgresql://...`) or an explicitly supplied `PRICEWATCH_LEGACY_PG_DSN`. Ideally use a source account with read-only permissions. Never share your password or commit `.env.local` to Git.
4. Install Python 3.10+ and the optional **migration-only** dependency:

   ```powershell
   python -m pip install "psycopg[binary]"
   ```

The migration tool accepts the `.NET` `DATABASE_CONNECTION_STRING` in `.env.local`, translates Npgsql key/value syntax into psycopg keyword arguments, and leaves the original file unchanged. **Don't change the existing runtime string yet.**

## Run the read-only export on Windows

Open PowerShell in the project root (where `.env.local` is located):

```powershell
python -m pip install "psycopg[binary]"
python scripts/migrate_postgres_to_sqlite.py --out data/pricewatch-staging.sqlite3
```

No manual secret entry or PowerShell environment variable is required. The script reads `DATABASE_CONNECTION_STRING` from `.env.local` if `PRICEWATCH_LEGACY_PG_DSN` is not already set.

To specify another local env file, use `--env-file path/to/.env.local`. If you already have a correct PostgreSQL URI in the environment variable, it takes precedence over the file.

The tool prints table names and row counts, **never connection details or actual price records**. It exits without publishing the output on schema/data/checksum/foreign-key errors. If an export was interrupted, clean up any incomplete file manually after confirming it isn't your verified copy; **do not use `--force`** or overwrite an existing SQLite database.

## Verify the SQLite copy

```powershell
python scripts/migrate_postgres_to_sqlite.py --verify data/pricewatch-staging.sqlite3
```

The export transaction verifies:

- every row for each table is copied in primary-key order,
- source and destination row counts and normalized SHA-256 content hashes match,
- SQLite `PRAGMA foreign_key_check` and `PRAGMA integrity_check` pass,
- every required source table/column exists,
- the file was not replaced during import.

The offline `--verify` mode independently rechecks **counts, recorded SHA-256 content hashes, foreign keys and SQLite integrity** using the stored `migration_audit` table; it does not reconnect to Neon. For higher assurance after the source continues to change, compare with a fresh source snapshot rather than assuming counts remain frozen.

SQLite can be inspected with a read-only SQLite viewer. Do not modify the staging file or manually drop constraints. For example, use Python:

```powershell
python -c "import sqlite3; db=sqlite3.connect('file:data/pricewatch-staging.sqlite3?mode=ro', uri=True); print(db.execute('SELECT COUNT(*) FROM tracked_items').fetchone()[0]); print(db.execute('SELECT COUNT(*) FROM price_history').fetchone()[0])"
```

## Data mapping and compatibility caveats

| PostgreSQL | SQLite staging | Notes |
|---|---|---|
| `uuid` | TEXT | Keeps identity values unchanged as strings |
| `bigint`/`integer` | INTEGER | Preserves source and result IDs |
| `boolean` | INTEGER | `1` / `0` |
| `numeric(p,s)` | TEXT | Avoids binary float precision loss |
| `timestamptz` | TEXT | ISO-8601 with UTC timezone, retains the instant |
| Generated/computed price column | Ordinary TEXT column | Copy for audit; later must be recomputed or mapped in runtime schema |

**Do not point the existing EF Core model at this staging database.** The current migrations are Npgsql-specific and use PostgreSQL computed columns, date/decimal types, and a PostgreSQL advisory scrape lock. Those elements need SQLite-specific design and migrations in Phase 2. If you run `npm run db:update` now, it still targets PostgreSQL.

## Next phase (not implemented by this export)

1. Produce SQLite-provider EF Core migrations, explicit date/decimal mapping (especially exact unit-price computation) and queries that SQLite can execute.
2. Import validated data from staging into that runtime schema, with new counts/hashes/relationship checks and price-history spot checks.
3. Replace PostgreSQL advisory locking with a local mutual-exclusion mechanism for scraper runs; retain the Python worker untouched.
4. Verify Windows Task Scheduler runs the scraper independently with Next.js stopped and correctly updates the SQLite file.
5. Merge local operator UI into the main Next.js site and remove redundant APIs/cloud integration.
6. Verify both interactive and scheduled workflows, establish restorable SQLite backups, **then** retire Neon and revoke its credentials.

## Rollback

While in Phase 1, simply stop using the staging SQLite file; the existing Neon data and running app remain unchanged. Never delete source data or switch the scheduled scraper before verifying the later cutover. Use a separately tested backup/restore procedure before final cloud retirement.
