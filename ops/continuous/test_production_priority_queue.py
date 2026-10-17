"""Regression guards for owner-prioritized, non-cancelling production CI."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = (ROOT / ".github" / "workflows" / "continuous.yml").read_text()


def job(name):
    start = WORKFLOW.index("\n  " + name + ":\n")
    other_jobs = [WORKFLOW.find("\n  " + value + ":\n", start + 1)
                  for value in ("checks", "preview", "production") if value != name]
    end = min((end for end in other_jobs if end >= 0), default=len(WORKFLOW))
    return WORKFLOW[start:end]


class ProductionPriorityQueueTests(unittest.TestCase):
    def test_preview_cannot_evict_pending_owner_approval(self):
        preview = job("preview")
        production = job("production")
        self.assertIn("group: betvima-server-preview", preview)
        self.assertIn("group: betvima-server-production", production)
        self.assertIn("queue: max", production)
        self.assertIn("cancel-in-progress: false", production)
        self.assertNotIn("group: betvima-server-production", preview)

    def test_owner_approvals_are_isolated_from_the_main_push_group(self):
        self.assertIn("github.event_name == 'workflow_dispatch' && github.run_id || github.ref", WORKFLOW)
        self.assertIn("cancel-in-progress: false", WORKFLOW)

    def test_release_is_still_owner_and_branch_approved(self):
        production = job("production")
        self.assertIn("inputs.approve_production", production)
        self.assertIn("github.actor == 'uonesmj'", production)
        self.assertIn("github.ref == 'refs/heads/main'", production)
        self.assertIn("needs: checks", production)
        self.assertIn("python3 ops/continuous/dispatch.py production", production)

    def test_server_serialization_is_not_removed(self):
        controller = (ROOT / "ops" / "continuous" / "ci-http.py").read_text()
        self.assertIn("LOCK.acquire(blocking=False)", controller)
        self.assertIn("409", controller)
        self.assertIn("LOCK.release()", controller)


if __name__ == "__main__":
    unittest.main()
