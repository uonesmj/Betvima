#!/usr/bin/env python3
"""Offline regression tests for the read-only FI reconciliation script."""
import importlib.util
import unittest
from pathlib import Path

path = Path(__file__).with_name("betsapi-fi-events-evidence.py")
spec = importlib.util.spec_from_file_location("betsapi_evidence", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def row(ident, home="Alpha FC", away="Beta", time="1792300000"):
    return {
        "id": ident, "time": time,
        "home": {"name": home}, "away": {"name": away},
        "league": {"name": "Test League"},
    }

class FixtureEvidenceTests(unittest.TestCase):
    def test_unique_identity_is_only_a_candidate(self):
        _, _, candidates, ambiguous, _, duplicates_fi, duplicates_events = module.compare(
            [row("111")], [row("222")])
        self.assertEqual(len(candidates), 1)
        self.assertFalse(candidates[0]["independently_verified"])
        self.assertEqual((ambiguous, duplicates_fi, duplicates_events), ([], 0, 0))

    def test_duplicate_bookmaker_id_rejected(self):
        _, _, candidates, _, unmatched, duplicates_fi, _ = module.compare(
            [row("111"), row("111")], [row("222")])
        self.assertEqual(candidates, [])
        self.assertEqual(duplicates_fi, 1)
        self.assertTrue(all(x["reason"] == "DUPLICATE_FI" for x in unmatched))

    def test_duplicate_events_id_rejected(self):
        _, _, candidates, _, _, _, duplicates_events = module.compare(
            [row("111")], [row("222"), row("222")])
        self.assertEqual(candidates, [])
        self.assertEqual(duplicates_events, 1)

    def test_swapped_teams_are_not_linked(self):
        _, _, candidates, _, unmatched, _, _ = module.compare(
            [row("111")], [row("222", "Beta", "Alpha FC")])
        self.assertEqual(candidates, [])
        self.assertEqual(unmatched[0]["reason"], "SWAPPED_TEAMS")

    def test_time_difference_is_blocked(self):
        _, _, candidates, _, unmatched, _, _ = module.compare(
            [row("111")], [row("222", time="1792302002")])
        self.assertEqual(candidates, [])
        self.assertEqual(unmatched[0]["reason"], "KICKOFF_DIFFERENCE")

if __name__ == "__main__":
    unittest.main()
