"""Offline synthetic integration checks. Never touches a real Neon database."""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import sys
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'migrate_postgres_to_sqlite.py'
spec = importlib.util.spec_from_file_location('pw_migrate', SCRIPT)
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)


def col(name, pgtype='text', null='NO'):
    return (name, pgtype, null)


COLUMNS = {
    'tracked_items': [col('id','uuid'), col('item_type'), col('name'), col('archived_at','timestamptz','YES')],
    'item_sources': [col('id','int8'), col('item_id','uuid'), col('store'), col('archived_at','timestamptz','YES')],
    'scrape_runs': [col('id','uuid'), col('started_at','timestamptz'), col('status')],
    'scrape_results': [col('id','int8'), col('run_id','uuid'), col('item_id','uuid'), col('source_id','int8'), col('review_status')],
    'price_history': [col('id','int8'), col('item_id','uuid'), col('source_id','int8'), col('scrape_result_id','int8','YES'), col('recorded_at','timestamptz'), col('price','numeric'), col('quantity','numeric')],
    'best_price_states': [col('id','int8'), col('item_id','uuid'), col('recorded_at','timestamptz')],
    'best_price_state_sources': [col('best_price_state_id','int8'), col('source_id','int8'), col('item_id','uuid')],
    'price_alert_events': [col('id','int8'), col('item_id','uuid'), col('best_price_state_id','int8')],
}

ITEM = UUID('12345678-1234-1234-1234-123456789abc')
RUN = UUID('99999999-aaaa-bbbb-cccc-123456789abc')
AT = datetime(2026, 11, 1, 12, 30, tzinfo=timezone(timedelta(hours=1)))
ROWS = {
    'tracked_items': [(ITEM,'Product','Test item',None)],
    'item_sources': [(42, ITEM, 'Test shop', None)],
    'scrape_runs': [(RUN, AT, 'Success')],
    'scrape_results': [(99, RUN, ITEM, 42, 'NotRequired')],
    'price_history': [(101, ITEM, 42, 99, AT, Decimal('129.1000'), Decimal('1.2500'))],
    'best_price_states': [(15, ITEM, AT)],
    'best_price_state_sources': [(15, 42, ITEM)],
    'price_alert_events': [(1000, ITEM, 15)],
}


class Cursor:
    def __init__(self, parent):
        self.parent = parent
        self.data = []
        self.pos = 0

    def __enter__(self): return self
    def __exit__(self, *_): pass

    def execute(self, query):
        self.data = self.parent.rows[next(t for t in COLUMNS if f'"{t}"' in query)]
        self.pos = 0

    def fetchmany(self, size):
        val = self.data[self.pos:self.pos + size]
        self.pos += size
        return val


class PgFake:
    def __init__(self, rows=ROWS): self.rows = rows

    def execute(self, query, params):
        assert params[0] == 'public'
        table = params[1]
        return self

    def fetchall(self):
        # query params from the previous execute call
        raise AssertionError('override in subclass')

    def cursor(self): return Cursor(self)


class PgFakeWithColumns(PgFake):
    def execute(self, query, params):
        self.current_table = params[1]
        return self

    def fetchall(self): return COLUMNS[self.current_table]


