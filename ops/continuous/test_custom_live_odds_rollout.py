"""Syntax and fail-closed guard checks for customized live odds rollout."""
import ast
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).parents[1] / 'hotfixes' / 'rollout_fivedollar_live_customized_20261013.py'

class CustomizedLiveOddsSafetyTests(unittest.TestCase):
    def test_script_is_valid_python(self):
        ast.parse(SCRIPT.read_text(encoding='utf8'))

    def test_exact_version_and_conflict_safety(self):
        source = SCRIPT.read_text(encoding='utf8')
        for required in (
            "BASE_REV='32c929c73015d6535ba2946dcc8cb7b0c85e8acc'",
            "REV='ff35935d5b7efb63f522073a2702ef9ba889a32b'",
            "bc96243ef33eca4db158bf413855c8442729eeb9",
            "b7f5024fda4680d1ebca1de577139a0390ba1309",
            "5b118b93f1794933c38cb17a56bc197a49a8ef35",
            'CUSTOM_SOURCE_MERGE_CONFLICT_',
            'WEB_CATALOGUE_INTEGRITY_VERSION_NOT_DEPLOYED',
            'SOURCE_ROLLBACK_COMPLETED',
            "pm('restart',LIVE,'--update-env',enabled=True)",
            'BULK_SETTLEMENT_STATS_UNCHANGED',
        ):
            with self.subTest(required=required):
                self.assertIn(required,source)

    def test_actual_active_live_worker_release_guard(self):
        active = pathlib.Path(__file__).parents[1] / 'hotfixes' / 'rollout_fivedollar_live_active_0dcade_20261013.py'
        source = active.read_text(encoding='utf8')
        ast.parse(source)
        for expected in (
            '/opt/nova-releases/0dcade1f3299935e6eaff732484538df62ddf5fa',
            "BASE_REV='0dcade1f3299935e6eaff732484538df62ddf5fa'",
            '33e159ab069d3c8f455e6c25b66efd4f0a3dcd04',
            '07610e9fcfa058a46987e024de7fb76ffb361701',
            '5b118b93f1794933c38cb17a56bc197a49a8ef35',
            'LIVE_WORKER_ENTRYPOINT_UNEXPECTED',
            'SOURCE_MERGE_CLEAN',
            'CUSTOM_SOURCE_MERGE_CONFLICT_',
            'SOURCE_ROLLBACK_COMPLETED',
            'WEB_CATALOGUE_INTEGRITY_VERIFIED',
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected,source)

if __name__ == '__main__':
    unittest.main()
