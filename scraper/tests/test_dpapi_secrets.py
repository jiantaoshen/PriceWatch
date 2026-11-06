"""DPAPI output, migrations, and fail-closed behavior; real Windows on Windows."""
import os
import sqlite3
from unittest.mock import patch

import pytest

from pricewatch import dpapi_secrets
from pricewatch.dpapi_secrets import (PREFIX, SecretProtectionError,
    is_protected, migrate_legacy_password, protect_password, unprotect_password)


def fake_win_crypt(data: bytes, *, encrypt: bool) -> bytes:
    if encrypt:
        return b"protected:" + data[::-1]
    assert data.startswith(b"protected:")
    return data[len(b"protected:"):][::-1]


def test_versioned_ciphertext_roundtrip_and_no_plaintext():
    with patch.object(dpapi_secrets, "_crypt_data", side_effect=fake_win_crypt):
        encrypted = protect_password("A!long-Password123")
        assert encrypted.startswith(PREFIX)
        assert "A!long-Password123" not in encrypted
        assert unprotect_password(encrypted) == "A!long-Password123"


def test_invalid_ciphertext_fails_closed():
    with pytest.raises(SecretProtectionError):
        unprotect_password(PREFIX + "not-base64!!")
    with pytest.raises(SecretProtectionError):
        unprotect_password("old plaintext password")
    assert not is_protected("old plaintext password")


def test_old_sqlite_plaintext_migrates_once():
    db = sqlite3.connect(":memory:")
    try:
        db.execute("CREATE TABLE local_email_settings (id INTEGER PRIMARY KEY,password TEXT NOT NULL)")
        db.execute("INSERT INTO local_email_settings VALUES (1,'old-secret')")
        db.commit()
        with patch.object(dpapi_secrets, "_crypt_data", side_effect=fake_win_crypt):
            assert migrate_legacy_password(db)
            stored = db.execute("SELECT password FROM local_email_settings WHERE id=1").fetchone()[0]
            assert stored.startswith(PREFIX)
            assert "old-secret" not in stored
            assert not migrate_legacy_password(db)
            assert unprotect_password(stored) == "old-secret"
    finally:
        db.close()


def test_migration_does_not_destroy_existing_password_on_dpapi_failure():
    db = sqlite3.connect(":memory:")
    try:
        db.execute("CREATE TABLE local_email_settings (id INTEGER PRIMARY KEY,password TEXT NOT NULL)")
        db.execute("INSERT INTO local_email_settings VALUES (1,'keep-secret')")
        db.commit()
        with patch.object(dpapi_secrets, "_crypt_data", side_effect=SecretProtectionError("cannot encrypt")):
            with pytest.raises(SecretProtectionError):
                migrate_legacy_password(db)
        assert db.execute("SELECT password FROM local_email_settings").fetchone()[0] == "keep-secret"
    finally:
        db.close()


@pytest.mark.skipif(os.name != "nt", reason="Real user-scoped DPAPI needs Windows")
def test_windows_dpapi_real_user_roundtrip():
    secret = "fresh-one-time-DPAPI-test"
    encrypted = protect_password(secret)
    assert encrypted != secret and encrypted.startswith(PREFIX)
    assert unprotect_password(encrypted) == secret


def test_mail_config_migrates_before_smtp_delivery():
    from mail_alerts import config
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    try:
        db.execute("CREATE TABLE local_email_settings (id INTEGER PRIMARY KEY,password TEXT NOT NULL)")
        db.execute("INSERT INTO local_email_settings VALUES (1,'prior-plaintext')")
        db.commit()
        with patch.object(dpapi_secrets, "_crypt_data", side_effect=fake_win_crypt):
            settings = config(db)
            assert settings["password"].startswith(PREFIX)
            assert unprotect_password(settings["password"]) == "prior-plaintext"
            assert config(db)["password"] == settings["password"]
    finally:
        db.close()
