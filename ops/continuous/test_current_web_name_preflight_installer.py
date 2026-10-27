"""Regression protection for the one-time root-owned legacy web resolver patch."""
import ast
import hashlib
import pathlib
import re
import unittest

ROOT=pathlib.Path(__file__).parent
INSTALLER=(ROOT/'install-current-web-name-preflight-fix.py').read_text()
PRODUCTION=(ROOT/'production.py').read_text()
nodes=ast.parse(INSTALLER).body
constants=[node for node in nodes if isinstance(node,ast.Assign) and
           any(isinstance(t,ast.Name) and t.id in
               {'OLD_BLOB','NEW_BLOB','OLD','NEW'} for t in node.targets)]
funcs=[node for node in nodes if isinstance(node,ast.FunctionDef) and
       node.name in {'git_blob','verify_resolver'}]
scope={'hashlib':hashlib,'re':re,'ast':ast}
exec(compile(ast.Module(body=constants+funcs,type_ignores=[]),
             'reviewed-patch-policy.py','exec'),scope)

class InstalledLegacyWebPatchTests(unittest.TestCase):
    def test_exact_reviewed_old_and_new_file_digests(self):
        self.assertEqual(scope['git_blob'](PRODUCTION.encode()),scope['NEW_BLOB'])
        self.assertEqual(PRODUCTION.count(scope['NEW']),1)
        old=PRODUCTION.replace(scope['NEW'],scope['OLD'])
        self.assertNotEqual(old,PRODUCTION)
        self.assertEqual(scope['git_blob'](old.encode()),scope['OLD_BLOB'])
        self.assertEqual(old.replace(scope['OLD'],scope['NEW']),PRODUCTION)
        scope['verify_resolver'](PRODUCTION)

    def test_does_not_restart_services_or_alter_nginx(self):
        self.assertNotIn('subprocess',INSTALLER)
        self.assertNotIn('systemctl',INSTALLER)
        self.assertNotIn('pm2([',INSTALLER)
        self.assertIn("TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')",INSTALLER)
        self.assertIn("if old_sha!=OLD_BLOB:",INSTALLER)
        self.assertIn("if git_blob(candidate)!=NEW_BLOB:",INSTALLER)
        self.assertIn("atomic_replace(TARGET,original,",INSTALLER)

    def test_web_classifier_preserves_fail_closed_semantics(self):
        method=scope['verify_resolver']
        method(PRODUCTION)
        self.assertIn("if len(websites) != 1:",PRODUCTION)
        self.assertIn("name.startswith('nova-cd-')",PRODUCTION)
        self.assertIn("r'nova-casino-weekly-kyc-prod-[A-Za-z0-9]{8}'",PRODUCTION)
        self.assertNotIn("name.startswith('nova-casino-')",PRODUCTION)

if __name__=='__main__':
    unittest.main()
