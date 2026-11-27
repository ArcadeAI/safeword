import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from intake.handoff import HOSTS
from intake.handoff_report import Attempt, decision, report
from intake.run import write_json


class HandoffReportTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        matrix = patch(
            "intake.handoff_report.cells",
            return_value=[("baseline", "hidden", 1, "codex")],
        )
        matrix.start()
        self.addCleanup(matrix.stop)

    def record(self, name, outcome="passed", grade="yes", cost=1.0, reason=None):
        folder = self.root / name
        lane = "trials/intake-shift-overlap/codex"
        path = folder / lane
        path.mkdir(parents=True)
        (folder / "bundle.tar").write_bytes(b"archived plugin")
        (folder / "fixture").mkdir()
        (folder / "fixture/instruction.md").write_text("Build a CLI.")
        write_json(folder / "comparison.json", {"models": {"codex": "frozen"}})
        write_json(folder / "build.json", {"archive_sha256": "archive"})
        write_json(
            folder / "intake-results.json",
            {
                lane: {
                    "outcome": outcome,
                    "evidence": "evidence-index.json",
                    "cost_usd": cost,
                    "product": {
                        "plan_matches": grade,
                        "useful_asks": 1,
                        "repeat_asks": 0,
                        "evaluation_cost_usd": 0.1,
                    },
                }
            },
        )
        write_json(
            path / "evidence-index.json",
            {
                "model_spend": {
                    "author": {"cost_usd": 0.2},
                    "reviewer": {"calls": [{"cost_usd": 0.1}, {"cost_usd": None}]},
                    "budget_stop": {"reason": reason} if reason else None,
                }
            },
        )
        return folder

    def test_missing_or_ungraded_primary_is_incomplete(self):
        text, complete = report(self.root)
        self.assertFalse(complete)
        self.assertIn("missing |", text)
        self.assertIn("The frozen protocol is missing.", text)
        self.record("baseline-hidden-1", grade="unclear")
        text, complete = report(self.root)
        self.assertFalse(complete)
        self.assertIn("| incomplete | passed | unclear |", text)

    def test_identical_retry_replaces_interruption_and_both_costs_count(self):
        self.record(
            "baseline-hidden-1",
            "budget_before_gate",
            "unclear",
            None,
            "author_usage_unpriced",
        )
        retry = self.record("retries/baseline-hidden-1")
        self.record("holdout/candidate", "passed", "yes", 100)
        text, complete = report(self.root)
        self.assertIn("| baseline | 1/1 | 2 | ≥$1.30 | ≥$1.30 | $0.20 |", text)
        self.assertIn("candidate/codex · workflow passed", text)
        (retry / "fixture/instruction.md").write_text("A different prompt")
        text, complete = report(self.root)
        self.assertFalse(complete)
        self.assertIn("unexpected retry; excluded", text)

    def test_unknown_budget_stop_cannot_be_replaced_by_a_successful_retry(self):
        self.record("baseline-hidden-1", "budget_before_gate", reason="author_cap")
        self.record("retries/baseline-hidden-1")
        text, complete = report(self.root)
        self.assertFalse(complete)
        self.assertIn("unexpected retry; excluded", text)

    def test_workflow_failure_is_conclusive_and_cannot_be_replaced(self):
        self.record("baseline-hidden-1", "downstream_edit", "unclear")
        text, complete = report(self.root)
        self.assertIn("| failed | downstream_edit | unclear |", text)
        self.record("retries/baseline-hidden-1")
        text, complete = report(self.root)
        self.assertFalse(complete)
        self.assertIn("| baseline | 0/1 | 2", text)

    def test_locked_archive_detects_prompt_drift_without_running_a_model(self):
        from intake.handoff import fixture_hashes, harness_inputs, sha

        name = "baseline-hidden-1"
        folder = self.record(name)
        build = {"archive_sha256": sha(folder / "bundle.tar")}
        write_json(folder / "build.json", build)
        (self.root / "comparison.json").write_bytes(
            (folder / "comparison.json").read_bytes()
        )
        write_json(
            self.root / "protocol.json",
            {
                "protocol": "intake-handoff-v1",
                "harness": harness_inputs(),
                "inputs": {"comparison.json": sha(folder / "comparison.json")},
                "groups": {
                    name: {
                        "build": build,
                        "fixture": fixture_hashes(folder / "fixture"),
                    }
                },
            },
        )
        self.assertIn("| passed | passed | yes |", report(self.root)[0])
        (folder / "fixture/instruction.md").write_text("Changed")
        with self.assertRaisesRegex(ValueError, "Prepared trial inputs changed"):
            report(self.root)


class DecisionTest(unittest.TestCase):
    def setUp(self):
        self.groups = {}
        for host in HOSTS:
            for arm in ("baseline", "candidate"):
                for case in ("hidden", "supplied"):
                    grade = {
                        "asked": "yes" if case == "hidden" else "no",
                        "useful_asks": int(case == "hidden"),
                        "repeat_asks": 0,
                        "unclassified_asks": 0,
                        "unclear_turns": 0,
                    }
                    self.groups[arm, case, host] = [
                        Attempt({"product": grade}, "passed")
                    ]

    def test_tie_keeps_baseline_and_gain_only_advances_to_holdout(self):
        self.assertIn("tied", decision(self.groups, True)[1])
        self.groups["baseline", "supplied", "codex"][0].status = "failed"
        self.assertEqual(
            decision(self.groups, True),
            (True, "Send the candidate to a fresh holdout on both hosts."),
        )
        self.groups["candidate", "supplied", "claude"][0].product.update(
            asked="yes", repeat_asks=1
        )
        self.assertIn("Keep baseline", decision(self.groups, True)[1])

    def test_missing_or_uncertain_question_grades_withhold_decision(self):
        grade = self.groups["candidate", "hidden", "codex"][0].product
        del grade["repeat_asks"]
        complete, result = decision(self.groups, True)
        self.assertFalse(complete)
        self.assertIn("Clarification grades", result)
        self.assertIn("candidate/hidden/codex", result)
