import json
import os
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from intake.run import launch, materialize_fixture, prepare, write_json
from intake.score import score, trial_result


class IntakeRunnerTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()
        self.snapshot = {
            "models": {"claude": "claude-test", "codex": "codex-test"},
            "versions": {"claude": "1.2.3", "codex": "4.5.6"},
            "pricing": {"models": {"claude-test": {}, "codex-test": {}}},
        }
        self.snapshot_file = self.root / "comparison.json"
        write_json(self.snapshot_file, self.snapshot)

    def test_prepare_pins_native_plugins_and_builds_unhinted_fixture(self):
        import tarfile

        output = self.root / "run"
        prepare(output, self.snapshot_file, "HEAD", "csv")
        with tarfile.open(output / "bundle.tar") as bundle:
            for path in (
                "plugin/skills/bdd/SKILL.md",
                "packages/cli/codex-plugin/skills/bdd/SKILL.md",
            ):
                self.assertTrue(bundle.getmember(path).isfile())
        docker = (output / "fixture/environment/Dockerfile").read_text()
        self.assertIn("ARG CODEX_VERSION=4.5.6", docker)
        self.assertNotIn(
            "intake-csv-keep", (output / "fixture/instruction.md").read_text()
        )
        with self.assertRaises(FileExistsError):
            prepare(output, self.snapshot_file, "HEAD", "csv")

    def test_specified_control_has_the_same_starting_project(self):
        for name in ("parcel", "parcel-specified"):
            materialize_fixture(self.snapshot, self.root / name, name)
        self.assertNotIn(
            "tracking number", (self.root / "parcel/instruction.md").read_text()
        )
        self.assertIn(
            "tracking number",
            (self.root / "parcel-specified/instruction.md").read_text(),
        )
        for relative in (
            "environment/Dockerfile",
            "environment/package.json",
            "tests/test.sh",
        ):
            self.assertEqual(
                (self.root / "parcel" / relative).read_bytes(),
                (self.root / "parcel-specified" / relative).read_bytes(),
            )

    def test_launch_keeps_key_on_host_and_uses_distinct_cases(self):
        key, auth = self.root / "key.json", self.root / "auth.json"
        write_json(
            key, {"keep": {"Question?": "Keep."}, "discard": {"Question?": "Discard."}}
        )
        write_json(auth, {})

        def harbor(command, **kwargs):
            env = kwargs["env"]
            self.assertNotIn("OPENAI_API_KEY", env)
            self.assertIn("intake.agent:IntakeAgent", command)
            self.assertEqual(Path(env["SAFEWORD_EVAL_ANSWER_KEY"]), key)
            lane = Path(env["ASSESS_RELAY"]).parent
            self.assertEqual(lane.parent.name, env["SAFEWORD_EVAL_TASK"])
            rewards = lane / "harbor" / "trial" / "verifier"
            rewards.mkdir(parents=True)
            write_json(rewards / "reward.json", {"reward": 0})
            return subprocess.CompletedProcess(command, 0)

        with (
            patch.dict(
                os.environ,
                {
                    "SAFEWORD_EVAL_CODEX_REVIEW_AUTH": str(auth),
                    "SAFEWORD_EVAL_ANSWER_KEY": str(key),
                    "CLAUDE_CODE_OAUTH_TOKEN": "test",
                    "OPENAI_API_KEY": "test",
                },
            ),
            patch("intake.run.subprocess.run", side_effect=harbor),
        ):
            for case in ("keep", "discard"):
                launch(self.root, "codex", case, 3)
            with self.assertRaises(FileExistsError):
                launch(self.root, "codex", "keep", 3)

    def test_replay_preserves_missing_lanes_and_rejects_self_approval(self):
        write_json(self.root / "build.json", {"archive_sha256": "fixture"})
        lane = self.root / "trials" / "case" / "claude"
        trial = lane / "harbor" / "trial"
        agent, verifier = trial / "agent", trial / "verifier"
        agent.mkdir(parents=True)
        verifier.mkdir()
        write_json(trial / "result.json", {})
        write_json(
            agent / "setup-evidence.json",
            {
                "status": "ready",
                "bundle_sha256": "fixture",
                "host": "claude",
                "expected_model": "claude-test",
            },
        )
        write_json(verifier / "reward.json", {"reward": 1})
        write_json(verifier / "intake-outcome.json", {"outcome": "passed"})
        write_json(
            agent / "intake-stop.json",
            {
                "boundary": "phase_advance",
                "outcome": "passed",
                "approval": {
                    "author": "claude",
                    "reviewer": "claude",
                    "review_id": "r",
                    "model": "claude-test",
                },
            },
        )
        with self.assertRaisesRegex(ValueError, "pre-code approval"):
            trial_result(lane, {"archive_sha256": "fixture"}, self.snapshot["models"])
        self.assertFalse(score(self.root, ["case"]))
        results = json.loads((self.root / "intake-results.json").read_text())
        self.assertEqual(len(results), 2)
        self.assertTrue(
            all(row["outcome"] == "incomplete_evidence" for row in results.values())
        )

    def test_codex_spend_includes_distinct_sessions_and_deduplicates_resume(self):
        from shutil import copyfile

        scripts = Path(__file__).resolve().parent
        for source in (
            scripts / "supervise-codex.mjs",
            scripts.parent / "trial-spend.cjs",
        ):
            copyfile(source, self.root / source.name)
        sessions = self.root / "home/sessions"
        sessions.mkdir(parents=True)
        snapshot = self.snapshot
        snapshot["pricing"]["models"]["codex-test"] = {
            "input": 1,
            "output": 2,
            "cached": 0,
            "write_short": 0,
            "write_long": 0,
        }
        write_json(self.snapshot_file, snapshot)
        for filename, session, outputs in (
            ("one", "one", 15),
            ("resumed", "one", 20),
            ("two", "two", 30),
        ):
            events = [
                {"type": "session_meta", "payload": {"id": session}},
                {"type": "turn_context", "payload": {"model": "codex-test"}},
                {
                    "type": "event_msg",
                    "payload": {
                        "info": {
                            "total_token_usage": {
                                "input_tokens": 100,
                                "output_tokens": outputs,
                                "total_tokens": 100 + outputs,
                            }
                        }
                    },
                },
            ]
            (sessions / (filename + ".jsonl")).write_text(
                "".join(json.dumps(e) + "\n" for e in events)
            )
        subprocess.run(
            [
                "node",
                str(self.root / "supervise-codex.mjs"),
                "true",
                str(self.snapshot_file),
                "0.00025",
                str(self.root / "home"),
            ],
            check=True,
        )
        spend = json.loads((self.root / "author-spend.json").read_text())
        self.assertAlmostEqual(spend["cost_usd"], 0.0003)
        self.assertEqual(spend["usage"]["total_tokens"], 250)
        self.assertEqual(
            json.loads((self.root / "budget-stop.json").read_text())["reason"],
            "combined_cap",
        )
