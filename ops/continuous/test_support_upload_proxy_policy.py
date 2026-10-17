"""Regression check for Nginx support attachment upload boundaries."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
NGINX = (ROOT / "deploy" / "nginx" / "nova.conf").read_text()
SUPPORT = (ROOT / "src" / "server" / "support" / "attachments.ts").read_text()


class SupportUploadProxyPolicyTest(unittest.TestCase):
    def test_server_checks_ten_mibibytes(self):
        self.assertIn("10 * 1024 * 1024", SUPPORT)

    def test_only_support_messages_have_eleven_megabyte_gateway(self):
        self.assertIn("client_max_body_size 8m;", NGINX)
        self.assertIn("client_max_body_size 11m;", NGINX)
        self.assertIn("location ~ ^/api/v1/support/[0-9a-fA-F-]{36}/messages/?$", NGINX)
        self.assertEqual(NGINX.count("client_max_body_size 11m;"), 1)
        self.assertIn("client_max_body_size 1m;", NGINX)


if __name__ == "__main__":
    unittest.main()
