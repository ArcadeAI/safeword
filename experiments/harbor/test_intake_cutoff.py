import tempfile
import unittest
from contextlib import chdir
from pathlib import Path

from intake_cutoff import changed_paths, classify, observe_boundary, workspace_files

TICKET = ".project/tickets/ABC123-example/ticket.md"
SCENARIO = "features/example.feature"
APPROVAL = {"review_id": "review-id"}


class IntakeCutoffTest(unittest.TestCase):
    def observe(self, *snapshots, files=None):
        phases = iter(snapshots)
        return observe_boundary({}, {TICKET}, lambda: next(phases), lambda: files or {})

    def test_phase_change_with_current_approval(self):
        observed = self.observe({TICKET: "define-behavior"})
        self.assertEqual(observed, {"boundary": "phase_advance", "ticket": TICKET})
        self.assertEqual(classify(observed, APPROVAL), "passed")
        self.assertEqual(classify(observed, None), "phase_without_current_approval")

    def test_scenario_observed_while_ticket_still_in_intake(self):
        intake = {TICKET: "intake"}
        observed = self.observe(intake, intake, files={SCENARIO: "new"})
        self.assertEqual(
            observed, {"boundary": "downstream_edit", "changed": [SCENARIO]}
        )
        self.assertEqual(classify(observed, None), "downstream_edit")

    def test_unordered_changes_do_not_earn_credit_even_with_approval(self):
        advanced = {TICKET: "define-behavior"}
        observed = self.observe(advanced, advanced, files={SCENARIO: "new"})
        self.assertEqual(observed["ticket"], TICKET)
        self.assertEqual(classify(observed, APPROVAL), "order_unverified")

    def test_phase_change_during_file_scan_is_not_graded_as_early(self):
        observed = self.observe(
            {TICKET: "intake"}, {TICKET: "define-behavior"}, files={SCENARIO: "new"}
        )
        self.assertEqual(classify(observed, APPROVAL), "order_unverified")

    def test_ticket_that_never_entered_intake_cannot_earn_credit(self):
        advanced = {TICKET: "define-behavior"}
        observed = observe_boundary({}, set(), lambda: advanced, dict)
        self.assertIsNone(observed)


class ApprovalOrdering(unittest.TestCase):
    def test_pending_late_and_submillisecond_ties_do_not_prove_prior_approval(self):
        from intake_cutoff import approved_before

        record = {
            "id": "r",
            "state": "completed",
            "result": {"data": {"status": "approved"}},
            "updated_at": "1970-01-01T00:00:01.234Z",
        }
        self.assertTrue(approved_before(record, "r", 1_235_000_000))
        self.assertFalse(approved_before(record, "r", 1_234_999_999))
        self.assertFalse(approved_before(record, "r", 1_230_000_000))
        self.assertFalse(
            approved_before({**record, "state": "running"}, "r", 2_000_000_000)
        )


class IntakeTestFiles(unittest.TestCase):
    def test_nested_code_assets_and_ticket_scenarios_but_not_intake_notes(self):
        with tempfile.TemporaryDirectory() as project, chdir(project):
            files = (
                "packages/client/entry.ts",
                "src/config.yaml",
                ".project/tickets/ABC/scenarios.feature",
                ".project/tickets/ABC/spec.md",
                "node_modules/pkg/test.js",
            )
            for name in files:
                path = Path(name)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("changed")
            self.assertEqual(set(workspace_files()), set(files[:3]))

    def test_first_implementation_test_is_an_observable_edit(self):
        with tempfile.TemporaryDirectory() as project:
            for folder in ("test", "tests"):
                (Path(project) / folder).mkdir()
            with chdir(project):
                before = workspace_files()
                for name in ("test/convert.test.ts", "tests/test_temperature_csv.py"):
                    Path(name).write_text("example")
                self.assertEqual(
                    changed_paths(before, workspace_files()),
                    ["test/convert.test.ts", "tests/test_temperature_csv.py"],
                )


if __name__ == "__main__":
    unittest.main()
