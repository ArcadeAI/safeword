import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch

from intake import handoff
from intake.run import write_json


class FrozenHandoffTest(unittest.TestCase):
    def test_primary_design(self):
        cells = list(handoff.cells())
        self.assertEqual(len(set(cells)), 16)
        self.assertEqual(
            Counter((arm, case, host) for arm, case, _, host in cells),
            {
                (arm, case, host): repeats
                for arm in ("baseline", "candidate")
                for host in ("claude", "codex")
                for case, repeats in (("supplied", 3), ("hidden", 1))
            },
        )

    def test_freeze_resume_and_changed_inputs(self):
        def fixture(folder, snapshot, revision, task):
            (folder / "fixture").mkdir(parents=True)
            (folder / "fixture/instruction.md").write_text(task)
            (folder / "bundle.tar").write_text(revision)
            (folder / "comparison.json").write_bytes(snapshot.read_bytes())
            write_json(
                folder / "build.json",
                {
                    "verified_commit": revision,
                    "archive_sha256": handoff.sha(folder / "bundle.tar"),
                    "fixture": task,
                },
            )

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            snapshot = root / "models.json"
            write_json(snapshot, {"models": {"codex": "pinned", "claude": "pinned"}})
            job = root / "job"
            with patch("intake.handoff.prepare", side_effect=fixture):
                handoff.freeze(job, snapshot, {"baseline": "HEAD", "candidate": "HEAD"})

            with patch("intake.handoff.trial_command") as launch:
                handoff.run(job)
                self.assertEqual(launch.call_count, 16)
                self.assertEqual(
                    launch.call_args.args[-1]["SAFEWORD_EVAL_DECISION_CATALOG"],
                    str(job / "decisions.json"),
                )
                finished = (
                    job
                    / "baseline-supplied-1/trials/intake-shift-specified/claude/harbor/finished"
                )
                finished.mkdir(parents=True)
                write_json(finished / "result.json", {})
                launch.reset_mock()
                handoff.run(job)
                self.assertEqual(launch.call_count, 15)
                (job / "candidate-hidden-1/fixture/instruction.md").write_text(
                    "changed"
                )
                launch.reset_mock()
                with self.assertRaisesRegex(
                    ValueError, "Prepared trial inputs changed"
                ):
                    handoff.run(job)
                launch.assert_not_called()
