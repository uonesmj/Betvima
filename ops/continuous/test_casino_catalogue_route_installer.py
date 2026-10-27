"""Fail-closed catalogue-only Nginx installation regression checks."""
import ast
import json
import pathlib
import types
import unittest
from unittest.mock import patch

SOURCE=(pathlib.Path(__file__).parent/'install-casino-catalogue-route.py').read_text()
module=types.ModuleType('installer_for_casino_catalogue_test')
exec(compile(SOURCE,'nginx-catalogue-installer.py','exec'),module.__dict__)

EXISTING="""server {
    listen 443 ssl;
    location = /api/v1/casino/eligibility {
        proxy_pass http://127.0.0.1:3098;
        proxy_pass_request_headers on;
    }
    location = /api/v1/casino/launch {
        proxy_pass http://127.0.0.1:3098;
        proxy_pass_request_headers on;
    }
    location ^~ /api/webhooks/softaggregator {
        proxy_pass http://127.0.0.1:3098;
    }
    location / {
        proxy_pass http://127.0.0.1:3010;
    }
}
"""

class CatalogueNginxRouteTests(unittest.TestCase):
    def test_actual_deployed_route_shape_is_recognized(self):
        module.verify_baseline(EXISTING)
        amended=EXISTING.replace(module.ANCHOR,module.ROUTE+module.ANCHOR,1)
        self.assertEqual(amended.replace(module.ROUTE,'',1),EXISTING)
        self.assertEqual(amended.count('location = /api/v1/casino/games {'),1)
        self.assertEqual(amended.count('proxy_pass http://127.0.0.1:3010;'),1)
        self.assertEqual(amended.count('proxy_pass http://127.0.0.1:3098;'),4)
        self.assertIn('limit_except GET { deny all; }',amended)

    def test_other_casino_routes_and_web_port_must_be_correct(self):
        for corrupted in (
            EXISTING.replace('location = /api/v1/casino/launch','location = /api/v1/casino/unused'),
            EXISTING.replace('location = /api/v1/casino/eligibility','location = /api/v1/casino/unused'),
            EXISTING.replace('proxy_pass http://127.0.0.1:3010','proxy_pass http://127.0.0.1:3007'),
            EXISTING.replace('proxy_pass http://127.0.0.1:3098','proxy_pass http://127.0.0.1:3007',1),
            EXISTING.replace(module.ANCHOR,module.ROUTE+module.ANCHOR)
        ):
            with self.subTest(corrupted=corrupted[:90]), self.assertRaises(RuntimeError):
                module.verify_baseline(corrupted)

    def test_json_response_contract_is_checked_not_just_http_status(self):
        valid={'ok':True,'data':{'items':[{'id':'g1'}],'total':125}}
        with patch.object(module,'cmd',return_value=json.dumps(valid).encode()) as probe:
            self.assertEqual(module.get_catalogue(module.UPSTREAM_URL),1)
            self.assertIn('--noproxy',probe.call_args.args[0])
        for bad in (
            b'<html>200 OK</html>',
            b'{"ok":false,"data":{"items":[],"total":0}}',
            b'{"ok":true,"data":[]}',
            b'{"ok":true,"data":{"items":{},"total":0}}',
            b'{"ok":true,"data":{"items":[],"total":"0"}}'
        ):
            with self.subTest(body=bad),patch.object(module,'cmd',return_value=bad),self.assertRaises(RuntimeError):
                module.get_catalogue(module.UPSTREAM_URL)

    def test_only_nginx_site_is_written_or_reloaded(self):
        self.assertIn("SITE = Path('/etc/nginx/sites-enabled/betvima.com')",SOURCE)
        self.assertIn("get_catalogue(UPSTREAM_URL)",SOURCE)
        self.assertIn("get_catalogue(LOCAL_URL,local_tls=True)",SOURCE)
        self.assertIn("atomic_write(target,original,",SOURCE)
        self.assertIn("cmd(['/usr/sbin/nginx','-t'])",SOURCE)
        self.assertNotIn("pm2(",SOURCE)
        self.assertNotIn('ALTER TABLE',SOURCE)
        self.assertNotIn('SOFTAGGREGATOR_REAL_MONEY_ENABLED',SOURCE)
        self.assertNotIn('CASINO_REAL_MONEY_ENABLED',SOURCE)

if __name__=='__main__':
    unittest.main()
