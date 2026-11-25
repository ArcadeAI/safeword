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
