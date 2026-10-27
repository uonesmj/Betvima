"""One-time deploy-controller patch must match the reviewed production.py exactly."""
import ast
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).parent
DEPLOYER = (ROOT/'production.py').read_text()
INSTALLER = (ROOT/'install-routed-web-preflight-fix.py').read_text()
tree = ast.parse(INSTALLER)
allowed = [n for n in tree.body
           if isinstance(n, ast.Assign) and any(
               isinstance(t, ast.Name) and t.id in {'LEGACY','REPLACEMENT','HELPER'}
               for t in n.targets)]
scope = {}
exec(compile(ast.Module(body=allowed,type_ignores=[]),'<installer-constants>','exec'),scope)


class RoutedWebInstallerTests(unittest.TestCase):
    def test_minimal_historical_patch_matches_reviewed_new_controller(self):
        helper = scope['HELPER']
        new = scope['REPLACEMENT']
        old = scope['LEGACY']
        self.assertIn(helper+'def main(sha):',DEPLOYER)
        self.assertIn(new,DEPLOYER)
        previous = DEPLOYER.replace(helper+'def main(sha):','def main(sha):').replace(new,old)
        self.assertEqual(previous.count(old),1)
        patched = previous.replace(old,new).replace('def main(sha):',helper+'def main(sha):')
        self.assertEqual(patched,DEPLOYER)
        compile(patched,'production.py','exec')

    def test_installer_does_not_restart_services_or_touch_finance(self):
        self.assertNotIn("systemctl",INSTALLER)
        self.assertNotIn("nginx -s",INSTALLER)
        self.assertNotIn("pm2 restart",INSTALLER)
        self.assertNotIn("wallet",INSTALLER.lower().split("def main():")[-1])
        self.assertIn("PREVIOUS_CONTROLLER_BACKED_UP",INSTALLER)
        self.assertIn("stat.S_IMODE(info.st_mode)",INSTALLER)
        self.assertIn("safe_write(TARGET, original,",INSTALLER)

    def test_only_guarded_single_call_site_is_rewritten(self):
        self.assertEqual(DEPLOYER.count("old,oldport=resolve_active_web_upstream(route,apps)"),1)
        self.assertNotIn("if len(current)!=1",DEPLOYER)
        self.assertIn("if len(websites) != 1:",DEPLOYER)


if __name__ == '__main__':
    unittest.main()
