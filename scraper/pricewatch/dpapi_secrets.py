"""Encrypt SMTP app passwords with Windows DPAPI for the current Windows user.

The DB stores only versioned ciphertext. The CLI receives plaintext on stdin,
never as a process command-line argument. No fallback key or plaintext storage.
"""
from __future__ import annotations

import base64
import binascii
import ctypes
import os
import sys
from ctypes import wintypes

PREFIX = "dpapi:v1:"
_DESCRIPTION = "PriceWatch local SMTP password"
_ENTROPY = b"PriceWatch.local/SMTP/v1"
_CRYPTPROTECT_UI_FORBIDDEN = 0x1


class SecretProtectionError(RuntimeError):
    """DPAPI is unavailable or the encrypted password cannot be recovered."""


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


def _input_blob(value: bytes):
    # Keep memory alive for the entire call to the Windows crypt API.
    buffer = ctypes.create_string_buffer(value)
    return _DataBlob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))), buffer


def _crypt_data(value: bytes, *, encrypt: bool) -> bytes:
    if os.name != "nt":
        raise SecretProtectionError("SMTP password encryption requires Windows DPAPI.")

    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    protect = crypt32.CryptProtectData
    unprotect = crypt32.CryptUnprotectData
    protect.argtypes = [ctypes.POINTER(_DataBlob), wintypes.LPCWSTR,
                        ctypes.POINTER(_DataBlob), ctypes.c_void_p, ctypes.c_void_p,
                        wintypes.DWORD, ctypes.POINTER(_DataBlob)]
    unprotect.argtypes = [ctypes.POINTER(_DataBlob), ctypes.c_void_p,
                          ctypes.POINTER(_DataBlob), ctypes.c_void_p, ctypes.c_void_p,
                          wintypes.DWORD, ctypes.POINTER(_DataBlob)]
    protect.restype = unprotect.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

    input_data, input_memory = _input_blob(value)
    entropy, entropy_memory = _input_blob(_ENTROPY)
    output = _DataBlob()
    # DPAPI encrypts under the *current user*, not the machine account.
    if encrypt:
        result = protect(ctypes.byref(input_data), _DESCRIPTION, ctypes.byref(entropy),
                         None, None, _CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(output))
    else:
        result = unprotect(ctypes.byref(input_data), None, ctypes.byref(entropy),
                           None, None, _CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(output))
    # Keep these buffers alive across the call (including PyPy-style runtimes).
    del input_memory, entropy_memory
    if not result:
        raise SecretProtectionError(
            "Windows could not protect/unprotect the SMTP password. "
            "Use the same Windows account for the website and scheduled task."
        )
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(output.pbData, ctypes.c_void_p))


def is_protected(stored: str) -> bool:
    return stored.startswith(PREFIX)


def protect_password(password: str) -> str:
    if not isinstance(password, str):
        raise TypeError("Password must be text")
    if not password:
        return ""
    blob = _crypt_data(password.encode("utf-8"), encrypt=True)
    return PREFIX + base64.b64encode(blob).decode("ascii")


def unprotect_password(stored: str) -> str:
    if not is_protected(stored):
        raise SecretProtectionError("SMTP password has not been migrated to DPAPI.")
    try:
        encoded = stored[len(PREFIX):]
        blob = base64.b64decode(encoded, validate=True)
        if not blob:
            raise ValueError("Empty encrypted password")
        return _crypt_data(blob, encrypt=False).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError) as error:
        raise SecretProtectionError("Stored SMTP password is damaged or invalid.") from error


def migrate_legacy_password(db) -> bool:
    """Encrypt an old plaintext password in place, without creating a new table.

    Uses SQLite secure_delete to minimize recoverable plaintext in freed cells.
    Existing backups/WAL copies still need independent protection.
    """
    row = db.execute("SELECT password FROM local_email_settings WHERE id=1").fetchone()
    if not row:
        return False
    stored = row[0]
    if not stored or is_protected(stored):
        return False
    encrypted = protect_password(stored)  # Fail closed: keep original on error.
    db.execute("PRAGMA secure_delete=ON")
    with db:
        db.execute("UPDATE local_email_settings SET password=? WHERE id=1 AND password=?",
                   (encrypted, stored))
    return True


def main() -> int:
    if sys.argv[1:] != ["protect"]:
        print("Usage: python dpapi_secrets.py protect (password on stdin)", file=sys.stderr)
        return 2
    try:
        # No secret is passed in the subprocess argv, environment or logs.
        password = sys.stdin.read(4097)
        if len(password) > 4000:
            raise SecretProtectionError("SMTP password is too long.")
        print(protect_password(password))
        return 0
    except (SecretProtectionError, UnicodeError) as error:
        print(f"SMTP password protection failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
