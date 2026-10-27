"""Public production health: Cloudflare-compatible UA, no weaker assertions."""
import ast
import hashlib
import json
import pathlib
import time
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

ROOT=pathlib.Path(__file__).parent
SOURCE=(ROOT/'production.py').read_text()
INSTALLER=(ROOT/'install-public-health-cloudflare-agent.py').read_text()
node=next(n for n in ast.parse(SOURCE).body
          if isinstance(n,ast.FunctionDef) and n.name=='health')
ns={'urllib':urllib,'json':json}
exec(compile(ast.Module(body=[node],type_ignores=[]),'public-health-only.py','exec'),ns)
health=ns['health']
PATHS=['/','/live','/sports/football','/auth/login','/wallet',
       '/api/health/ready','/api/v1/matches?pageSize=1',
       '/api/v1/wallet','/api/v1/bets']

class Response:
    status=200
    def __init__(self,content):self.content=content
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,limit=None):return self.content

class ProductionPublicHealthTests(unittest.TestCase):
    def probe(self,base,mode='normal'):
        recorded=[]
        def fake_open(req,timeout=None):
            recorded.append(req)
            path=req.full_url[len(base):]
            if path in ('/api/v1/wallet','/api/v1/bets'):
                if mode=='wallet_unguarded':return Response(b'private!')
                raise urllib.error.HTTPError(req.full_url,401,'Unauthorized',{},None)
            if mode=='blocked' and base=='https://betvima.com':
                raise urllib.error.HTTPError(req.full_url,403,'Forbidden',{},None)
            if path=='/':
                return Response(b'HTML build-abc' if mode!='wrong_build' else b'HTML old build')
            if path=='/api/health/ready':
                return Response(b'{"ready":true}' if mode!='not_ready' else b'{"ready":false}')
            return Response(b'{}')
        with patch.object(urllib.request,'urlopen',side_effect=fake_open):
            if mode in ('wallet_unguarded','blocked','wrong_build','not_ready'):
                with self.assertRaises((ValueError,urllib.error.HTTPError)):
                    health(base,'build-abc')
            else:
                health(base,'build-abc')
        return recorded

    def test_public_probe_uses_verified_curl_ua_for_all_routes_including_financial_guards(self):
        requests=self.probe('https://betvima.com')
        self.assertEqual(len(requests),len(PATHS))
        self.assertEqual([q.full_url.removeprefix('https://betvima.com') for q in requests],PATHS)
        for req in requests:
            headers={k.lower():v for k,v in req.header_items()}
            self.assertEqual(headers['user-agent'],'curl/8.5.0')
            self.assertEqual(headers['host'],'betvima.com')

    def test_internal_candidate_never_gets_public_waf_user_agent(self):
        for req in self.probe('http://127.0.0.1:3020'):
            self.assertNotIn('user-agent',{k.lower():v for k,v in req.header_items()})

    def test_health_checks_still_fail_closed(self):
        for mode in ('wallet_unguarded','blocked','wrong_build','not_ready'):
            with self.subTest(mode=mode):
                self.assertGreater(len(self.probe('https://betvima.com',mode)),0)

    def test_installer_patch_round_trip_matches_exact_reviewed_blob(self):
        tree=ast.parse(INSTALLER)
        assignments=[n for n in tree.body if isinstance(n,ast.Assign)
                     and any(isinstance(t,ast.Name) and t.id in
                             {'OLD_BLOB','NEW_BLOB','PATCHES'} for t in n.targets)]
        vals={}
        exec(compile(ast.Module(body=assignments,type_ignores=[]),'const-only.py','exec'),vals)
        def blob(contents):
            return hashlib.sha1(b'blob '+str(len(contents)).encode()+b'\0'+contents).hexdigest()
        self.assertEqual(blob(SOURCE.encode()),vals['NEW_BLOB'])
        old=SOURCE
        for a,b in reversed(vals['PATCHES']):
            self.assertEqual(old.count(b),1)
            old=old.replace(b,a,1)
        self.assertEqual(blob(old.encode()),vals['OLD_BLOB'])
        for a,b in vals['PATCHES']:
            old=old.replace(a,b,1)
        self.assertEqual(old,SOURCE)

    def test_installer_is_scoped_and_does_not_disable_any_monitoring(self):
        self.assertNotIn('subprocess.run(',INSTALLER)
        self.assertNotIn('systemctl',INSTALLER)
        self.assertNotIn('pm2([',INSTALLER)
        self.assertIn("TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')",INSTALLER)
        self.assertIn("ALL_HEALTH_AND_FINANCIAL_GUARDS_PRESERVED",INSTALLER)
        self.assertIn("replace_atomic(TARGET,original,",INSTALLER)

if __name__=='__main__':
    unittest.main()
