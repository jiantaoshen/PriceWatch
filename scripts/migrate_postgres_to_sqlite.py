#!/usr/bin/env python3
"""One-time, read-only PostgreSQL -> SQLite *staging* database migration.

This is a data-preserving bridge, not an EF Core SQLite schema migration.
The running PriceWatch applications still use PostgreSQL until the provider,
SQLite-native EF migrations and application integration are completed.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, time, timezone
from contextlib import closing
from decimal import Decimal
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Iterable
import sqlite3
import sys
import tempfile
import uuid

# Parent rows precede their dependent children (real DB table names).
TABLES = (
    "tracked_items",
    "item_sources",
    "scrape_runs",
    "scrape_results",
    "price_history",
    "best_price_states",
    "best_price_state_sources",
    "price_alert_events",
)

PRIMARY_KEYS = {
    "tracked_items": ("id",),
    "item_sources": ("id",),
    "scrape_runs": ("id",),
    "scrape_results": ("id",),
    "price_history": ("id",),
    "best_price_states": ("id",),
    "best_price_state_sources": ("best_price_state_id", "source_id"),
    "price_alert_events": ("id",),
}

UNIQUE_KEYS = {
    "item_sources": (("item_id", "id"),),
    "scrape_results": (("run_id", "source_id"),),
    "price_history": (("scrape_result_id",),),
    "best_price_states": (("item_id", "id"),),
    "price_alert_events": (("best_price_state_id",),),
}

# child columns -> parent table and parent columns
FOREIGN_KEYS = {
    "item_sources": (("item_id", "tracked_items", "id"),),
    "scrape_results": (
        ("run_id", "scrape_runs", "id"),
        ("item_id", "tracked_items", "id"),
        (("item_id", "source_id"), "item_sources", ("item_id", "id")),
    ),
    "price_history": (
        ("item_id", "tracked_items", "id"),
        (("item_id", "source_id"), "item_sources", ("item_id", "id")),
        ("scrape_result_id", "scrape_results", "id"),
    ),
    "best_price_states": (("item_id", "tracked_items", "id"),),
    "best_price_state_sources": (
        (("item_id", "best_price_state_id"), "best_price_states", ("item_id", "id")),
        (("item_id", "source_id"), "item_sources", ("item_id", "id")),
    ),
    "price_alert_events": (
        ("item_id", "tracked_items", "id"),
        (("item_id", "best_price_state_id"), "best_price_states", ("item_id", "id")),
    ),
}

# Additional lookup indexes preserve key read paths without assuming a WAL mode.
INDEXES = {
    "tracked_items": (("item_type",), ("archived_at",)),
    "item_sources": (("item_id", "archived_at"),),
    "scrape_runs": (("started_at",),),
    "scrape_results": (("run_id",), ("item_id", "review_status")),
    "price_history": (("item_id", "recorded_at"), ("source_id", "recorded_at")),
    "best_price_states": (("item_id", "recorded_at"),),
    "best_price_state_sources": (("item_id", "source_id"),),
}


def ident(name: str) -> str:
    """Quote database identifiers, never treating source values as SQL."""
    return '"' + name.replace('"', '""') + '"'


def names_sql(items: tuple[str, ...]) -> str:
    return ", ".join(ident(item) for item in items)


def sqlite_type(pg_type: str) -> str:
    if pg_type in ("int2", "int4", "int8", "bool"):
        return "INTEGER"
    if pg_type in ("numeric", "decimal", "money"):
        # SQLite NUMERIC affinity can silently round PostgreSQL DECIMAL.
        # Store exact strings in this staging copy until the final EF model is chosen.
        return "TEXT"
    if pg_type in ("float4", "float8"):
        return "REAL"
    if pg_type == "bytea":
        return "BLOB"
    return "TEXT"


def normalize(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        # Preserve the instant; store unambiguous UTC timestamps.
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.isoformat(timespec="microseconds")
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (str, int, float, bytes)):
        return value
    raise TypeError(f"Unsupported database value type: {type(value).__name__}")


def row_digest(rows: Iterable[tuple[object, ...]]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        values = [normalize(value) for value in row]
        digest.update(json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def create_table(db: sqlite3.Connection, table: str, columns: list[tuple[str, str, str]]) -> None:
    col_names = {name for name, _, _ in columns}
    required = set(PRIMARY_KEYS[table])
    for key in UNIQUE_KEYS.get(table, ()):
        required.update(key)
    for child, _, _ in FOREIGN_KEYS.get(table, ()):
        required.update(child if isinstance(child, tuple) else (child,))
    absent = required - col_names
    if absent:
        raise ValueError(f"{table}: missing expected PostgreSQL columns: {sorted(absent)}")

    clauses = []
    for name, pg_type, nullable in columns:
        null_clause = " NOT NULL" if nullable == "NO" else ""
        clauses.append(f"{ident(name)} {sqlite_type(pg_type)}{null_clause}")
    clauses.append(f"PRIMARY KEY ({names_sql(PRIMARY_KEYS[table])})")
    for key in UNIQUE_KEYS.get(table, ()):
        clauses.append(f"UNIQUE ({names_sql(key)})")
    for child, parent, parent_col in FOREIGN_KEYS.get(table, ()):
        child_cols = child if isinstance(child, tuple) else (child,)
        parent_cols = parent_col if isinstance(parent_col, tuple) else (parent_col,)
        clauses.append(
            f"FOREIGN KEY ({names_sql(child_cols)}) "
            f"REFERENCES {ident(parent)} ({names_sql(parent_cols)})"
        )
    db.execute(f"CREATE TABLE {ident(table)} (\n  " + ",\n  ".join(clauses) + "\n)")


def create_indexes(db: sqlite3.Connection, table: str, col_names: set[str]) -> None:
    for columns in INDEXES.get(table, ()):
        if not all(column in col_names for column in columns):
            raise ValueError(f"{table}: missing columns for expected index {columns}")
        name = "idx_" + table + "_" + "_".join(columns)
        db.execute(f"CREATE INDEX {ident(name)} ON {ident(table)} ({names_sql(columns)})")


def inspect_columns(pg: object, schema: str, table: str) -> list[tuple[str, str, str]]:
    rows = pg.execute(
        """SELECT column_name, udt_name, is_nullable
           FROM information_schema.columns
           WHERE table_schema = %s AND table_name = %s
           ORDER BY ordinal_position""",
        (schema, table),
    ).fetchall()
    if not rows:
        raise ValueError(f"PostgreSQL table not found: {schema}.{table}")
    return [tuple(row) for row in rows]


def import_snapshot(pg: object, db: sqlite3.Connection, schema: str) -> list[tuple[str, int, str]]:
    db.execute("PRAGMA foreign_keys=ON")
    # Default DELETE journal mode, not WAL, as requested for initial use.
    db.execute("PRAGMA busy_timeout=5000")
    metadata = {}
    for table in TABLES:
        columns = inspect_columns(pg, schema, table)
        metadata[table] = columns
        create_table(db, table, columns)
    for table, columns in metadata.items():
        create_indexes(db, table, {name for name, _, _ in columns})

    db.execute("CREATE TABLE migration_audit (table_name TEXT PRIMARY KEY, row_count INTEGER NOT NULL, sha256 TEXT NOT NULL)")
    results = []
    for table in TABLES:
        print(f"Importing PostgreSQL table: {table}", flush=True)
        cols = [col[0] for col in metadata[table]]
        select = (
            f"SELECT {names_sql(tuple(cols))} FROM {ident(schema)}.{ident(table)} "
            f"ORDER BY {names_sql(PRIMARY_KEYS[table])}"
        )
        with pg.cursor() as cursor:
            cursor.execute(select)
            # Small personal project: batch reads, hashes stream independently.
            count = 0
            source_digest = hashlib.sha256()
            columns_sql = names_sql(tuple(cols))
            placeholders = ",".join("?" for _ in cols)
            insert = f"INSERT INTO {ident(table)} ({columns_sql}) VALUES ({placeholders})"
            while True:
                batch = cursor.fetchmany(500)
                if not batch:
                    break
                data = [tuple(normalize(value) for value in row) for row in batch]
                for row in data:
                    source_digest.update(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
                    source_digest.update(b"\n")
                db.executemany(insert, data)
                count += len(data)
        local_count = db.execute(f"SELECT COUNT(*) FROM {ident(table)}").fetchone()[0]
        local_rows = db.execute(
            f"SELECT {names_sql(tuple(cols))} FROM {ident(table)} "
            f"ORDER BY {names_sql(PRIMARY_KEYS[table])}"
        )
        checksum = source_digest.hexdigest()
        if local_count != count or row_digest(local_rows) != checksum:
            raise ValueError(f"Data integrity mismatch for table {table}; output not published")
        db.execute("INSERT INTO migration_audit VALUES (?, ?, ?)", (table, count, checksum))
        results.append((table, count, checksum))
    fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
    if fk_errors:
        raise ValueError(f"SQLite foreign key validation failed ({len(fk_errors)} errors)")
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("SQLite integrity_check failed")
    return results


def verify_file(path: Path) -> None:
    with closing(sqlite3.connect(f"file:{path.resolve().as_posix()}?mode=ro", uri=True)) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity_check failed")
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise ValueError(f"SQLite foreign key_check failed: {len(violations)} violations")
        for table in TABLES:
            expected = db.execute(
                "SELECT row_count, sha256 FROM migration_audit WHERE table_name=?", (table,)
            ).fetchone()
            if expected is None:
                raise ValueError(f"Missing audit metadata for {table}")
            actual = db.execute(f"SELECT COUNT(*) FROM {ident(table)}").fetchone()[0]
            if actual != expected[0]:
                raise ValueError(f"Count mismatch for {table}: {actual} vs {expected[0]}")
            columns = [column[1] for column in db.execute(f"PRAGMA table_info({ident(table)})")]
            rows = db.execute(
                f"SELECT {names_sql(tuple(columns))} FROM {ident(table)} "
                f"ORDER BY {names_sql(PRIMARY_KEYS[table])}"
            )
            if row_digest(rows) != expected[1]:
                raise ValueError(f"Content hash mismatch for {table}")
            print(f"{table}: {actual} rows + hash OK")
    print("SQLite integrity, foreign keys, row counts and content hashes: OK")



def read_env_value(path: Path, key: str) -> str | None:
    """Read one literal .env.local value; never print or interpolate secrets."""
    if not path.is_file():
        return None
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not match or match.group(1) != key:
            continue
        value = match.group(2).strip()
        if len(value) >= 2 and value[0] in ('"', "'") and value[-1] == value[0]:
            value = value[1:-1]
        return value or None
    return None


def parse_npgsql_connection_string(value: str) -> dict[str, object]:
    """Convert a .NET/Npgsql semicolon connection string to psycopg kwargs.

    Supports Npgsql's quoted values (including semicolons in a password).
    Does not echo connection details in errors. Unknown Npgsql-only options
    such as pooling are intentionally ignored for a one-shot export.
    """
    fields: list[str] = []
    current: list[str] = []
    quote: str | None = None
    index = 0
    while index < len(value):
        char = value[index]
        if quote is not None:
            if char == quote:
                # Connection strings escape a quote inside quotes by doubling it.
                if index + 1 < len(value) and value[index + 1] == quote:
                    current.append(quote)
                    index += 2
                    continue
                quote = None
            else:
                current.append(char)
        elif char in ("'", '"'):
            quote = char
        elif char == ';':
            fields.append(''.join(current))
            current = []
        else:
            current.append(char)
        index += 1
    if quote is not None:
        raise ValueError("Unterminated quoted value in DATABASE_CONNECTION_STRING")
    fields.append(''.join(current))

    settings: dict[str, str] = {}
    for field in fields:
        if not field.strip():
            continue
        if '=' not in field:
            raise ValueError("Malformed DATABASE_CONNECTION_STRING: expected Key=Value entries")
        key, text = field.split('=', 1)
        key = re.sub(r"[\s_]+", "", key.strip().lower())
        if not key:
            raise ValueError("Malformed DATABASE_CONNECTION_STRING: missing setting name")
        settings[key] = text.strip()

    def get(*names: str) -> str | None:
        return next((settings[key] for key in names if key in settings), None)

    params: dict[str, object] = {}
    for key, aliases in {
        'host': ('host', 'server'),
        'dbname': ('database', 'initialcatalog'),
        'user': ('username', 'userid', 'user'),
        'password': ('password', 'pwd'),
        'port': ('port',),
    }.items():
        item = get(*aliases)
        if item is not None and item != '':
            params[key] = item
    missing = [key for key in ('host', 'dbname', 'user', 'password') if key not in params]
    if missing:
        raise ValueError("Npgsql connection string is missing: " + ', '.join(missing))
    if 'port' in params:
        try:
            port = int(str(params['port']))
            if not (1 <= port <= 65535):
                raise ValueError
            params['port'] = port
        except ValueError:
            raise ValueError("Npgsql connection string has invalid Port") from None
    ssl_mode = get('sslmode')
    if ssl_mode:
        mapping = {
            'require': 'require', 'prefer': 'prefer', 'disable': 'disable',
            'allow': 'allow', 'verifyca': 'verify-ca', 'verifyfull': 'verify-full',
        }
        key = re.sub(r"[\s_-]+", "", ssl_mode.lower())
        if key not in mapping:
            raise ValueError("Unsupported Npgsql SSL Mode; expected Require/Prefer/VerifyCA/VerifyFull")
        params['sslmode'] = mapping[key]
    else:
        # Neon uses TLS. Never implicitly disable SSL for this migration.
        params['sslmode'] = 'require'
    return params


def connection_arguments(raw: str) -> dict[str, object]:
    """psycopg.connect arguments for PostgreSQL URI, libpq DSN, or Npgsql."""
    raw = raw.strip()
    if raw.startswith(('postgresql://', 'postgres://')):
        return {'conninfo': raw}
    if ';' in raw and re.search(
        r"(?:^|;)\s*(?:host|server|database|username|user\s*id|ssl\s*mode)\s*=",
        raw, re.I,
    ):
        return parse_npgsql_connection_string(raw)
    return {'conninfo': raw}  # Standard libpq keyword DSN.


def load_connection_string(env_name: str, env_file: Path) -> str | None:
    # Explicit environment override takes precedence over .env.local.
    return (os.environ.get(env_name)
            or read_env_value(env_file, env_name)
            or read_env_value(env_file, 'DATABASE_CONNECTION_STRING')
            or read_env_value(env_file, 'DATABASE_URL'))

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/pricewatch-staging.sqlite3"))
    parser.add_argument("--schema", default="public", help="PostgreSQL schema to export (default: public)")
    parser.add_argument("--dsn-env", default="PRICEWATCH_LEGACY_PG_DSN", help="Environment variable containing PostgreSQL DSN")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"), help="Fallback .env file for DATABASE_CONNECTION_STRING (default: .env.local)")
    parser.add_argument("--verify", type=Path, help="Verify a previously exported SQLite file (offline)")
    args = parser.parse_args()
    if args.verify is not None:
        verify_file(args.verify)
        return 0
    dsn = load_connection_string(args.dsn_env, args.env_file)
    if not dsn:
        print(f"Missing PostgreSQL DSN: set {args.dsn_env} or use DATABASE_CONNECTION_STRING in {args.env_file}", file=sys.stderr)
        return 2
    if args.out.exists():
        print(f"Refusing to overwrite existing SQLite file: {args.out}", file=sys.stderr)
        return 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    stage = "prepare connection"
    try:
        import psycopg  # Optional one-time migration dependency: pip install 'psycopg[binary]'
        with tempfile.NamedTemporaryFile(prefix=".pricewatch-import-", suffix=".sqlite3", dir=args.out.parent, delete=False) as tmp:
            tmp_path = Path(tmp.name)
        # No application writes to PostgreSQL. A single read-only snapshot
        # protects against partial/live changes while the export is running.
        connect_args = connection_arguments(dsn)
        stage = "connect to PostgreSQL"
        with psycopg.connect(autocommit=True, **connect_args) as pg:
            stage = "begin read-only transaction"
            pg.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            try:
                with closing(sqlite3.connect(tmp_path)) as db:
                    with db:  # Commit on success, roll back on error; closing() releases Windows file handles.
                        stage = "read PostgreSQL tables and write SQLite staging copy"
                        results = import_snapshot(pg, db, args.schema)
            finally:
                pg.execute("ROLLBACK")
        stage = "verify SQLite staging copy"
        verify_file(tmp_path)
        if args.out.exists():
            raise FileExistsError(f"Refusing to overwrite SQLite file: {args.out}")
        os.replace(tmp_path, args.out)
        tmp_path = None
        print(f"Created SQLite staging database: {args.out}")
        print(f"Imported {sum(count for _, count, _ in results)} rows from {len(results)} tables")
        print("Source PostgreSQL was accessed read-only and left unchanged.")
        print("NOTE: This staging DB is NOT yet wired into the .NET / Next.js runtime.")
        return 0
    except Exception as exc:
        # Never print connection parameters or provider error text: may contain a password.
        sqlstate = getattr(exc, "sqlstate", None)
        sqlstate_label = f", SQLSTATE={sqlstate}" if sqlstate else ""
        print(f"Migration failed at {stage} ({type(exc).__name__}{sqlstate_label}). No completed DB published.", file=sys.stderr)
        if isinstance(exc, ValueError):
            print("Check the connection format and the expected eight source tables.", file=sys.stderr)
        return 1
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except PermissionError:
                # A cleanup failure must not mask the original migration error.
                print(f"Warning: could not delete temporary file {tmp_path.name}; close SQLite viewers before removing it.", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
