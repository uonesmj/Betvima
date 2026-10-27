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
CURRENT_NAME_PATCH=(ROOT/'install-current-web-name-preflight-fix.py').read_text()
name_nodes=[n for n in ast.parse(CURRENT_NAME_PATCH).body
            if isinstance(n,ast.Assign) and
            any(isinstance(t,ast.Name) and t.id in {'OLD','NEW'} for t in n.targets)]
name_scope={}
exec(compile(ast.Module(body=name_nodes,type_ignores=[]),
             '<second-installer-constants>','exec'),name_scope)
scope = {}
exec(compile(ast.Module(body=allowed,type_ignores=[]),'<installer-constants>','exec'),scope)


class RoutedWebInstallerTests(unittest.TestCase):
    def test_minimal_historical_patch_matches_reviewed_new_controller(self):
        helper = scope['HELPER']
        new = scope['REPLACEMENT']
        old = scope['LEGACY']
        # First one-time installer reproduces the previous reviewed v1
        # controller; the separately hash-pinned second installer upgrades v1.
        self.assertEqual(DEPLOYER.count(name_scope['NEW']),1)
        version1=DEPLOYER.replace(name_scope['NEW'],name_scope['OLD'])
        self.assertIn(helper+'def main(sha):',version1)
        self.assertIn(new,version1)
        previous = version1.replace(helper+'def main(sha):','def main(sha):').replace(new,old)
        self.assertEqual(previous.count(old),1)
        patched = previous.replace(old,new).replace('def main(sha):',helper+'def main(sha):')
        self.assertEqual(patched,version1)
        compile(patched,'production.py','exec')

    def test_installer_does_not_restart_services_or_touch_finance(self):
        self.assertNotIn("systemctl",INSTALLER)
        self.assertNotIn("nginx -s",INSTALLER)
        self.assertNotIn("pm2 restart",INSTALLER)
        self.assertIn("TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')", INSTALLER)
        self.assertNotIn("subprocess.run(", INSTALLER)
        self.assertIn("PREVIOUS_CONTROLLER_BACKED_UP",INSTALLER)
        self.assertIn("stat.S_IMODE(info.st_mode)",INSTALLER)
        self.assertIn("safe_write(TARGET, original,",INSTALLER)

    def test_only_guarded_single_call_site_is_rewritten(self):
        self.assertEqual(DEPLOYER.count("old,oldport=resolve_active_web_upstream(route,apps)"),1)
        self.assertNotIn("if len(current)!=1",DEPLOYER)
        self.assertIn("if len(websites) != 1:",DEPLOYER)


if __name__ == '__main__':
    unittest.main()
