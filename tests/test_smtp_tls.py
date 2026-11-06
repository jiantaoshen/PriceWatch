"""Check that SMTP authentication uses certificate-verified TLS."""
from pathlib import Path
import sys
from unittest import TestCase
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scraper"))
from mail_alerts import deliver


class SMTPTransportTests(TestCase):
    settings = {
        "smtp_port": 587, "smtp_host": "smtp.example.org",
        "from_address": "sender@example.org", "to_address": "receiver@example.org",
        "username": "testuser", "password": "testpass", "use_tls": 1,
    }

    @patch("mail_alerts.smtplib.SMTP")
    @patch("mail_alerts.ssl.create_default_context")
    def test_starttls_verifies_certificates(self, context, smtp):
        deliver(self.settings, "Test", "Hello")
        instance = smtp.return_value.__enter__.return_value
        instance.starttls.assert_called_once_with(context=context.return_value)
        instance.ehlo.assert_called_once()
        instance.login.assert_called_once_with("testuser", "testpass")

    @patch("mail_alerts.smtplib.SMTP_SSL")
    @patch("mail_alerts.ssl.create_default_context")
    def test_implicit_tls_verifies_certificates(self, context, smtp):
        deliver({**self.settings, "smtp_port": 465}, "Test", "Hello")
        self.assertEqual(smtp.call_args.kwargs["context"], context.return_value)
        smtp.return_value.__enter__.return_value.login.assert_called_once()

    @patch("mail_alerts.smtplib.SMTP")
    def test_rejects_auth_without_tls(self, smtp):
        with self.assertRaisesRegex(ValueError, "TLS must be enabled"):
            deliver({**self.settings, "use_tls": 0}, "Test", "Hello")
        smtp.return_value.__enter__.return_value.login.assert_not_called()

    @patch("mail_alerts.smtplib.SMTP")
    @patch("mail_alerts.ssl.create_default_context")
    def test_encrypted_password_is_unwrapped_before_login(self, context, smtp):
        from pricewatch import dpapi_secrets
        from unittest.mock import patch as mock_patch
        def fake_crypto(value, *, encrypt):
            return (b"protected:" + value) if encrypt else value[len(b"protected:"):]
        with mock_patch.object(dpapi_secrets, "_crypt_data", side_effect=fake_crypto):
            ciphertext = dpapi_secrets.protect_password("my-smtp-app-password")
            deliver({**self.settings, "password": ciphertext}, "Test", "Hello")
        instance = smtp.return_value.__enter__.return_value
        instance.login.assert_called_once_with("testuser", "my-smtp-app-password")
