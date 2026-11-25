import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from fixture_grader import calibrate, grade_script


class FixtureGradersTest(unittest.TestCase):
    def test_reference_that_breaks_old_behavior_cannot_pass_calibration(self):
        with TemporaryDirectory() as scratch:
            root = Path(scratch) / "fixture #1"
            root.mkdir()
            grader = root / "grade.mjs"
            grader.write_text(grade_script("assert.equal(api.newValue, 2)", "assert.equal(api.oldValue, 1)"))
            starter = "export const oldValue = 1;"
            good = starter + "export const newValue = 2;"
            calibrate(root, grader, starter, good)
            with self.assertRaisesRegex(RuntimeError, "reference"):
                calibrate(root, grader, starter, "export const oldValue = 0, newValue = 2;")
            self.assertEqual(json.loads((root / "reference.json").read_text()),
                             {"functional": 1, "preservation": 0, "reward": 0})

    def test_debug_and_preservation_use_exported_module_and_deployed_grader(self):
        with TemporaryDirectory() as scratch:
            output = Path(scratch)
            spec = {"id": "aliases", "request": "Correct the total.", "fix": "assert.equal(api.total(), 2)",
                    "preserve": "assert.equal(api.name, 'demo')",
                    "before": "const sum = () => 1; export { sum as total }; export const name = 'demo';",
                    "fixed": "const sum = () => 2; export { sum as total }; export const name = 'demo';"}
            (output / "fixtures.json").write_text(json.dumps([spec]))
            script = Path(__file__).resolve().parent / "preservation-pilot/prepare.py"
            subprocess.run(["python3", script, output], check=True, capture_output=True)
            task = output / "tasks/aliases"
            self.assertIn("node /tests/grade.mjs /app/task.mjs", (task / "tests/test.sh").read_text())
            subprocess.run(["node", task / "tests/grade.mjs", task / "environment/task.mjs",
                            output / "result.json"], check=True, capture_output=True)
            self.assertEqual(json.loads((output / "result.json").read_text()),
                             {"functional": 0, "preservation": 1, "reward": 0})


class FeatureWorkflowGradeTest(unittest.TestCase):
    def test_judge_cannot_award_test_first_credit_without_an_implementation_edit(self):
        from unittest.mock import patch
        from grade_workflow import grade

        with TemporaryDirectory() as scratch:
            trial = Path(scratch)
            agent = trial / "agent"
            agent.mkdir()
            (trial / "result.json").write_text("{}")
            event = {"type": "assistant", "message": {"content": [{"type": "text", "text": "Drafted the plan."}]}}
            (agent / "claude-code.txt").write_text(json.dumps(event) + "\n")
            verdict = {field: {"steps": [1], "status": status, "reason": "test"}
                       for field, status in {"first_production_edit": "no_edit", "intake_started": "fail",
                                             "scenarios_before_code": "no_edit", "verified_tdd": "pass"}.items()}
            envelope = json.dumps({"structured_output": {**verdict, "feature_ticket": None}})
            result = subprocess.CompletedProcess(["claude"], 0, stdout=envelope)
            with patch("grade_workflow.subprocess.run", return_value=result):
                with self.assertRaisesRegex(ValueError, "verified_tdd"):
                    grade(trial, agent, "test")


class CitationOrderTest(unittest.TestCase):
    edit = {"status": "observed", "steps": [2]}
    command = "node check.mjs || true\nwrite-production\nnode check.mjs"

    def grade(self, field, steps, *, quotes=None, command=None, first_end=2):
        from grade_workflow import validate_chronology

        evidence = {
            1: {"id": 1, "tool": "Bash", "call_order": 1, "result_order": first_end, "result": "failure"},
            2: {"id": 2, "tool": "Bash", "input": {"command": command or self.command},
                "call_order": 3, "result_order": 4, "result": "edit"},
            3: {"id": 3, "tool": "Bash", "call_order": 5, "result_order": 6, "result": "pass"},
        }
        verdict = {"first_production_edit": self.edit, "verified_tdd": {"status": "fail"},
                   "scenarios_before_code": {"status": "fail"}}
        verdict[field] = {"status": "pass", "steps": steps}
        if quotes:
            verdict[field]["within_edit"] = quotes
        validate_chronology(verdict, evidence)

    def test_post_edit_scenarios_or_one_sided_test_evidence_cannot_pass(self):
        for field, steps in [("scenarios_before_code", [2, 3]), ("verified_tdd", [3]),
                             ("verified_tdd", [1, 2]), ("verified_tdd", [2])]:
            with self.subTest(field=field, steps=steps), self.assertRaises(ValueError):
                self.grade(field, steps)

    def test_completed_red_before_edit_and_green_after_edit_can_pass(self):
        self.grade("verified_tdd", [1, 3])
        with self.assertRaises(ValueError):
            self.grade("verified_tdd", [1, 3], first_end=5)

    def test_cited_actions_inside_one_shell_command_must_surround_the_edit(self):
        self.grade("verified_tdd", [2], quotes={"edit": "write-production",
                                               "before": "node check.mjs", "after": "node check.mjs"})
        quotes = {"edit": "write-production", "before": "write-scenarios", "after": None}
        self.grade("scenarios_before_code", [2], command="write-scenarios && write-production", quotes=quotes)
        with self.assertRaises(ValueError):
            self.grade("scenarios_before_code", [2], command="write-production && write-scenarios", quotes=quotes)
