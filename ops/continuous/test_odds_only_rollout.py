"""Ensure the extra football API can only be retired after Odds-only web release."""
import ast
import pathlib
import unittest

ROOT = pathlib.Path(__file__).parents[1]
SCRIPT = ROOT / "hotfixes" / "retire_secondary_football_integrations_20261013.py"

class OddsOnlyRolloutTests(unittest.TestCase):
    def test_syntax_and_source_safety(self):
        source = SCRIPT.read_text(encoding="utf8")
        ast.parse(source)
        required = [
            "ODDS_ONLY_WEB_VERIFIED",
            "ODDS_ONLY_WEB_RELEASE_NOT_LIVE",
            "ODDS_API_CREDENTIAL_NOT_VERIFIED_",
            "FIVEDOLLAR_BETTING_ODDS_ENABLED",
            "FIVEDOLLAR_API_KEY",
            "SECONDARY_STATS_WORKER_REMOVED",
            "ODDS_ONLY_WORKER_READY",
            "ODDS_WORKER_ROLLBACK",
            "SETTLEMENT_PROCESS_CHANGED",
            "ODDS_ONLY_PM2_DEPLOYED",
            "PM2_BACKUP_SECURED",
            '"pm2", *args',
        ]
        for token in required:
            with self.subTest(token=token):
                self.assertIn(token, source)

    def test_no_betting_financial_database_changes(self):
        source = SCRIPT.read_text(encoding="utf8")
        for prohibited in (
            "nova.bets", "nova.wallets", "DELETE FROM", "TRUNCATE ",
            "UPDATE nova.", "DROP TABLE", "settlement.worker",
        ):
            self.assertNotIn(prohibited, source)

if __name__ == "__main__":
    unittest.main()
