# SQLite migration: Windows WinError 32 fix

This drop-in patch updates `scripts/migrate_postgres_to_sqlite.py` only. The `tests/sqlite_migration/test_migrate.py` file includes an additional regression test.

## Changes

- Explicitly closes the SQLite writer after commit/rollback.
- Explicitly closes the read-only verifier after checking counts, digests, foreign keys, and integrity.
- Handles cleanup `PermissionError` without hiding the original error (leaves temporary file for manual investigation).
- Does not modify the read-only Neon source or connect to production services in tests.

## Windows PowerShell

1. Extract this archive into the root of PriceWatch, replacing the script.
2. Optional offline tests: `python -m unittest discover -s tests/sqlite_migration -v`.
3. Run: `python scripts/migrate_postgres_to_sqlite.py --out data/pricewatch-staging.sqlite3`.
4. Verify: `python scripts/migrate_postgres_to_sqlite.py --verify data/pricewatch-staging.sqlite3`.

Existing `.pricewatch-import-*.sqlite3` files are retained by the old script after WinError32; don't mistake them for completed staging databases. Once a new staging file is successfully verified, old temporary files can be removed while the script and any SQLite viewers are closed.
