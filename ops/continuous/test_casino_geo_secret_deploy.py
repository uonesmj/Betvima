"""Only the casino geo key is allowed to enter the isolated web release.

Load the pure deployer helper from its AST: importing production.py directly
would load root-only administrator infrastructure.
"""
import ast
import os
import pathlib
import pwd
import re
import stat
import tempfile
import types
import unittest
from unittest.mock import patch

SOURCE=pathlib.Path(__file__).with_name('production.py').read_text()
MODULE=ast.parse(SOURCE)
NODES=[node for node in MODULE.body
       if isinstance(node,ast.FunctionDef)
       and node.name in ('load_geo_hmac_secret','load_callback_hmac_secret')]
assert len(NODES)==2
scope={'pathlib':pathlib,'os':os,'pwd':pwd,'re':re,'stat':stat}
exec(compile(ast.Module(body=NODES,type_ignores=[]),'geo-secret-policy.py','exec'),scope)
load_secret=scope['load_geo_hmac_secret']
load_callback=scope['load_callback_hmac_secret']


class CasinoGeoSecretDeploymentTests(unittest.TestCase):
    KEY='a1'*32

    def safe_file(self,root,body):
        file=pathlib.Path(root)/'.env.production'
        file.write_text(body)
        file.chmod(0o600)
        return file

    def check(self,file):
        with patch.object(pwd,'getpwnam',return_value=types.SimpleNamespace(pw_uid=os.getuid())):
            return load_secret(file)

    def test_valid_key_only_is_loaded(self):
        with tempfile.TemporaryDirectory() as root:
            file=self.safe_file(root,'DATABASE_URL=private-connection\nCASINO_GEO_HMAC_SECRET='+self.KEY+'\n')
            self.assertEqual(self.check(file),self.KEY)
            self.assertNotIn('private-connection',self.check(file))

    def test_optional_key_missing_returns_none(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertIsNone(self.check(pathlib.Path(root)/'not-found'))
            file=self.safe_file(root,'OTHER_SECRET=not-a-geo-key\n')
            self.assertIsNone(self.check(file))

    def test_rejects_bad_duplicate_and_whitespace_values(self):
        with tempfile.TemporaryDirectory() as root:
            for raw in ('abc','z'*64,' '+self.KEY,self.KEY+' ',
                        self.KEY+'\nCASINO_GEO_HMAC_SECRET='+self.KEY):
                with self.subTest(raw_length=len(raw)):
                    file=self.safe_file(root,'CASINO_GEO_HMAC_SECRET='+raw+'\n')
                    with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                        self.check(file)

    def test_rejects_world_readable_file(self):
        with tempfile.TemporaryDirectory() as root:
            file=self.safe_file(root,'CASINO_GEO_HMAC_SECRET='+self.KEY+'\n')
            file.chmod(0o644)
            with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                self.check(file)

    def test_rejects_symlink_file(self):
        with tempfile.TemporaryDirectory() as root:
            target=self.safe_file(root,'CASINO_GEO_HMAC_SECRET='+self.KEY+'\n')
            link=pathlib.Path(root)/'link'
            link.symlink_to(target)
            with self.assertRaises(OSError):
                self.check(link)

    def test_rejects_excessive_file_size(self):
        with tempfile.TemporaryDirectory() as root:
            file=self.safe_file(root,'X'*270000)
            with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                self.check(file)

    def test_candidate_loads_secret_and_existing_web_is_not_restarted(self):
        self.assertIn("values['CASINO_GEO_HMAC_SECRET']=geo_secret",SOURCE)
        self.assertIn("geo_secret=load_geo_hmac_secret()",SOURCE)
        self.assertNotIn("pm2(['restart'",SOURCE)


class CasinoCallbackSecretDeploymentTests(unittest.TestCase):
    KEY='qX9!aZ7.3bR5-kD4@gV6+fM8%pT2~sC1E4jK'

    def safe_file(self,root,body):
        file=pathlib.Path(root)/'.env.production'
        file.write_text(body)
        file.chmod(0o600)
        return file

    def check(self,file):
        with patch.object(pwd,'getpwnam',return_value=types.SimpleNamespace(pw_uid=os.getuid())):
            return load_callback(file)

    def test_only_callback_secret_loaded_from_protected_file(self):
        with tempfile.TemporaryDirectory() as root:
            file=self.safe_file(root,
                'SUPABASE_SERVICE_ROLE_KEY=must-not-be-transferred\n'
                'CASINO_GEO_HMAC_SECRET='+'ab'*32+'\n'
                'SOFTAGGREGATOR_EDGE_HMAC_SECRET='+self.KEY+'\n')
            self.assertEqual(self.check(file),self.KEY)
            self.assertNotIn('must-not-be-transferred',self.check(file))

    def test_missing_key_stays_off(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertIsNone(self.check(pathlib.Path(root)/'missing'))
            self.assertIsNone(self.check(self.safe_file(root,'OTHER_KEY=abc\n')))

    def test_rejects_short_duplicate_whitespace_and_newline_injection(self):
        with tempfile.TemporaryDirectory() as root:
            for raw in (
                'short',
                ' '+self.KEY,
                self.KEY+' ',
                self.KEY+'\nSOFTAGGREGATOR_EDGE_HMAC_SECRET='+self.KEY,
                self.KEY+'\nSOFTAGGREGATOR_REAL_MONEY_ENABLED=true',
            ):
                with self.subTest(length=len(raw)):
                    file=self.safe_file(root,'SOFTAGGREGATOR_EDGE_HMAC_SECRET='+raw+'\n')
                    if raw.endswith('SOFTAGGREGATOR_REAL_MONEY_ENABLED=true'):
                        self.assertEqual(self.check(file),self.KEY)
                    else:
                        with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                            self.check(file)

    def test_rejects_public_file_symlink_and_excess_size(self):
        with tempfile.TemporaryDirectory() as root:
            file=self.safe_file(root,'SOFTAGGREGATOR_EDGE_HMAC_SECRET='+self.KEY+'\n')
            file.chmod(0o644)
            with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                self.check(file)
            file.chmod(0o600)
            link=pathlib.Path(root)/'link'
            link.symlink_to(file)
            with self.assertRaises(OSError):
                self.check(link)
            file.write_text('X'*270000)
            with self.assertRaisesRegex(ValueError,'runtime_configuration_incomplete'):
                self.check(file)

    def test_new_web_candidates_receive_only_secret_without_cash_activation(self):
        self.assertIn("callback_secret=load_callback_hmac_secret()",SOURCE)
        self.assertIn("values['SOFTAGGREGATOR_EDGE_HMAC_SECRET']=callback_secret",SOURCE)
        self.assertNotIn("values['SOFTAGGREGATOR_REAL_MONEY_ENABLED']='true'",SOURCE)
        self.assertNotIn("pm2(['restart'",SOURCE)


if __name__=='__main__':
    unittest.main()