class TestMigration(unittest.TestCase):
    def test_lossless_snapshot_and_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'staging.sqlite3'
            with sqlite3.connect(target) as db:
                result = migrate.import_snapshot(PgFakeWithColumns(), db, 'public')
                db.commit()
                self.assertEqual(len(result), 8)
                self.assertEqual(db.execute('SELECT price FROM price_history').fetchone()[0], '129.1000')
                self.assertEqual(db.execute('SELECT quantity FROM price_history').fetchone()[0], '1.2500')
                self.assertEqual(db.execute('SELECT recorded_at FROM price_history').fetchone()[0], '2026-11-01T11:30:00.000000+00:00')
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
            migrate.verify_file(target)

    def test_offline_verify_detects_changed_price(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'staging.sqlite3'
            with sqlite3.connect(target) as db:
                migrate.import_snapshot(PgFakeWithColumns(), db, 'public')
                db.commit()
                db.execute("UPDATE price_history SET price='999.9999' WHERE id=101")
                db.commit()
            with self.assertRaisesRegex(ValueError, 'Content hash mismatch'):
                migrate.verify_file(target)

    def test_fk_failure_fails_closed(self):
        invalid_rows = {name: list(rows) for name, rows in ROWS.items()}
        invalid_rows['price_alert_events'] = [(1000, ITEM, 9999)]
        with sqlite3.connect(':memory:') as db:
            with self.assertRaises(sqlite3.IntegrityError):
                migrate.import_snapshot(PgFakeWithColumns(invalid_rows), db, 'public')

    def test_npgsql_connection_string_supported(self):
        args = migrate.connection_arguments(
            'Host=example.neon.tech;Port=5432;Database=pricewatch;Username=local;'
            'Password=sample-secret;SSL Mode=Require;Pooling=true'
        )
        self.assertEqual(args['host'], 'example.neon.tech')
        self.assertEqual(args['dbname'], 'pricewatch')
        self.assertEqual(args['user'], 'local')
        self.assertEqual(args['password'], 'sample-secret')
        self.assertEqual(args['port'], 5432)
        self.assertEqual(args['sslmode'], 'require')

    def test_npgsql_quoted_password_with_semicolon(self):
        args = migrate.connection_arguments(
            'Host=example.neon.tech;Database=p;Username=u;'
            'Password="some;secret=with an equals sign";SSL Mode=VerifyFull'
        )
        self.assertEqual(args['password'], 'some;secret=with an equals sign')
        self.assertEqual(args['sslmode'], 'verify-full')

    def test_uri_format_is_unchanged(self):
        uri = 'postgresql://local:sample-secret@example.neon.tech/pricewatch?sslmode=require'
        self.assertEqual(migrate.connection_arguments(uri), {'conninfo': uri})

    def test_env_file_is_used_without_exposing_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / '.env.local'
            env.write_text('OTHER_VAR=x\nDATABASE_CONNECTION_STRING="Host=example.neon.tech;Database=p;Username=u;Password=secret;SSL Mode=Require"\n')
            with patch.dict('os.environ', {'PRICEWATCH_LEGACY_PG_DSN': ''}):
                raw = migrate.load_connection_string('PRICEWATCH_LEGACY_PG_DSN', env)
            self.assertEqual(migrate.connection_arguments(raw)['dbname'], 'p')

    def test_explicit_environment_override(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / '.env.local'
            env.write_text('DATABASE_CONNECTION_STRING=Host=example;Database=d;Username=u;Password=p\n')
            uri = 'postgresql://u:p@example/d'
            with patch.dict('os.environ', {'PRICEWATCH_LEGACY_PG_DSN': uri}):
                self.assertEqual(migrate.load_connection_string('PRICEWATCH_LEGACY_PG_DSN', env), uri)

    def test_connections_closed_before_publishing_sqlite(self):
        # Regression test for Windows WinError 32 during os.replace/unlink.
        class TrackingConnection(sqlite3.Connection):
            is_closed = False

            def close(self):
                self.is_closed = True
                return super().close()

        class FakePgConnection(PgFakeWithColumns):
            def __enter__(self): return self
            def __exit__(self, *_): return False

            def execute(self, query, params=None):
                if params is not None:
                    return super().execute(query, params)
                return self  # BEGIN / ROLLBACK

        original_connect = sqlite3.connect
        original_replace = os.replace
        opened = []
        def tracked_connect(*args, **kwargs):
            kwargs['factory'] = TrackingConnection
            db = original_connect(*args, **kwargs)
            opened.append(db)
            return db

        def checked_replace(src, dst):
            self.assertEqual(len(opened), 2)  # writer and read-only verifier
            self.assertTrue(all(db.is_closed for db in opened), 'SQLite file still open')
            return original_replace(src, dst)

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'pricewatch-staging.sqlite3'
            arguments = ['script.py', '--out', str(target)]
            psycopg_stub = SimpleNamespace(connect=lambda **_: FakePgConnection())
            with patch.object(migrate, 'load_connection_string', return_value='postgresql://dummy'), \
                    patch.dict(sys.modules, {'psycopg': psycopg_stub}), \
                    patch.object(sys, 'argv', arguments), \
                    patch.object(migrate.sqlite3, 'connect', side_effect=tracked_connect), \
                    patch.object(migrate.os, 'replace', side_effect=checked_replace):
                self.assertEqual(migrate.main(), 0)
            self.assertTrue(target.is_file())

    def test_normalization(self):
        self.assertEqual(migrate.normalize(Decimal('0.00000000012345')), '0.00000000012345')
        self.assertEqual(migrate.normalize(True), 1)
        self.assertEqual(migrate.sqlite_type('numeric'), 'TEXT')
        self.assertEqual(migrate.sqlite_type('int8'), 'INTEGER')


if __name__ == '__main__': unittest.main()
