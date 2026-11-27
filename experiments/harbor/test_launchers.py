import os
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


class LauncherTests(unittest.TestCase):
    def test_bad_arm_and_missing_fixture_stop_before_resolving_models(self):
        for task, arm, error in [
            ("reservation", "not-an-arm", "Unknown comparison arm"),
            ("debug-routing/tasks/absent-fixture", "checkout", "Missing Harbor task"),
        ]:
            with self.subTest(task=task):
                result = subprocess.run(
                    [HERE / "compare.sh", arm], capture_output=True, text=True,
                    env={**os.environ, "SAFEWORD_EVAL_TASK": task},
                )
                self.assertEqual(result.returncode, 2)
                self.assertIn(error, result.stderr)

    def test_suite_preserves_an_existing_report_index(self):
        with tempfile.TemporaryDirectory() as path:
            index = Path(path) / "job-reports.txt"
            index.write_text("previous run\n")
            result = subprocess.run(
                [HERE / "compare-suite.sh"], capture_output=True, text=True,
                env={**os.environ, "SAFEWORD_EVAL_RELAY_DIR": path},
            )
            self.assertEqual(result.returncode, 2)
            self.assertEqual(index.read_text(), "previous run\n")
