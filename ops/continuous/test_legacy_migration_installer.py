"""Regression tests for the root-installed migration guard compatibility patch."""
import pathlib
import runpy
import unittest

DIRECTORY = pathlib.Path(__file__).resolve().parent
installer = runpy.run_path(str(DIRECTORY / 'install-legacy-migration-guard.py'))
prepare = installer['prepare']
old = installer['OLD']
new = installer['NEW']


class LegacyMigrationInstallerTests(unittest.TestCase):
    def test_installs_only_exact_historical_filename_allowance(self):
        reviewed = (DIRECTORY / 'production.py').read_bytes()
        self.assertEqual(reviewed.count(new), 1)
        previous = reviewed.replace(new, old)
        updated = prepare(previous)
        self.assertEqual(updated, reviewed)
        self.assertEqual(prepare(updated), None)

    def test_unexpected_installed_controller_version_is_refused(self):
        reviewed = (DIRECTORY / 'production.py').read_bytes()
        with self.assertRaisesRegex(RuntimeError, 'unexpected_installed_guard_version'):
            prepare(reviewed.replace(new, b'INVALID_GUARD'))
        with self.assertRaisesRegex(RuntimeError, 'missing_migration_safety_guards'):
            prepare(reviewed.replace(new, old).replace(b'BEGIN READ ONLY;', b'BEGIN;'))


if __name__ == '__main__':
    unittest.main()
